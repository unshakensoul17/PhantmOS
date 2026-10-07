"""
delivery/whatsapp_fallback.py — Ghost Protocol v2.0

CallMeBot WhatsApp fallback sender.
Free, no account required — one-time activation only.

Activation (one-time manual step):
  Send "I allow callmebot to send me messages" to +34 644 597 071 on WhatsApp.
  They reply with your API key. Put it in .env as CALLMEBOT_API_KEY.

API reference: https://www.callmebot.com/blog/free-api-whatsapp-messages/
"""
import urllib.parse
import httpx

from core.config import CALLMEBOT_API_KEY, CALLMEBOT_PHONE
from core.logger import get_logger

logger = get_logger(__name__)

CALLMEBOT_URL = "https://api.callmebot.com/whatsapp.php"


async def send_whatsapp_alert(message: str) -> bool:
    """
    Send a plain-text WhatsApp message via CallMeBot.
    Returns True on success, False on failure.
    """
    if not CALLMEBOT_API_KEY or not CALLMEBOT_PHONE:
        logger.warning(
            "WhatsApp fallback: CALLMEBOT_API_KEY or CALLMEBOT_PHONE not set. "
            "Skipping."
        )
        return False

    encoded_msg = urllib.parse.quote(message[:1000])   # CallMeBot limit

    url = (
        f"{CALLMEBOT_URL}"
        f"?phone={CALLMEBOT_PHONE}"
        f"&text={encoded_msg}"
        f"&apikey={CALLMEBOT_API_KEY}"
    )

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            logger.info(f"WhatsApp fallback: message sent ({resp.status_code}).")
            return True
    except Exception as e:
        logger.error(f"WhatsApp fallback: failed to send — {e}")
        return False


async def send_whatsapp_job_alert(lead: dict) -> bool:
    """
    Send a condensed job alert via WhatsApp (fallback for failed Telegram delivery).
    """
    company = lead.get("company", "Unknown")
    title   = lead.get("title", "Unknown Role")
    score   = (lead.get("match_score") or 0) * 100
    band    = lead.get("score_band", "")
    url     = lead.get("job_url", "")

    message = (
        f"Ghost Protocol Alert\n"
        f"{band} LEAD: {score:.0f}% Match\n"
        f"{title} @ {company}\n"
        f"Apply: {url}"
    )

    return await send_whatsapp_alert(message)
