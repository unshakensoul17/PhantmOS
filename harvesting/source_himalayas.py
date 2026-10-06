"""
harvesting/source_himalayas.py — PhantmOS v3.0
Himalayas.app Remote Jobs API adapter.
"""
import httpx
from core.logger import get_logger

logger = get_logger(__name__)

BASE_URL = "https://himalayas.app/jobs/api/search"


async def fetch_himalayas(limit_per_term: int = 20, search_query: str = None) -> list[dict]:
    """Fetch jobs from Himalayas Remote Jobs Search API."""
    results: list[dict] = []
    if not search_query:
        return []
    async with httpx.AsyncClient(timeout=20.0) as client:
        terms_to_search = [search_query]
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
    company_name = job.get("companyName", "")
    
    # Extract salary if present
    min_sal = job.get("minSalary")
    max_sal = job.get("maxSalary")
    currency = job.get("currency", "USD")
    sal_str = ""
    if min_sal and max_sal:
        sal_str = f"{min_sal} - {max_sal} {currency}"
    elif min_sal:
        sal_str = f"{min_sal}+ {currency}"
        
    # Extract location restrictions if present
    loc_restrictions = job.get("locationRestrictions") or []
    location = ", ".join(loc_restrictions) if isinstance(loc_restrictions, list) else str(loc_restrictions)
    if not location:
        location = "Remote"

    return {
        "title":           job.get("title", ""),
        "company":         company_name,
        "job_url":         job.get("applicationLink", ""),
        "raw_description": job.get("description", ""),
        "source":          "himalayas",
        "location":        location,
        "salary":          sal_str,
        "tags":            "",
    }
