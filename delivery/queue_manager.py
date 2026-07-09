"""
delivery/queue_manager.py — PhantmOS v3.0

Supabase-backed delivery queue with retry logic.
Processes pending deliveries and retries failures.

Optimizations:
  - Skipped items batch-updated in one DB call (not N individual calls)
  - Active deliveries run concurrently via asyncio.gather
"""
import asyncio
import json

from core.config import DELIVERY_MAX_ATTEMPTS
from core.database_manager import (
    get_pending_deliveries,
    update_delivery_status,
    get_client,
    log_stage_success,
    log_stage_failure,
)
from core.logger import get_logger

logger = get_logger(__name__)


async def process_delivery_queue(profile: dict, send_fn) -> dict:
    """
    Process all pending items in the delivery queue for a specific user.
    Skipped items are batch-marked in a single DB call.
    Active deliveries run concurrently via asyncio.gather.
    """
    logger.info("=== Stage 5: Delivery Queue processing ===")

    user_id = profile.get("id")
    pending = get_pending_deliveries(max_attempts=DELIVERY_MAX_ATTEMPTS, user_id=user_id)
    if not pending:
        logger.info("Delivery queue: nothing pending.")
        return {"sent": 0, "failed": 0, "skipped": 0, "total": 0}

    logger.info(f"Delivery queue: {len(pending)} items pending.")

    preferences = profile.get("preferences") or {}
    if not preferences:
        try:
            with open("settings.json", "r") as f:
                preferences = json.load(f)
        except Exception:
            pass

    notifications = preferences.get("notifications", {})
    scoring = preferences.get("scoring", {})
    telegram_enabled = notifications.get("instant_telegram_alerts", True)
    telegram_threshold = float(scoring.get("telegram_threshold", 75))

    # ── Partition into skip/active in one pass ────────────────────────────────
    to_skip = []
    to_deliver = []

    for item in pending:
        lead = item.get("job_leads") or {}
        match_score_pct = float(lead.get("match_score") or 0.0) * 100

        if not telegram_enabled or match_score_pct < telegram_threshold:
            to_skip.append(item)
        else:
            to_deliver.append(item)

    # ── Batch-mark all skipped items as "sent" in ONE DB call ─────────────────
    if to_skip:
        skip_ids = [i["id"] for i in to_skip]
        logger.info(f"Delivery: batch-skipping {len(skip_ids)} items below threshold {telegram_threshold:.0f}%.")
        try:
            get_client().table("delivery_queue").update({"status": "sent"}).in_("id", skip_ids).execute()
        except Exception as e:
            logger.error(f"Delivery: batch skip update failed: {e}")

    # ── Run active deliveries concurrently ────────────────────────────────────
    sent = failed = 0
    if to_deliver:
        results = await asyncio.gather(
            *[_attempt_delivery(
                delivery_id=i["id"],
                job_id=i.get("job_id", "unknown"),
                lead=i.get("job_leads") or {},
                attempts=i.get("attempts", 0),
                send_fn=send_fn,
            ) for i in to_deliver],
            return_exceptions=True,
        )
        sent   = sum(1 for r in results if r is True)
        failed = sum(1 for r in results if r is False or isinstance(r, BaseException))

    logger.info(f"=== Delivery complete: sent={sent} failed={failed} skipped={len(to_skip)} ===")
    return {"sent": sent, "failed": failed, "skipped": len(to_skip), "total": len(pending)}


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
