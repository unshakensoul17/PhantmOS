"""
harvesting/source_himalayas.py — Ghost Protocol v3.0
Himalayas.app Remote Jobs API adapter.
"""
import httpx
from core.logger import get_logger

logger = get_logger(__name__)

BASE_URL = "https://himalayas.app/jobs/api/search"
SEARCH_TERMS = [
    "machine learning",
    "ai engineer",
    "data scientist",
    "nlp",
    "python developer",
]

async def fetch_himalayas(limit_per_term: int = 20, search_query: str = None) -> list[dict]:
    """Fetch jobs from Himalayas Remote Jobs Search API."""
    results: list[dict] = []
    async with httpx.AsyncClient(timeout=20.0) as client:
        terms_to_search = [search_query] if search_query else SEARCH_TERMS
        for term in terms_to_search:
            try:
                resp = await client.get(
                    BASE_URL,
                    params={"q": term, "limit": limit_per_term}
                )
                resp.raise_for_status()
                data = resp.json()
                jobs = data.get("jobs", [])
                for job in jobs:
                    results.append(_normalise(job))
                logger.info(f"Himalayas: fetched {len(jobs)} jobs for '{term}'")
            except Exception as e:
                logger.warning(f"Himalayas: failed for term '{term}': {e}")
    return results

def _normalise(job: dict) -> dict:
    """Map Himalayas fields to standard schema."""
    company_obj = job.get("company", {})
    company_name = company_obj.get("name", "") if isinstance(company_obj, dict) else str(company_obj)
    
    # Extract salary if present
    sal_range = job.get("salaryRange", {})
    sal_str = ""
    if isinstance(sal_range, dict) and sal_range.get("min"):
        sal_str = f"{sal_range.get('min')} - {sal_range.get('max', '')} {sal_range.get('currency', 'USD')}"

    return {
        "title":           job.get("title", ""),
        "company":         company_name,
        "job_url":         job.get("applicationUrl", ""),
        "raw_description": job.get("description", ""),
        "source":          "himalayas",
        "location":        job.get("location", "Remote"),
        "salary":          sal_str,
        "tags":            "",
    }
