"""
intelligence/deduplicator.py — PhantmOS v2.0

Hash-based job deduplication.
A job is a duplicate if (lower(company) + lower(title)) was already seen.
"""
import hashlib
from typing import Optional

from core.database_manager import get_existing_dedup_hashes
from core.logger import get_logger

logger = get_logger(__name__)


def make_dedup_hash(company: str, title: str) -> str:
    """
    MD5 of the lowercased, whitespace-stripped concatenation of company + title.
    Stable across runs — same job always produces the same hash.
    """
    key = (company.lower().strip() + title.lower().strip()).encode("utf-8")
    return hashlib.md5(key).hexdigest()


def filter_new_jobs(jobs: list[dict], user_id: Optional[str] = None) -> list[dict]:
    """
    Given a list of raw job dicts (each must have 'company' and 'title'),
    return only the ones whose dedup_hash does NOT already exist in the DB for this user.

    Also attaches 'dedup_hash' to each dict for later upsert.
    """
    if not jobs:
        return []

    # Attach hashes
    for job in jobs:
        job["dedup_hash"] = make_dedup_hash(
            job.get("company", ""), job.get("title", "")
        )

    all_hashes = [j["dedup_hash"] for j in jobs]
    existing = get_existing_dedup_hashes(all_hashes, user_id)

    new_jobs = [j for j in jobs if j["dedup_hash"] not in existing]

    skipped = len(jobs) - len(new_jobs)
    if skipped:
        logger.info(f"Deduplicator: skipped {skipped} already-seen jobs, {len(new_jobs)} new.")

    return new_jobs
