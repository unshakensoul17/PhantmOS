"""
harvesting/source_ats.py — PhantmOS v3.0

Direct public ATS Connectors:
  - Greenhouse Public Board API (boards-api.greenhouse.io)
  - Lever Public Postings API (api.lever.co)
  - Ashby Public Job Board API (api.ashbyhq.com)

100% Free, zero scraping blocks, structured real-time JSON straight from tech & AI companies.
"""

import asyncio
import re
from datetime import datetime
import httpx

from harvesting.currency_cleaner import normalize_salary
from harvesting.text_cleaner import clean_job_description


async def fetch_greenhouse_board(board_token: str, client: httpx.AsyncClient) -> list[dict]:
    """Fetch structured jobs from Greenhouse public board API."""
    url = f"https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs?content=true"
    try:
        resp = await client.get(url, timeout=12.0)
        if resp.status_code != 200:
            return []
        data = resp.json()
        raw_jobs = data.get("jobs", [])
        results = []
        for j in raw_jobs:
            title = j.get("title", "").strip()
            loc_obj = j.get("location") or {}
            location = loc_obj.get("name", "Remote") if isinstance(loc_obj, dict) else str(loc_obj)
            raw_content = j.get("content", "")
            cleaned_desc = clean_job_description(raw_content)

            # High-end currency extraction from raw content or metadata
            salary_str = normalize_salary("", fallback_desc=raw_content)

            # Extract salary or department if present
            departments = [d.get("name") for d in j.get("departments", []) if isinstance(d, dict)]
            dept_str = ", ".join(departments) if departments else ""

            results.append({
                "title": title,
                "company": board_token.capitalize(),
                "location": location,
                "url": j.get("absolute_url", ""),
                "description": cleaned_desc,
                "salary": salary_str,
                "source": "Greenhouse",
                "department": dept_str,
                "scraped_at": datetime.utcnow().isoformat(),
            })
        return results
    except Exception as e:
        logger.debug(f"ATS Greenhouse fetch error for {board_token}: {e}")
        return []


async def fetch_lever_board(company_slug: str, client: httpx.AsyncClient) -> list[dict]:
    """Fetch structured jobs from Lever public postings API."""
    url = f"https://api.lever.co/v0/postings/{company_slug}?mode=json"
    try:
        resp = await client.get(url, timeout=12.0)
        if resp.status_code != 200:
            return []
        postings = resp.json()
        results = []
        for p in postings:
            categories = p.get("categories") or {}
            location = categories.get("location", "Remote")
            commitment = categories.get("commitment", "")
            title = p.get("text", "").strip()
            raw_desc = p.get("descriptionPlain") or p.get("description", "")
            cleaned_desc = clean_job_description(raw_desc)

            # High-end multi-currency normalization
            sal = p.get("salaryRange")
            salary_str = normalize_salary(sal, fallback_desc=raw_desc)

            results.append({
                "title": title,
                "company": company_slug.capitalize(),
                "location": location,
                "url": p.get("hostedUrl", ""),
                "description": cleaned_desc,
                "salary": salary_str,
                "source": "Lever",
                "department": categories.get("department", ""),
                "scraped_at": datetime.utcnow().isoformat(),
            })
        return results
    except Exception as e:
        logger.debug(f"ATS Lever fetch error for {company_slug}: {e}")
        return []


