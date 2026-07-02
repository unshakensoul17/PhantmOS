"""
harvesting/source_arbeitnow.py — Ghost Protocol v2.0

Arbeitnow public API adapter.
Endpoint: https://www.arbeitnow.com/api/job-board-api
Free tier: unlimited.
Best for: EU + Remote roles.
"""
import httpx
from core.logger import get_logger

logger = get_logger(__name__)

BASE_URL = "https://www.arbeitnow.com/api/job-board-api"

SEARCH_TERMS = [
    "machine learning",
    "ai engineer",
    "data scientist",
    "python",
    "nlp",
]


async def fetch_arbeitnow(search_query: str = None) -> list[dict]:
    """
    Fetch remote jobs from Arbeitnow for each target search term or a specific query.
    Returns normalised job dicts.
    """
    results: list[dict] = []

    async with httpx.AsyncClient(timeout=20.0) as client:
        terms_to_search = [search_query] if search_query else SEARCH_TERMS
        for term in terms_to_search:
            try:
                resp = await client.get(
                    BASE_URL,
                    params={"search": term, "remote": "true"},
                )
                resp.raise_for_status()
                data = resp.json()
                jobs = data.get("data", [])
                for job in jobs:
                    results.append(_normalise(job))
                logger.info(f"Arbeitnow: fetched {len(jobs)} jobs for '{term}'")
            except Exception as e:
                logger.warning(f"Arbeitnow: failed for term '{term}': {e}")

    return results


def _normalise(job: dict) -> dict:
    """Map Arbeitnow fields → Ghost Protocol standard schema."""
    tags = job.get("tags") or []
    return {
        "title":           job.get("title", ""),
        "company":         job.get("company_name", ""),
        "job_url":         job.get("url", ""),
        "raw_description": job.get("description", ""),
        "source":          "arbeitnow",
        "location":        job.get("location", "Remote"),
        "salary":          "",
        "tags":            ", ".join(tags) if isinstance(tags, list) else "",
    }
