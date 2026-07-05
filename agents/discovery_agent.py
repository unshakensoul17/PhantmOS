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
from core.database_manager import get_client, bulk_upsert_job_leads
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

    async def run_for_user(self, search_query: str, user_id: str) -> list[dict]:
        """
        Phase 3: Optimized Local Search First.
        Queries the global_jobs pool for recent matches. 
        If fewer than 5 exist locally, falls back to hitting the APIs.
        Returns raw jobs ready for save_leads.
        """
        logger.info(f"DiscoveryAgent: searching local DB for '{search_query}' (user {user_id})...")
        try:
            # Query global_jobs where title or description matches the query
            # and job_id not in user_job_pipelines for this user
            resp = get_client().rpc(
                "search_global_jobs_for_user",
                {"p_user_id": user_id, "p_query": search_query or "", "p_limit": 20}
            ).execute()
            
            local_jobs = resp.data or []
            logger.info(f"DiscoveryAgent: found {len(local_jobs)} matching jobs locally.")
            
            if len(local_jobs) >= 5:
                # We have enough local jobs, no need to burn API credits
                return local_jobs
                
            # Fallback to external APIs
            logger.info(f"DiscoveryAgent: insufficient local jobs. Falling back to external APIs for '{search_query}'...")
            api_jobs = await self.run(search_query=search_query)
            return local_jobs + api_jobs
            
        except Exception as e:
            logger.error(f"DiscoveryAgent: local search failed — {e}")
            # Fallback on error
            return await self.run(search_query=search_query)

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
            res = bulk_upsert_job_leads(leads)
            saved = len(res)
        except Exception as e:
            logger.error(f"DiscoveryAgent: bulk upsert failed - {e}")
            saved = 0
            
        logger.info(f"DiscoveryAgent: saved {saved} leads for user {user_id}")
        return saved
