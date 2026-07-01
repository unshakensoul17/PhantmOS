"""
delivery/feedback_processor.py — Ghost Protocol v2.0

Handles user feedback signals (skip/apply/review) from Telegram buttons.
Stores feedback to DB and adjusts scoring weight preferences.
"""
import json

from core.config import SKIP_REASON_WEIGHTS
from core.database_manager import (
    store_feedback,
    update_job_lead,
    get_client,
)
from core.logger import get_logger

logger = get_logger(__name__)

# DB column to store per-user scoring prefs (stored in user_profiles.tech_stack JSONB)
PREFS_KEY = "scoring_adjustments"


async def handle_apply(job_id: str) -> None:
    """Record that the user applied to this job."""
    store_feedback(job_id, "apply")
    update_job_lead(job_id, {"status": "Applied"})
    logger.info(f"Feedback: applied to {job_id}.")


async def handle_review(job_id: str) -> None:
    """Record that the user reviewed this job (no status change)."""
    store_feedback(job_id, "review")
    logger.info(f"Feedback: reviewed {job_id}.")


async def handle_skip(job_id: str, reason: str = "") -> None:
    """
    Record a skip signal and adjust future scoring weights.
    reason should be one of: too_junior, wrong_stack, bad_company,
                              wrong_location, not_interested
    """
    store_feedback(job_id, "skip", reason)
    update_job_lead(job_id, {"status": "Dismissed"})
    logger.info(f"Feedback: dismissed {job_id} (reason='{reason}').")

    if reason and reason in SKIP_REASON_WEIGHTS:
        await _adjust_weights(reason)


async def _adjust_weights(skip_reason: str) -> None:
    """
    Apply the weight adjustment for the given skip reason.
    Stored in user_profiles.tech_stack JSONB under 'scoring_adjustments'.
    """
    adjustments = SKIP_REASON_WEIGHTS.get(skip_reason, {})
    if not adjustments:
        return

    try:
        client = get_client()
        resp = client.table("user_profiles").select("tech_stack").limit(1).execute()
        if not resp.data:
            return

        tech_stack = resp.data[0].get("tech_stack") or {}
        if isinstance(tech_stack, str):
            tech_stack = json.loads(tech_stack)

        # Merge adjustments into the scoring_adjustments sub-key
        prefs = tech_stack.get(PREFS_KEY, {})
        for key, val in adjustments.items():
            if isinstance(val, bool):
                prefs[key] = val
            else:
                # Accumulate numeric adjustments
                prefs[key] = round(prefs.get(key, 0) + val, 4)

        tech_stack[PREFS_KEY] = prefs
        client.table("user_profiles").update(
            {"tech_stack": tech_stack}
        ).eq("id", resp.data[0].get("id", "")).execute()

        logger.info(f"Feedback: scoring prefs updated for reason '{skip_reason}': {prefs}")
    except Exception as e:
        logger.error(f"Feedback: failed to update scoring prefs: {e}")


def get_skip_reasons() -> list[dict]:
    """Return the list of skip reason options for the Telegram inline keyboard."""
    return [
        {"label": "Too junior",      "value": "too_junior"},
        {"label": "Wrong stack",     "value": "wrong_stack"},
        {"label": "Bad company",     "value": "bad_company"},
        {"label": "Wrong location",  "value": "wrong_location"},
        {"label": "Not interested",  "value": "not_interested"},
    ]
