"""
main_orchestrator.py — Ghost Protocol v3.0 (Multi-Agent Architecture)

Master pipeline coordinator — delegates ALL business logic to agents.

Schedule:
  10:00 IST  → Full pipeline run
  14:30 IST  → Full pipeline run
  09:00 IST  → Daily digest only

Trigger via Dashboard:  POST /api/harvest  → runs full pipeline in background
Stage isolation:        One job failing NEVER stops the rest of the pipeline.

The orchestrator ONLY coordinates agents. It contains ZERO business logic.
"""
import asyncio
import json
import random
from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from dotenv import load_dotenv

from core.config import DEFAULT_TIMEZONE, HARVEST_HOURS, HARVEST_MINUTES, DIGEST_HOUR, DIGEST_MINUTE
from core.database_manager import get_client, get_leads_by_status
from core.logger import get_logger
from core.encryption import decrypt_key

from agents import (
    DiscoveryAgent,
    RankingAgent,
    ResumeAgent,
    ApplicationAgent,
    AnalyticsAgent,
)

load_dotenv()
logger = get_logger(__name__)

# ── Instantiate agents (lightweight — no state, no heavy init) ────────────────
discovery_agent   = DiscoveryAgent()
ranking_agent     = RankingAgent()
resume_agent      = ResumeAgent()
application_agent = ApplicationAgent()
analytics_agent   = AnalyticsAgent()


# ─────────────────────────────────────────────────────────
#  MAIN PIPELINE
# ─────────────────────────────────────────────────────────

