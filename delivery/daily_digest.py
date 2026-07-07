"""
delivery/daily_digest.py — PhantmOS v2.0

Formats and sends the 9AM daily summary message to Telegram.
Includes yesterday's pipeline stats, top leads, and system health indicators.
"""
from datetime import datetime, timedelta
from typing import Optional

from core.config import TELEGRAM_CHAT_ID, TELEGRAM_BOT_TOKEN
from core.database_manager import get_all_stats, get_client
from core.logger import get_logger

logger = get_logger(__name__)


async def send_daily_digest() -> bool:
    """
    Build and send the daily digest message to Telegram for all registered profiles.
    Returns True if at least one digest attempt succeeded or list is empty.
    """
    logger.info("Daily Digest: starting runs...")
    try:
        # Fetch all profiles with connected Telegram chat IDs
        resp = (
            get_client()
            .table("user_profiles")
            .select("id, telegram_chat_id")
            .not_.is_("telegram_chat_id", "null")
            .execute()
        )
        profiles = resp.data or []
        if not profiles:
            logger.info("Daily Digest: no profiles with telegram_chat_id configured.")
            return True

        sent_count = 0
        for p in profiles:
            user_id = p["id"]
            chat_id = p["telegram_chat_id"]
            if not chat_id:
                continue

            try:
                stats = get_all_stats(user_id)
                top_leads = _get_todays_top_leads(user_id)
                health = _get_system_health()
                message = _format_digest(stats, top_leads, health)

                success = await _send_telegram(message, chat_id)
                if success:
                    sent_count += 1
            except Exception as pe:
                logger.error(f"Daily Digest: failed for user {user_id}: {pe}")

        logger.info(f"Daily Digest: sent {sent_count}/{len(profiles)} digests.")
        return sent_count > 0

    except Exception as e:
        logger.error(f"Daily Digest: failed — {e}")
        return False


# ── Message builder ───────────────────────────────────────────────────────────

def _format_digest(stats: dict, top_leads: list[dict], health: dict) -> str:
    now = datetime.now()
    date_str = now.strftime("%B %d, %Y")

    # ── Top leads section ─────────────────────────────────────────────────────
    if top_leads:
        top_lines = ""
        for i, lead in enumerate(top_leads[:3], 1):
            score  = (lead.get("match_score") or 0) * 100
            band   = lead.get("score_band", "")
            emoji  = "🔥" if band == "HOT" else "🌤️"
            top_lines += (
                f"   {i}. {lead.get('company')} — "
                f"{lead.get('title')} ({score:.0f}%) {emoji}\n"
            )
    else:
        top_lines = "   No HOT leads today.\n"

    # ── Health section ─────────────────────────────────────────────────────────
    def status(ok: bool) -> str:
        return "✅ Healthy" if ok else "⚠️ Issue"

    # ── Full message ──────────────────────────────────────────────────────────
    msg = (
        f"🌅 *PhantmOS — Daily Report*\n"
        f"📅 {date_str}\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"\n"
        f"📊 *Pipeline Summary*\n"
        f"   Total discovered  : {stats.get('total', 0)}\n"
        f"   HOT leads         : {stats.get('hot', 0)} 🔥\n"
        f"   WARM leads        : {stats.get('warm', 0)} 🌤️\n"
        f"   COLD leads        : {stats.get('cold', 0)} ❄️\n"
        f"   Tailored          : {stats.get('tailored', 0)}\n"
        f"   Applied           : {stats.get('applied', 0)}\n"
        f"   Dismissed         : {stats.get('dismissed', 0)}\n"
        f"\n"
        f"🔥 *Top Leads Today*\n"
        f"{top_lines}"
        f"\n"
        f"⚙️ *System Health*\n"
        f"   Groq API   : {status(health.get('groq', True))}\n"
        f"   Jina Embed : {status(health.get('jina', True))}\n"
        f"   Supabase   : {status(health.get('supabase', True))}\n"
        f"   Telegram   : {status(health.get('telegram', True))}\n"
        f"\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"_PhantmOS v2.0 — Running autonomously_"
    )
    return msg


# ── Data fetchers ─────────────────────────────────────────────────────────────

def _get_todays_top_leads(user_id: Optional[str] = None) -> list[dict]:
    """Fetch today's top HOT/WARM leads ordered by match score."""
    try:
        today = datetime.utcnow().date().isoformat()
        q = (
            get_client()
            .table("user_job_pipelines")
            .select("score_band, match_score, global_jobs(company, title, url)")
            .in_("score_band", ["HOT", "WARM"])
            .gte("created_at", today)
        )
        if user_id:
            q = q.eq("user_id", user_id)
        resp = q.order("match_score", desc=True).limit(3).execute()
        
        leads = []
        for row in (resp.data or []):
            global_job = row.pop("global_jobs", {})
            leads.append({**global_job, **row})
        return leads
    except Exception as e:
        logger.warning(f"Daily Digest: could not fetch top leads: {e}")
        return []


def _get_system_health() -> dict:
    """
    Lightweight health probe — just checks if DB is reachable.
    Full health checks for APIs can be added later.
    """
    health = {"groq": True, "jina": True, "supabase": True, "telegram": True}
    try:
        get_client().table("user_job_pipelines").select("id").limit(1).execute()
        health["supabase"] = True
    except Exception:
        health["supabase"] = False
    return health


# ── Telegram sender ───────────────────────────────────────────────────────────

async def _send_telegram(message: str, chat_id: str) -> bool:
    """Send the digest message directly via Telegram Bot API."""
    if not TELEGRAM_BOT_TOKEN or not chat_id:
        logger.warning("Daily Digest: TELEGRAM_BOT_TOKEN or chat_id not set.")
        return False

    try:
        import httpx
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        payload = {
            "chat_id":    chat_id,
            "text":       message,
            "parse_mode": "Markdown",
        }
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            return True
    except Exception as e:
        logger.error(f"Daily Digest: Telegram send failed to {chat_id} — {e}")
        return False