async def fetch_ashby_board(company_slug: str, client: httpx.AsyncClient) -> list[dict]:
    """Fetch structured jobs from Ashby public postings API."""
    url = f"https://api.ashbyhq.com/posting-api/job-board/{company_slug}"
    try:
        resp = await client.get(url, timeout=12.0)
        if resp.status_code != 200:
            return []
        data = resp.json()
        raw_jobs = data.get("jobs", [])
        results = []
        for j in raw_jobs:
            if j.get("isListed") is False:
                continue

            title = j.get("title", "").strip()
            location = j.get("location", "Remote") or "Remote"
            is_remote = j.get("isRemote", False)
            if is_remote and "remote" not in location.lower():
                location = f"{location} (Remote)"

            raw_desc = j.get("descriptionPlain") or j.get("descriptionHtml", "")
            cleaned_desc = clean_job_description(raw_desc)

            # High-end multi-currency normalization
            comp_info = j.get("compensation") or {}
            raw_salary = comp_info.get("compensationTierSummary", "") if isinstance(comp_info, dict) else ""
            salary_str = normalize_salary(raw_salary, fallback_desc=raw_desc)

            results.append({
                "title": title,
                "company": company_slug.capitalize(),
                "location": location,
                "url": j.get("jobUrl") or j.get("applyUrl", ""),
                "description": cleaned_desc,
                "salary": salary_str,
                "source": "Ashby",
                "department": j.get("department", "") or j.get("team", ""),
                "scraped_at": datetime.utcnow().isoformat(),
            })
        return results
    except Exception as e:
        logger.debug(f"ATS Ashby fetch error for {company_slug}: {e}")
        return []

logger = get_logger(__name__)

# Curated list of high-profile AI & Tech companies using Greenhouse, Lever, or Ashby
FEATURED_GREENHOUSE_COMPANIES = [
    "anthropic", "scaleai", "modal", "togetherai", "perplexity",
    "supabase", "vercel", "cohere", "pinecone", "elevenlabs",
    "weightsandbiases", "langchain", "anyscale", "huggingface",
    "speechify", "mistral", "replicate", "character"
]

FEATURED_LEVER_COMPANIES = [
    "palantir", "linear", "postman", "writer", "synthesia", "glide"
]

FEATURED_ASHBY_COMPANIES = [
    "openai", "replit", "ramp", "mercury", "dust", "cursor",
    "sentry", "deel", "ironclad", "vanta", "retrieval", "temporal"
]


async def fetch_greenhouse_board(board_token: str, client: httpx.AsyncClient) -> list[dict]:
    """Fetch structured jobs from Greenhouse public board API."""
    url = f"https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs?content=true"
    try:
        resp = await client.get(url, timeout=12.0)
        if resp.status_code != 200:
            return []
        data = resp.json()
        raw_jobs = data.get("jobs", [])
        results = []
        for j in raw_jobs:
            title = j.get("title", "").strip()
            loc_obj = j.get("location") or {}
            location = loc_obj.get("name", "Remote") if isinstance(loc_obj, dict) else str(loc_obj)
            raw_content = j.get("content", "")
            cleaned_desc = clean_job_description(raw_content)

            # Extract salary or department if present
            departments = [d.get("name") for d in j.get("departments", []) if isinstance(d, dict)]
            dept_str = ", ".join(departments) if departments else ""

            results.append({
                "title": title,
                "company": board_token.capitalize(),
                "location": location,
                "url": j.get("absolute_url", ""),
                "description": cleaned_desc,
                "salary": "",
                "source": "Greenhouse",
                "department": dept_str,
                "scraped_at": datetime.utcnow().isoformat(),
            })
        return results
    except Exception as e:
        logger.debug(f"ATS Greenhouse fetch error for {board_token}: {e}")
        return []


async def fetch_lever_board(company_slug: str, client: httpx.AsyncClient) -> list[dict]:
    """Fetch structured jobs from Lever public postings API."""
    url = f"https://api.lever.co/v0/postings/{company_slug}?mode=json"
    try:
        resp = await client.get(url, timeout=12.0)
        if resp.status_code != 200:
            return []
        postings = resp.json()
        results = []
        for p in postings:
            categories = p.get("categories") or {}
            location = categories.get("location", "Remote")
            commitment = categories.get("commitment", "")
            title = p.get("text", "").strip()
            raw_desc = p.get("descriptionPlain") or p.get("description", "")
            cleaned_desc = clean_job_description(raw_desc)

            salary_str = ""
            sal = p.get("salaryRange")
            if sal and isinstance(sal, dict):
                salary_str = f"${sal.get('min', '')}-${sal.get('max', '')} {sal.get('currency', 'USD')}"

            results.append({
                "title": title,
                "company": company_slug.capitalize(),
                "location": location,
                "url": p.get("hostedUrl", ""),
                "description": cleaned_desc,
                "salary": salary_str,
                "source": "Lever",
                "department": categories.get("department", ""),
                "scraped_at": datetime.utcnow().isoformat(),
            })
        return results
    except Exception as e:
        logger.debug(f"ATS Lever fetch error for {company_slug}: {e}")
        return []