async def process_pipeline(manual_query: str = None, target_user_id: str = None) -> dict:
    """
    Full end-to-end Ghost Protocol pipeline.
    Coordinates agents in sequence — contains no business logic itself.
    """
    logger.info("\n========================================")
    logger.info("  GHOST PROTOCOL v3.0 — Pipeline Start")
    logger.info(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("========================================\n")

    summary = {}

    # ── STAGE 1: Discovery Agent (global harvest) ─────────────────────────────
    try:
        logger.info(">>> STAGE 1: Discovery Agent")
        raw_jobs = await discovery_agent.run(search_query=manual_query)
        summary["harvest"] = {"raw_fetched": len(raw_jobs)}
        
        # Save exact matches to a dedicated file if it's a targeted search
        if manual_query:
            import os
            os.makedirs("data/searches", exist_ok=True)
            filename = f"data/searches/jobs_{manual_query.replace(' ', '_')}.json"
            with open(filename, "w", encoding="utf-8") as f:
                json.dump(raw_jobs, f, indent=4)
            logger.info(f"Targeted search results securely saved to {filename}")

    except Exception as e:
        logger.error(f"Stage 1 FAILED: {e}")
        summary["harvest"] = {"error": str(e)}
        return summary

    # ── Fetch user profiles ───────────────────────────────────────────────────
    try:
        resp = get_client().table("user_profiles").select("*").execute()
        profiles = resp.data or []
    except Exception as e:
        logger.error(f"Failed to fetch user profiles: {e}")
        return {"error": f"Failed to fetch profiles: {e}"}

    if target_user_id:
        profiles = [p for p in profiles if p.get("id") == target_user_id]

    summary["users_processed"] = len(profiles)
    summary["details"] = {}

    for profile in profiles:
        user_id = profile.get("id")
        email = profile.get("email", "unknown")
        logger.info(f"\n>>> Processing pipeline for user: {email} ({user_id})")

        user_summary = {}

        # ── Discovery: Save leads for this user ───────────────────────────────
        try:
            saved = discovery_agent.save_leads(raw_jobs, user_id)
            user_summary["harvest"] = {"new_saved": saved, "skipped": len(raw_jobs) - saved}
        except Exception as e:
            logger.error(f"User {user_id} save leads FAILED: {e}")
            user_summary["harvest"] = {"error": str(e)}
            summary["details"][user_id] = user_summary
            continue

        # ── Check Credits & BYOK keys ─────────────────────────────────────────
        api_keys = _resolve_api_keys(profile)
        credits = profile.get("credits", 0) or 0
        has_byok = bool(api_keys)

        if credits <= 0 and not has_byok:
            logger.warning(f"User {user_id} has no credits and no BYOK — skipping LLM pipeline.")
            user_summary["status"] = "skipped_insufficient_balance"
            summary["details"][user_id] = user_summary
            continue

        if not has_byok:
            from core.database_manager import deduct_credit
            if not deduct_credit(user_id):
                logger.warning(f"User {user_id} credit deduction failed — skipping.")
                user_summary["status"] = "skipped_credit_deduction_failed"
                summary["details"][user_id] = user_summary
                continue
            logger.info(f"User {user_id}: deducted 1 credit. Remaining: {credits - 1}")

        # ── STAGE 2: Ranking Agent ────────────────────────────────────────────
        try:
            logger.info(f"User {user_id}: >>> STAGE 2: Ranking Agent")
            user_summary["scoring"] = await ranking_agent.run(profile)
        except Exception as e:
            logger.error(f"User {user_id} Stage 2 FAILED: {e}")
            user_summary["scoring"] = {"error": str(e)}

        # ── STAGE 3: Resume Agent ─────────────────────────────────────────────
        try:
            logger.info(f"User {user_id}: >>> STAGE 3: Resume Agent")
            user_summary["tailoring"] = await resume_agent.run(profile, api_keys)
        except Exception as e:
            logger.error(f"User {user_id} Stage 3 FAILED: {e}")
            user_summary["tailoring"] = {"error": str(e)}

        # ── STAGE 4: Application Agent (PDFs) ─────────────────────────────────
        try:
            logger.info(f"User {user_id}: >>> STAGE 4: Application Agent (PDF)")
            user_summary["pdf"] = await application_agent.generate_pdfs(profile)
        except Exception as e:
            logger.error(f"User {user_id} Stage 4 FAILED: {e}")
            user_summary["pdf"] = {"error": str(e)}

        summary["details"][user_id] = user_summary

    # ── STAGE 5: Application Agent (Delivery Queue) ───────────────────────────
    try:
        logger.info(">>> STAGE 5: Application Agent (Delivery)")
        summary["delivery"] = await application_agent.process_deliveries()
    except Exception as e:
        logger.error(f"Stage 5 FAILED: {e}")
        summary["delivery"] = {"error": str(e)}

    # ── Record pipeline run ───────────────────────────────────────────────────
    logger.info("\n========================================")
    logger.info("  GHOST PROTOCOL v3.0 — Pipeline Done")
    logger.info("========================================\n")
    analytics_agent.record(summary)
    return summary


# ─────────────────────────────────────────────────────────
#  HELPERS
# ─────────────────────────────────────────────────────────

def _resolve_api_keys(profile: dict) -> dict:
    """Extract and decrypt BYOK keys from user profile."""
    enc_keys_raw = profile.get("encrypted_keys") or {}
    if isinstance(enc_keys_raw, str):
        try:
            enc_keys = json.loads(enc_keys_raw)
        except Exception:
            enc_keys = {}
    else:
        enc_keys = enc_keys_raw

    keys = {}
    for env_name in ("GEMINI_API_KEY", "GROQ_API_KEY", "HF_API_KEY"):
        decrypted = decrypt_key(enc_keys.get(env_name))
        if decrypted:
            keys[env_name] = decrypted
    return keys


# ─────────────────────────────────────────────────────────
#  SCHEDULER
# ─────────────────────────────────────────────────────────

async def _scheduled_pipeline():
    """Adds random jitter before running to avoid robotic patterns."""
    delay = random.randint(30, 600)
    logger.info(f"Scheduled run: waiting {delay}s before starting…")
    await asyncio.sleep(delay)
    await process_pipeline()


async def _scheduled_digest():
    """Daily digest wrapper — delegates to AnalyticsAgent."""
    await analytics_agent.send_digest()


async def main():
    """Initialise and start APScheduler in a pure asyncio loop."""
    scheduler = AsyncIOScheduler(timezone=DEFAULT_TIMEZONE)

    for hour, minute in zip(HARVEST_HOURS, HARVEST_MINUTES):
        scheduler.add_job(
            _scheduled_pipeline, "cron",
            hour=hour, minute=minute,
            id=f"pipeline_{hour}_{minute}",
        )
        logger.info(f"Scheduled pipeline run at {hour:02d}:{minute:02d} {DEFAULT_TIMEZONE}")

    scheduler.add_job(
        _scheduled_digest, "cron",
        hour=DIGEST_HOUR, minute=DIGEST_MINUTE,
        id="daily_digest",
    )
    logger.info(f"Scheduled daily digest at {DIGEST_HOUR:02d}:{DIGEST_MINUTE:02d} {DEFAULT_TIMEZONE}")

    scheduler.start()
    logger.info("Ghost Protocol v3.0 Scheduler active. Waiting…")

    try:
        while True:
            await asyncio.sleep(3600)
    except (KeyboardInterrupt, SystemExit):
        logger.info("Ghost Protocol shutting down.")


if __name__ == "__main__":
    asyncio.run(main())
