"""
agents/discovery_agent.py — Ghost Protocol Multi-Agent Architecture

Purpose:
    Discovers new job opportunities from multiple free API sources,
    applies keyword pre-filtering, and deduplicates against existing DB records.

Responsibilities:
    - Parallel multi-source job harvesting (Remotive, RemoteOK, Arbeitnow, Himalayas, HN)
    - Keyword pre-filter (instant rejection of mismatched roles)
    - Hash-based deduplication against Supabase
    - Source normalization into standard job dicts
    - Persisting new leads with status="Found"

Public Methods:
    run()              — Full discovery pipeline, returns list[dict] of filtered jobs
    save_leads(jobs, user_id) — Deduplicate and persist leads for a user

Dependencies:
    harvesting.harvest_orchestrator, intelligence.keyword_filter,
    intelligence.deduplicator, core.database_manager
"""
from core.database_manager import get_client
from core.logger import get_logger
from harvesting.harvest_orchestrator import run_harvest, build_lead
from intelligence.deduplicator import filter_new_jobs

logger = get_logger(__name__)


class DiscoveryAgent:
    """Owns the entire job discovery pipeline (Stage 1)."""

    async def run(self, search_query: str = None) -> list[dict]:
        """
        Harvest jobs from all sources, apply keyword filter, return normalized list.
        Does NOT persist to DB — call save_leads() per user for that.
        """
        logger.info(f"DiscoveryAgent: starting harvest{f' for query {search_query}' if search_query else ''}")
        try:
            jobs = await run_harvest(search_query=search_query)
            logger.info(f"DiscoveryAgent: {len(jobs)} jobs after filtering")
            return jobs
        except Exception as e:
            logger.error(f"DiscoveryAgent: harvest failed — {e}")
            return []

    def save_leads(self, raw_jobs: list[dict], user_id: str) -> int:
        """
        Deduplicate raw_jobs against this user's existing leads,
        build DB-ready dicts, and batch-upsert. Returns count saved.
        """
        new_jobs = filter_new_jobs(raw_jobs, user_id=user_id)
        if not new_jobs:
            return 0

        leads, seen = [], set()
        for job in new_jobs:
            lead = build_lead(job)
            jid = lead.get("job_id")
            if jid and jid not in seen:
                seen.add(jid)
                lead["user_id"] = user_id
                leads.append(lead)

        if not leads:
            return 0

        try:
            res = get_client().table("job_leads").upsert(
                leads, on_conflict="job_id"
            ).execute()
            saved = len(res.data) if res.data else 0
            logger.info(f"DiscoveryAgent: saved {saved} leads for user {user_id}")
            return saved
        except Exception as e:
            logger.error(f"DiscoveryAgent: upsert failed — {e}")
            return 0