async def fetch_ashby_board(company_slug: str, client: httpx.AsyncClient) -> list[dict]:
    """Fetch structured jobs from Ashby public postings API."""
    url = f"https://api.ashbyhq.com/posting-api/job-board/{company_slug}"
    try:
        resp = await client.get(url, timeout=12.0)
        if resp.status_code != 200:
            return []
        data = resp.json()
        raw_jobs = data.get("jobs", [])
        results = []
        for j in raw_jobs:
            # Only consider listed / active jobs
            if j.get("isListed") is False:
                continue

            title = j.get("title", "").strip()
            location = j.get("location", "Remote") or "Remote"
            is_remote = j.get("isRemote", False)
            if is_remote and "remote" not in location.lower():
                location = f"{location} (Remote)"

            raw_desc = j.get("descriptionPlain") or j.get("descriptionHtml", "")
            cleaned_desc = clean_job_description(raw_desc)

            # Extract compensation tier summary if available
            comp_info = j.get("compensation") or {}
            salary_str = comp_info.get("compensationTierSummary", "") if isinstance(comp_info, dict) else ""

            results.append({
                "title": title,
                "company": company_slug.capitalize(),
                "location": location,
                "url": j.get("jobUrl") or j.get("applyUrl", ""),
                "description": cleaned_desc,
                "salary": salary_str,
                "source": "Ashby",
                "department": j.get("department", "") or j.get("team", ""),
                "scraped_at": datetime.utcnow().isoformat(),
            })
        return results
    except Exception as e:
        logger.debug(f"ATS Ashby fetch error for {company_slug}: {e}")
        return []


async def fetch_all_ats_jobs(search_query: str = None) -> list[dict]:
    """
    Parallel harvester across curated public Greenhouse, Lever, and Ashby boards.
    Filters relevant software, ML, and AI engineering roles.
    """
    logger.info("ATS Harvester: querying direct public ATS feeds (Greenhouse, Lever, Ashby)...")
    async with httpx.AsyncClient(headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}) as client:
        tasks = []
        for co in FEATURED_GREENHOUSE_COMPANIES:
            tasks.append(fetch_greenhouse_board(co, client))
        for co in FEATURED_LEVER_COMPANIES:
            tasks.append(fetch_lever_board(co, client))
        for co in FEATURED_ASHBY_COMPANIES:
            tasks.append(fetch_ashby_board(co, client))

        responses = await asyncio.gather(*tasks, return_exceptions=True)

    all_jobs = []
    for resp in responses:
        if isinstance(resp, list):
            all_jobs.extend(resp)

    # Filter tech and engineering roles
    tech_keywords = [
        "engineer", "developer", "machine learning", "ai", "data", "software",
        "product", "lead", "architect", "infra", "security", "backend", "frontend",
        "fullstack", "research", "nlp", "llm"
    ]
    filtered = []
    for job in all_jobs:
        title_lower = job.get("title", "").lower()
        if any(k in title_lower for k in tech_keywords):
            if search_query:
                q = search_query.lower()
                if q not in title_lower and q not in job.get("description", "").lower():
                    continue
            filtered.append(job)

    logger.info(f"ATS Harvester: fetched {len(all_jobs)} total from Greenhouse/Lever/Ashby, {len(filtered)} relevant tech roles.")
    return filtered
