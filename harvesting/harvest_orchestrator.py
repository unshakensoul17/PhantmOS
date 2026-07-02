"""
harvesting/harvest_orchestrator.py — Ghost Protocol v2.0

Runs all job sources in PARALLEL via asyncio.gather(), merges results,
applies keyword pre-filter, deduplicates against DB, then batch-upserts
new leads with status="Found".

Replaces the old SerpApi-based harvesting_engine.py entirely.
"""
import asyncio
import uuid
from datetime import datetime

from core.database_manager import upsert_job_lead, log_stage_success, log_stage_failure
from core.logger import get_logger
from intelligence.keyword_filter import passes_keyword_filter
from intelligence.deduplicator import filter_new_jobs
from harvesting.source_remotive import fetch_remotive
from harvesting.source_remoteok import fetch_remoteok
from harvesting.source_arbeitnow import fetch_arbeitnow
from harvesting.source_himalayas import fetch_himalayas
from harvesting.source_hn import fetch_hn_hiring

logger = get_logger(__name__)


async def run_harvest(include_hn: bool = False, search_query: str = None) -> list[dict]:
    """
    Execute the full Stage 1 pipeline:
      1. Fetch all sources in parallel
      2. Merge and keyword-filter

    Args:
        include_hn: If True, also scrape HN Who's Hiring (run monthly, on 1st).
        search_query: Optional search term for targeted harvesting.

    Returns:
        List of filtered job dicts.
    """
    logger.info("=== Stage 1: Smart Harvesting started ===")

    # ── 1. Fetch all sources in parallel ─────────────────────────────────────
    fetch_tasks = [
        _safe_fetch("Remotive",  fetch_remotive(search_query=search_query)),
        _safe_fetch("RemoteOK",  fetch_remoteok(search_query=search_query)),
        _safe_fetch("Arbeitnow", fetch_arbeitnow(search_query=search_query)),
        _safe_fetch("Himalayas", fetch_himalayas(search_query=search_query)),
    ]
    if include_hn or _is_first_of_month():
        fetch_tasks.append(_safe_fetch("HN", fetch_hn_hiring()))

    source_results = await asyncio.gather(*fetch_tasks)

    # Flatten all results into one list
    raw_jobs: list[dict] = []
    for batch in source_results:
        raw_jobs.extend(batch)

    logger.info(f"Harvesting: {len(raw_jobs)} total raw jobs from all sources.")

    # ── 2. Remove jobs with empty title or company ────────────────────────────
    raw_jobs = [j for j in raw_jobs if j.get("title") and j.get("company")]

    # ── 3. Keyword pre-filter ─────────────────────────────────────────────────
    filtered: list[dict] = [
        j for j in raw_jobs
        if passes_keyword_filter(j.get("title", ""), j.get("raw_description", ""), search_query)
    ]
    logger.info(
        f"Keyword filter: {len(raw_jobs) - len(filtered)} rejected, "
        f"{len(filtered)} passed."
    )

    return filtered


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _safe_fetch(source_name: str, coro) -> list[dict]:
    """
    Wraps each source fetch with retry (2 attempts) + error isolation.
    A single source failing never blocks the others.
    """
    for attempt in range(1, 3):
        try:
            results = await coro
            return results
        except Exception as e:
            logger.warning(
                f"{source_name}: attempt {attempt}/2 failed — {e}"
            )
            if attempt < 2:
                await asyncio.sleep(10)
    logger.error(f"{source_name}: all attempts failed, skipping source.")
    log_stage_failure(None, f"harvest_{source_name.lower()}", str(e) if 'e' in dir() else "unknown")
    return []


def build_lead(job: dict) -> dict:
    """Construct the full DB-ready lead dict from a normalised job dict."""
    # Use a deterministic UUID derived from dedup_hash so upserts are idempotent
    dedup_hash = job["dedup_hash"]
    job_uuid   = str(uuid.UUID(dedup_hash))   # MD5 hex is 32 chars → valid UUID

    return {
        "job_id":          job_uuid,
        "title":           job.get("title", "")[:300],
        "company":         job.get("company", "")[:300],
        "job_url":         job.get("job_url", "") or f"https://unknown.local/{job_uuid}",
        "raw_description": job.get("raw_description", ""),
        "source":          job.get("source", "unknown"),
        "source_platform": job.get("source", "unknown"),  # keep legacy column in sync
        "dedup_hash":      dedup_hash,
        "status":          "Found",
        "match_score":     0.0,          # will be filled by Stage 2 scorer
        "score_band":      None,         # filled by Stage 2
        "genuity_flag":    True,         # default; can be updated later
        "notes":           None,
        "resume_url":      None,
    }


def _is_first_of_month() -> bool:
    return datetime.utcnow().day == 1


def _summary(raw: int, filtered: int, saved: int) -> dict:
    return {
        "raw_fetched":       raw,
        "after_keyword_filter": filtered,
        "new_saved":         saved,
        "duplicates_skipped": filtered - saved,
    }
