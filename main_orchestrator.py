"""
main_orchestrator.py — PhantmOS v3.0 (Multi-Agent Architecture)

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

from core.config import DEFAULT_TIMEZONE, DIGEST_HOUR, DIGEST_MINUTE
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
from global_harvester import run_global_harvest

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
    Full end-to-end PhantmOS pipeline.
    Coordinates agents in sequence — contains no business logic itself.
    """
    logger.info("\n========================================")
    logger.info("  PHANTMOS v3.0 — Pipeline Start")
    logger.info(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("========================================\n")

    summary = {}

    # STAGE 1 (Discovery) is now handled globally by global_harvester.py,
    # and locally per-user via run_for_user() inside the loop.

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
        
        # Scheduler check
        if not manual_query and not target_user_id:
            import time
            prefs = profile.get("preferences") or {}
            sched_prefs = prefs.get("scheduler") or {}
            try:
                freq = float(sched_prefs.get("frequency_hours", 4))
            except (ValueError, TypeError):
                freq = 4.0
                
            try:
                last_run = float(sched_prefs.get("last_run_timestamp", 0))
            except (ValueError, TypeError):
                last_run = 0.0
                
            now = time.time()
            
            pause_weekends = sched_prefs.get("pause_weekends", False)
            if pause_weekends and datetime.now().weekday() >= 5:
                continue
                
            if now - last_run < (freq * 3600):
                continue
                
            # Update last run timestamp
            sched_prefs["last_run_timestamp"] = now
            prefs["scheduler"] = sched_prefs
            from core.database_manager import update_profile
            update_profile({"preferences": prefs}, user_id=user_id)
            
        logger.info(f"\n>>> Processing pipeline for user: {email} ({user_id})")

        user_summary = {}

        # ── Check Credits & BYOK keys ─────────────────────────────────────────
        api_keys = _resolve_api_keys(profile)
        credits = profile.get("credits", 0) or 0
        has_byok = bool(api_keys)

        if credits <= 0 and not has_byok:
            logger.warning(f"User {user_id} has no credits and no BYOK — skipping LLM pipeline.")
            
            # BUG-13 fix: Alert the user via Telegram that they are out of credits
            try:
                from interface.telegram_delivery import bot
                chat_id = profile.get("telegram_chat_id")
                if bot and chat_id:
                    msg = "⚠️ *Pipeline Paused: Out of Credits*\n\nYou have 0 credits remaining and no personal API keys configured. Please upgrade your plan or add your API keys in the dashboard to resume job discovery."
                    await bot.send_message(chat_id=chat_id, text=msg, parse_mode="Markdown")
            except Exception as e:
                logger.error(f"Failed to send credit alert to {user_id}: {e}")

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

        # ── STAGE 1: Local Discovery Agent ──────────────────────────────────────────
        try:
            logger.info(f"User {user_id}: >>> STAGE 1: Local Discovery Agent")
            
            # Use manual query if provided, otherwise fallback to profile's target role
            query = manual_query
            if not query:
                prefs = profile.get("preferences", {})
                target_roles = prefs.get("scoring", {}).get("target_roles", [])
                resume_role = profile.get("resume_data", {}).get("target_role")
                if target_roles:
                    query = target_roles[0]
                elif resume_role:
                    query = resume_role
                    
            if not query:
                logger.warning(f"User {user_id} has no target roles or resume role. Skipping harvest.")
                user_summary["harvest"] = {"skipped": "No search query available (please set target roles in UI)."}
                summary["details"][user_id] = user_summary
                continue
                    
            raw_jobs = await discovery_agent.run_for_user(search_query=query, user_id=user_id)
            
            logger.info(f"User {user_id}: >>> STAGE 1.5: Saving & Deduplicating")
            saved = discovery_agent.save_leads(raw_jobs, user_id)
            user_summary["harvest"] = {"new_saved": saved, "raw_fetched": len(raw_jobs)}
        except Exception as e:
            logger.error(f"User {user_id} Stage 1 FAILED: {e}")
            user_summary["harvest"] = {"error": str(e)}
            summary["details"][user_id] = user_summary
            continue

        # ── STAGE 2: Ranking Agent ────────────────────────────────────────────
        try:
            logger.info(f"User {user_id}: >>> STAGE 2: Ranking Agent")
            user_summary["scoring"] = await ranking_agent.run(profile, manual_query=manual_query)
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

        # ── STAGE 5: Application Agent (Delivery Queue) ───────────────────────────
        try:
            logger.info(f"User {user_id}: >>> STAGE 5: Application Agent (Delivery)")
            user_summary["delivery"] = await application_agent.process_deliveries(profile)
        except Exception as e:
            logger.error(f"User {user_id} Stage 5 FAILED: {e}")
            user_summary["delivery"] = {"error": str(e)}
            
        summary["details"][user_id] = user_summary

    # ── Record pipeline run ───────────────────────────────────────────────────
    logger.info("\n========================================")
    logger.info("  PHANTMOS v3.0 — Pipeline Done")
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
    """Wrapper to run the pipeline."""
    # Delay is removed since the cron is now running frequently, 
    # and stagger is naturally handled if we process sequentially.
    await process_pipeline()


async def _scheduled_digest():
    """Daily digest wrapper — delegates to AnalyticsAgent."""
    await analytics_agent.send_digest()


async def _scheduled_global_harvest():
    """Wrapper to run the background global job harvester."""
    await run_global_harvest()


async def main():
    """Initialise and start APScheduler in a pure asyncio loop."""
    scheduler = AsyncIOScheduler(timezone=DEFAULT_TIMEZONE)

    # Run the pipeline every hour. The process_pipeline function will 
    # internally skip users whose frequency_hours haven't elapsed.
    scheduler.add_job(
        _scheduled_pipeline, "interval",
        hours=1,
        id="hourly_pipeline",
    )
    logger.info("Scheduled pipeline check to run every 1 hour.")

    scheduler.add_job(
        _scheduled_digest, "cron",
        hour=DIGEST_HOUR, minute=DIGEST_MINUTE,
        id="daily_digest",
    )
    logger.info(f"Scheduled daily digest at {DIGEST_HOUR:02d}:{DIGEST_MINUTE:02d} {DEFAULT_TIMEZONE}")

    # BUG-12 fix: schedule global harvester
    scheduler.add_job(
        _scheduled_global_harvest, "interval",
        hours=4,
        id="global_harvest",
    )
    logger.info("Scheduled global harvester to run every 4 hours.")

    scheduler.start()
    logger.info("PhantmOS v3.0 Scheduler active. Waiting…")

    try:
        while True:
            await asyncio.sleep(3600)
    except (KeyboardInterrupt, SystemExit):
        logger.info("PhantmOS shutting down.")


if __name__ == "__main__":
    asyncio.run(main())
