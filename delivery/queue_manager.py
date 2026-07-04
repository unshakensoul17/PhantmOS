"""
delivery/queue_manager.py — Ghost Protocol v2.0

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
    
    # Extract settings from profile
    preferences = profile.get("preferences") or {}
    
    # Fallback to legacy settings.json
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

    sent = failed = 0

    for item in pending:
        delivery_id = item.get("id")
        # job_leads data is joined in get_pending_deliveries
        lead = item.get("job_leads") or {}
        job_id = item.get("job_id", "unknown")
        
        # Check settings guardrails
        match_score_raw = lead.get("match_score", 0.0)
        # handle case if match_score is None
        if match_score_raw is None: match_score_raw = 0.0
        match_score_pct = float(match_score_raw) * 100

        if not telegram_enabled:
            logger.info(f"Delivery: skipping {job_id} because Telegram alerts are disabled.")
            update_delivery_status(delivery_id, "sent")
            continue
            
        if match_score_pct < telegram_threshold:
            logger.info(f"Delivery: skipping {job_id} because score {match_score_pct:.1f} < threshold {telegram_threshold}.")
            update_delivery_status(delivery_id, "sent")
            continue

        success = await _attempt_delivery(
            delivery_id=delivery_id,
            job_id=job_id,
            lead=lead,
            attempts=item.get("attempts", 0),
            send_fn=send_fn,
        )

        if success:
            sent += 1
        else:
            failed += 1

    logger.info(f"=== Delivery complete: sent={sent} failed={failed} ===")
    return {"sent": sent, "failed": failed, "total": sent + failed}


async def _attempt_delivery(
    delivery_id: str,
    job_id: str,
    lead: dict,
    attempts: int,
    send_fn,
) -> bool:
    """
    Try primary sender.
    """
    try:
        success = await send_fn(lead)
        if success:
            update_delivery_status(delivery_id, "sent")
            log_stage_success(job_id, "delivery")
            logger.info(f"Delivery: sent job {job_id} via Telegram.")
            return True
        else:
            raise RuntimeError("send_fn returned False")

    except Exception as e:
        new_attempts = attempts + 1
        logger.warning(
            f"Delivery: Telegram failed for {job_id} "
            f"(attempt {new_attempts}/{DELIVERY_MAX_ATTEMPTS}): {e}"
        )
        update_delivery_status(delivery_id, "pending", increment_attempts=True)

        if new_attempts >= DELIVERY_MAX_ATTEMPTS:
            update_delivery_status(delivery_id, "failed")
            log_stage_failure(job_id, "delivery", str(e))
            return False

        # Not yet exhausted — will retry on next queue run
        return False
