"""
harvesting/source_remoteok.py — Ghost Protocol v2.0

RemoteOK public API adapter.
Endpoint: https://remoteok.com/api
Free tier: unlimited.
Best for: Dev / AI / ML remote roles.

Note: RemoteOK returns a leading metadata object as the first element —
we skip it with [1:].
"""
import httpx
from core.logger import get_logger

logger = get_logger(__name__)

BASE_URL = "https://remoteok.com/api"

TAGS = ["machine-learning", "python", "ai", "data-science", "nlp", "deep-learning"]


async def fetch_remoteok(search_query: str = None) -> list[dict]:
    """
    Fetch jobs from RemoteOK for each target tag or a specific query.
    Returns a normalised list of job dicts.
    """
    results: list[dict] = []

    async with httpx.AsyncClient(
        timeout=20.0,
        headers={"User-Agent": "GhostProtocol/2.0 (job-search-bot)"},
    ) as client:
        tags_to_search = [search_query] if search_query else TAGS
        for tag in tags_to_search:
            try:
                resp = await client.get(BASE_URL, params={"tag": tag})
                resp.raise_for_status()
                data = resp.json()
                # First element is metadata — skip it
                jobs = data[1:] if isinstance(data, list) and len(data) > 1 else []
                for job in jobs:
                    if isinstance(job, dict):
                        results.append(_normalise(job))
                logger.info(f"RemoteOK: fetched {len(jobs)} jobs for tag '{tag}'")
            except Exception as e:
                logger.warning(f"RemoteOK: failed for tag '{tag}': {e}")

    return results


def _normalise(job: dict) -> dict:
    """Map RemoteOK fields → Ghost Protocol standard schema."""
    tags = job.get("tags") or []
    return {
        "title":           job.get("position", ""),
        "company":         job.get("company", ""),
        "job_url":         job.get("url", ""),
        "raw_description": job.get("description", ""),
        "source":          "remoteok",
        "location":        "Remote",
        "salary":          _salary_str(job),
        "tags":            ", ".join(tags) if isinstance(tags, list) else str(tags),
    }


def _salary_str(job: dict) -> str:
    lo = job.get("salary_min")
    hi = job.get("salary_max")
    if lo and hi:
        return f"${lo:,} – ${hi:,}"
    if lo:
        return f"${lo:,}+"
    return ""
