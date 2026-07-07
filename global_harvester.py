import asyncio
import argparse
import sys
from datetime import datetime

from core.database_manager import get_client
from core.logger import get_logger
from agents.discovery_agent import DiscoveryAgent
import logging

logger = get_logger("GlobalHarvester", level=logging.INFO)

async def run_global_harvest():
    """
    Phase 3: Centralized Background Job Harvester
    - Fetches all user profiles to extract unique search queries.
    - Runs the external APIs once per unique query.
    - Saves all results to the global_jobs table.
    """
    logger.info("=========================================")
    logger.info("🌐 PHANTMOS — Global Harvester Start")
    logger.info(f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("=========================================")
    
    try:
        resp = get_client().table("user_profiles").select("preferences, resume_data").execute()
        profiles = resp.data or []
    except Exception as e:
        logger.error(f"Failed to fetch profiles: {e}")
        return
        
    unique_queries = set()
    for profile in profiles:
        # Extract from preferences
        prefs = profile.get("preferences") or {}
        scoring = prefs.get("scoring") or {}
        if scoring.get("target_roles"):
            for role in scoring.get("target_roles", []):
                unique_queries.add(role.strip())
        
        # Fallback to resume_data
        resume = profile.get("resume_data") or {}
        if resume.get("target_role"):
            unique_queries.add(resume.get("target_role").strip())
            
    if not unique_queries:
        logger.info("No target roles found in any user profiles. Defaulting to general harvest.")
        unique_queries.add("") # Empty query for general harvest
        
    logger.info(f"Targeting {len(unique_queries)} unique queries: {unique_queries}")
    
    discovery = DiscoveryAgent()
    total_new = 0
    
    for query in unique_queries:
        logger.info(f"\n--- Harvesting for: '{query}' ---")
        try:
            # We use run() instead of run_for_user() because we WANT to hit the APIs
            raw_jobs = await discovery.run(search_query=query if query else None)
            
            # Save leads with user_id=None to only upsert to global_jobs
            saved = discovery.save_leads(raw_jobs, user_id=None)
            total_new += saved
            logger.info(f"Query '{query}' yielded {saved} new global jobs.")
        except Exception as e:
            logger.error(f"Failed harvesting for '{query}': {e}")
            
    logger.info("\n=========================================")
    logger.info(f"✅ Global Harvest Complete: {total_new} new jobs added to pool.")
    logger.info("=========================================\n")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the Global Harvester")
    args = parser.parse_args()
    asyncio.run(run_global_harvest())
