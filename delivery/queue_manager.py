"""
delivery/queue_manager.py — PhantmOS v2.0

Supabase-backed delivery queue with retry logic.
Processes pending deliveries and retries failures.
"""
import asyncio
import json

from core.config import DELIVERY_MAX_ATTEMPTS
from core.database_manager import (
    get_pending_deliveries,
    update_delivery_status,
    log_stage_success,
    log_stage_failure,
)
from core.logger import get_logger

logger = get_logger(__name__)

# Retry wait times between delivery attempts (seconds)
RETRY_WAITS = [10, 30, 60]


async def process_delivery_queue(profile: dict, send_fn) -> dict:
    """
    Process all pending items in the delivery queue for a specific user.

    Args:
        send_fn:     async fn(lead: dict) -> bool  — primary Telegram sender

    Returns:
        Summary dict with sent/failed counts.
    """
    logger.info("=== Stage 5: Delivery Queue processing ===")

    user_id = profile.get("id")
    pending = get_pending_deliveries(max_attempts=DELIVERY_MAX_ATTEMPTS, user_id=user_id)
    if not pending:
        logger.info("Delivery queue: nothing pending.")
        return {"sent": 0, "failed": 0, "total": 0}

    logger.info(f"Delivery queue: {len(pending)} items pending.")
    
    preferences = profile.get("preferences") or {}
    if not preferences:
        try:
            with open("settings.json", "r") as f:
                preferences = json.load(f)
        except:
            pass
    
    notifications = preferences.get("notifications", {})
    scoring = preferences.get("scoring", {})
    telegram_enabled = notifications.get("instant_telegram_alerts", True)
    telegram_threshold = scoring.get("telegram_threshold", 75)

    async def _process_item(item: dict) -> str:
        """Returns 'sent', 'skipped', or 'failed'."""
        delivery_id = item.get("id")
        lead = item.get("job_leads") or {}
        job_id = item.get("job_id", "unknown")
        match_score_pct = float(lead.get("match_score") or 0.0) * 100

        if not telegram_enabled:
            logger.info(f"Delivery: skipping {job_id} (Telegram alerts disabled).")
            update_delivery_status(delivery_id, "sent")
            return "skipped"

        if match_score_pct < telegram_threshold:
            logger.info(f"Delivery: skipping {job_id} score {match_score_pct:.1f} < threshold {telegram_threshold}.")
            update_delivery_status(delivery_id, "sent")
            return "skipped"

        ok = await _attempt_delivery(
            delivery_id=delivery_id, job_id=job_id, lead=lead,
            attempts=item.get("attempts", 0), send_fn=send_fn,
        )
        return "sent" if ok else "failed"

    # Run all deliveries CONCURRENTLY — prevents 81×30s sequential blocking
    results = await asyncio.gather(*[_process_item(i) for i in pending], return_exceptions=True)

    sent    = sum(1 for r in results if r == "sent")
    failed  = sum(1 for r in results if r == "failed" or isinstance(r, BaseException))
    skipped = sum(1 for r in results if r == "skipped")

    logger.info(f"=== Delivery complete: sent={sent} failed={failed} skipped={skipped} ===")
    return {"sent": sent, "failed": failed, "skipped": skipped, "total": len(pending)}


async def _attempt_delivery(delivery_id: str, job_id: str, lead: dict, attempts: int, send_fn) -> bool:
    """Try primary sender; update queue status based on result."""
    try:
        success = await send_fn(lead)
        if success:
            update_delivery_status(delivery_id, "sent")
            log_stage_success(job_id, "delivery")
            logger.info(f"Delivery: sent job {job_id} via Telegram.")
            return True
        raise RuntimeError("send_fn returned False")
    except Exception as e:
        new_attempts = attempts + 1
        logger.warning(f"Delivery: Telegram failed for {job_id} (attempt {new_attempts}/{DELIVERY_MAX_ATTEMPTS}): {e}")
        update_delivery_status(delivery_id, "pending", increment_attempts=True)
        if new_attempts >= DELIVERY_MAX_ATTEMPTS:
            update_delivery_status(delivery_id, "failed")
            log_stage_failure(job_id, "delivery", str(e))
        return False
