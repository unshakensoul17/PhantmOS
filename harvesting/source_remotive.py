"""
harvesting/source_remotive.py — Ghost Protocol v2.0

Remotive.com public API adapter.
Endpoint: https://remotive.com/api/remote-jobs
Free tier: unlimited requests.
Best for: Remote tech / AI / ML roles.
"""
import httpx
from core.logger import get_logger

logger = get_logger(__name__)

BASE_URL = "https://remotive.com/api/remote-jobs"

# Map our target queries to Remotive category slugs
SEARCH_TERMS = [
    "machine learning",
    "ai engineer",
    "data scientist",
    "nlp",
    "python developer",
]


async def fetch_remotive(limit_per_term: int = 20, search_query: str = None) -> list[dict]:
    """
    Fetch jobs from Remotive across all target search terms or a specific query.
    Returns a normalised list of job dicts.
    """
    results: list[dict] = []

    async with httpx.AsyncClient(timeout=20.0) as client:
        terms_to_search = [search_query] if search_query else SEARCH_TERMS
        for term in terms_to_search:
            try:
                resp = await client.get(
                    BASE_URL,
                    params={"search": term, "limit": limit_per_term},
                )
                resp.raise_for_status()
                data = resp.json()
                jobs = data.get("jobs", [])
                for job in jobs:
                    results.append(_normalise(job))
                logger.info(f"Remotive: fetched {len(jobs)} jobs for '{term}'")
            except Exception as e:
                logger.warning(f"Remotive: failed for term '{term}': {e}")

    return results


def _normalise(job: dict) -> dict:
    """Map Remotive fields → Ghost Protocol standard schema."""
    return {
        "title":           job.get("title", ""),
        "company":         job.get("company_name", ""),
        "job_url":         job.get("url", ""),
        "raw_description": job.get("description", ""),
        "source":          "remotive",
        "location":        job.get("candidate_required_location", "Remote"),
        "salary":          job.get("salary", ""),
        "tags":            ", ".join(job.get("tags", [])),
    }
