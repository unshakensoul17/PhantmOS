"""
harvesting/source_remotive.py — PhantmOS v2.0

Remotive.com public API adapter.
Endpoint: https://remotive.com/api/remote-jobs
Free tier: unlimited requests.
Best for: Remote tech / AI / ML roles.
"""
import httpx
from core.logger import get_logger

logger = get_logger(__name__)

BASE_URL = "https://remotive.com/api/remote-jobs"




async def fetch_remotive(limit_per_term: int = 20, search_query: str = None) -> list[dict]:
    """
    Fetch jobs from Remotive across all target search terms or a specific query.
    Returns a normalised list of job dicts.
    """
    results: list[dict] = []

    async with httpx.AsyncClient(timeout=20.0) as client:
        params = {"limit": limit_per_term}
        if search_query and search_query.strip():
            params["search"] = search_query.strip()

        try:
            resp = await client.get(BASE_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
            jobs = data.get("jobs", [])
            for job in jobs:
                results.append(_normalise(job))
            logger.info(f"Remotive: fetched {len(jobs)} jobs for '{search_query or 'ALL'}'")
        except Exception as e:
            logger.warning(f"Remotive: failed for query '{search_query}': {e}")

    return results


def _normalise(job: dict) -> dict:
    """Map Remotive fields → PhantmOS standard schema."""
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
