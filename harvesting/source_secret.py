"""
harvesting/source_secret.py — PhantmOS v3.0

Adapter for the private/secret Job Feed Database.
"""
import os
import httpx
import re
from bs4 import BeautifulSoup
from core.logger import get_logger

logger = get_logger(__name__)

SECRET_URL = os.getenv("SECRET_SOURCE_URL")
BASE_URL = SECRET_URL if SECRET_URL else ""

# Fallback regex patterns if DOM extraction fails
URL_PATTERNS = [
    r"href=\"(https://www\.linkedin\.com/jobs/view/[^\"]+)\"",
    r"href=\"(https://forms\.gle/[^\"]+)\"",
    r"href=\"(mailto:[^\"]+)\"",
    r"href=\"(https://[^\"]+apply[^\"]*)\"",
    r"href=\"(https://[^\"]+career[^\"]*)\"",
    r"href=\"(https://[^\"]+job[^\"]*)\"",
    r"href=\"(https://(?!(?:www\." + "blog" + "ger\.com|blogspot\.com))[^\"]+)\""
]

async def fetch_secret(limit_per_query: int = 50, search_query: str = None) -> list[dict]:
    """
    Fetch jobs from the Secret API. Search query acts as an optional filter.
    Returns a normalised list of job dicts.
    """
    if not BASE_URL:
        logger.error("SECRET_SOURCE_URL is missing from environment variables.")
        return []
        
    results: list[dict] = []

    async with httpx.AsyncClient(
        timeout=20.0,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    ) as client:
        try:
            # Simple text searching via 'q'
            params = {"alt": "json", "max-results": limit_per_query}
            if search_query:
                params["q"] = search_query

            resp = await client.get(BASE_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
            
            entries = data.get("feed", {}).get("entry", [])
            for entry in entries:
                results.append(_normalise(entry))
                
            logger.info(f"SecretAPI: fetched {len(entries)} jobs for query '{search_query or 'ALL'}'")
        except Exception as e:
            logger.warning(f"SecretAPI: failed to fetch for query '{search_query}': {e}")

    return results

def _extract_apply_link(html_content: str) -> str:
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # 1. Scrape specific anchor tags containing the word 'apply'
    for a in soup.find_all('a', href=True):
        href = a['href']
        text = a.get_text().lower()
        if 'apply' in text and 'whatsapp' not in href and 'whatsapp' not in text:
            return href
            
    # 2. Discover stealthy image buttons functioning as links
    for a in soup.find_all('a', href=True):
        href = a['href']
        if 'whatsapp' in href:
            continue
        for img in a.find_all('img'):
            src_alt = ((img.get('src', '') or '') + " " + (img.get('alt', '') or '')).lower()
            if 'apply' in src_alt or 'btn' in src_alt or 'button' in src_alt:
                return href
                
    # 3. Fallback to Regex searching for raw unformatted text URLs
    for pattern in URL_PATTERNS:
        match = re.search(pattern, html_content, re.IGNORECASE)
        if match:
            url = match.group(1)
            if 'whatsapp' not in url.lower():
                return url
                
    return ""

def _normalise(entry: dict) -> dict:
    """Map entry fields → PhantmOS standard schema."""
    title = entry.get("title", {}).get("$t", "")
    author = entry.get("author", [{}])[0].get("name", {}).get("$t", "Unknown")
    
    categories = entry.get("category", [])
    tags = [c.get("term", "") for c in categories]
    
    html_content = entry.get("content", {}).get("$t", "")
    apply_link = _extract_apply_link(html_content)
    
    # Clean description for the LLM Scorer
    soup = BeautifulSoup(html_content, 'html.parser')
    raw_desc = soup.get_text(separator=" ", strip=True)
    
    # BUG-18 fix: Extract company from title if possible (e.g. "Software Engineer at Google")
    company = author
    if " at " in title:
        parts = title.split(" at ")
        if len(parts) >= 2:
            company = parts[-1].strip()
    elif apply_link:
        # Fallback to domain name if title extraction fails
        from urllib.parse import urlparse
        domain = urlparse(apply_link).netloc
        if domain:
            company = domain.replace("www.", "").split(".")[0].title()

    return {
        "title":           title,
        "company":         company,
        "job_url":         apply_link,
        "raw_description": raw_desc,
        "source":          "secret",
        "location":        "Remote",
        "salary":          "",
        "tags":            ", ".join(tags),
    }
