"""
delivery/queue_manager.py — Ghost Protocol v2.0

Supabase-backed delivery queue with retry logic.
Processes pending deliveries, retries failures, falls back to WhatsApp.
"""
import asyncio

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


async def process_delivery_queue(send_fn, fallback_fn=None) -> dict:
    """
    Process all pending items in the delivery queue.

    Args:
        send_fn:     async fn(lead: dict) -> bool  — primary Telegram sender
        fallback_fn: async fn(lead: dict) -> bool  — WhatsApp fallback (optional)

    Returns:
        Summary dict with sent/failed counts.
    """
    logger.info("=== Stage 5: Delivery Queue processing ===")

    pending = get_pending_deliveries(max_attempts=DELIVERY_MAX_ATTEMPTS)
    if not pending:
        logger.info("Delivery queue: nothing pending.")
        return {"sent": 0, "failed": 0, "total": 0}

    logger.info(f"Delivery queue: {len(pending)} items pending.")
    sent = failed = 0

    for item in pending:
        delivery_id = item.get("id")
        # job_leads data is joined in get_pending_deliveries
        lead = item.get("job_leads") or {}
        job_id = item.get("job_id", "unknown")

        success = await _attempt_delivery(
            delivery_id=delivery_id,
            job_id=job_id,
            lead=lead,
            attempts=item.get("attempts", 0),
            send_fn=send_fn,
            fallback_fn=fallback_fn,
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
    fallback_fn,
) -> bool:
    """
    Try primary sender → if fails and attempts exhausted → try fallback.
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
            # Exhausted all Telegram retries → try WhatsApp fallback
            if fallback_fn:
                try:
                    logger.warning(f"Delivery: falling back to WhatsApp for {job_id}.")
                    await fallback_fn(lead)
                    update_delivery_status(delivery_id, "sent")
                    log_stage_success(job_id, "delivery_whatsapp_fallback")
                    return True
                except Exception as fb_e:
                    logger.error(f"Delivery: WhatsApp fallback also failed for {job_id}: {fb_e}")

            update_delivery_status(delivery_id, "failed")
            log_stage_failure(job_id, "delivery", str(e))
            return False

        # Not yet exhausted — will retry on next queue run
        return False
