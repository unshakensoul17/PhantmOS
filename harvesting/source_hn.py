"""
harvesting/source_hn.py — Ghost Protocol v2.0

Hacker News "Who is Hiring?" monthly thread scraper.
Runs ONCE per month (on the 1st) to pick up startup roles.

Strategy:
  1. Find the current month's "Ask HN: Who is Hiring?" thread via Algolia HN API
  2. Fetch top-level comments (each comment = one job posting)
  3. Parse company name, role title, and description from the free-text comment
"""
import re
import httpx
from datetime import datetime
from core.logger import get_logger

logger = get_logger(__name__)

ALGOLIA_URL = "https://hn.algolia.com/api/v1/search"
ITEM_URL    = "https://hacker-news.firebaseio.com/v0/item/{id}.json"


async def fetch_hn_hiring(max_comments: int = 60) -> list[dict]:
    """
    Scrape the current month's HN Who's Hiring thread.
    Returns normalised job dicts (best-effort parsing of free-text comments).
    """
    thread_id = await _find_thread_id()
    if not thread_id:
        logger.warning("HN: Could not locate the Who's Hiring thread this month.")
        return []

    comments = await _fetch_comments(thread_id, max_comments)
    results  = [_parse_comment(c) for c in comments if c]
    results  = [r for r in results if r]  # drop None (unparseable)

    logger.info(f"HN: Parsed {len(results)} job postings from thread {thread_id}.")
    return results


async def _find_thread_id() -> str | None:
    """Use Algolia to find the 'Ask HN: Who is Hiring?' post for this month."""
    now = datetime.utcnow()
    month_year = now.strftime("%B %Y")   # e.g. "May 2026"
    query = f"Ask HN: Who is Hiring? ({month_year})"

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                ALGOLIA_URL,
                params={
                    "query":  query,
                    "tags":   "ask_hn",
                    "hitsPerPage": 5,
                },
            )
            resp.raise_for_status()
            hits = resp.json().get("hits", [])
            if hits:
                thread_id = hits[0]["objectID"]
                logger.info(f"HN: Found hiring thread ID={thread_id} for {month_year}")
                return thread_id
    except Exception as e:
        logger.warning(f"HN: Failed to find thread: {e}")
    return None


async def _fetch_comments(thread_id: str, max_comments: int) -> list[dict]:
    """Fetch top-level child comment items from HN Firebase API."""
    comments: list[dict] = []
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # Fetch thread metadata to get child IDs
            resp = await client.get(ITEM_URL.format(id=thread_id))
            resp.raise_for_status()
            thread = resp.json()
            kids   = (thread.get("kids") or [])[:max_comments]

            # Fetch each comment (concurrently via gather would be ideal,
            # but sequential is safer for rate limits on a free scraper)
            for kid_id in kids:
                try:
                    r = await client.get(ITEM_URL.format(id=kid_id))
                    r.raise_for_status()
                    comments.append(r.json())
                except Exception:
                    pass
    except Exception as e:
        logger.warning(f"HN: Failed to fetch comments: {e}")
    return comments


def _parse_comment(comment: dict) -> dict | None:
    """
    Best-effort parse of a free-text HN job comment.
    Typical format:  "CompanyName | Role | Location | Remote | ..."
    """
    text: str = comment.get("text", "") or ""
    if not text or comment.get("deleted") or comment.get("dead"):
        return None

    # Strip HTML tags
    text_clean = re.sub(r"<[^>]+>", " ", text).strip()

    # Split on pipe character (most HN posters use this convention)
    parts = [p.strip() for p in text_clean.split("|")]

    company = parts[0] if len(parts) > 0 else "Unknown (HN)"
    title   = parts[1] if len(parts) > 1 else "Software Engineer"
    # Everything after pipe 1 becomes the description context
    description = text_clean

    if not company or len(company) > 120:
        return None

    return {
        "title":           title[:200],
        "company":         company[:200],
        "job_url":         f"https://news.ycombinator.com/item?id={comment.get('id', '')}",
        "raw_description": description,
        "source":          "hn",
        "location":        _extract_location(parts),
        "salary":          "",
        "tags":            "",
    }


def _extract_location(parts: list[str]) -> str:
    """Look for a location-like part (contains 'remote', city names, etc.)."""
    location_hints = ["remote", "onsite", "hybrid", "usa", "uk", "eu", "india"]
    for part in parts[2:]:
        if any(h in part.lower() for h in location_hints):
            return part.strip()
    return parts[2].strip() if len(parts) > 2 else "Unknown"
