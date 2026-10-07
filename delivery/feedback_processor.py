"""
delivery/feedback_processor.py — PhantmOS v2.0

Handles user feedback signals (skip/apply/review) from Telegram buttons.
Stores feedback to DB and adjusts scoring weight preferences.
"""

from core.config import SKIP_REASON_WEIGHTS
from core.database_manager import (
    store_feedback,
    update_job_lead,
)
from core.logger import get_logger

logger = get_logger(__name__)

# DB column to store per-user scoring prefs (stored in user_profiles.tech_stack JSONB)
PREFS_KEY = "scoring_adjustments"


async def handle_apply(job_id: str, user_id: str = None) -> None:
    """Record that the user applied to this job."""
    store_feedback(job_id, "apply", user_id=user_id)
    update_job_lead(job_id, {"status": "Applied"}, user_id=user_id)
    logger.info(f"Feedback: applied to {job_id} (user={user_id}).")


async def handle_review(job_id: str, user_id: str = None) -> None:
    """Record that the user reviewed this job (no status change)."""
    store_feedback(job_id, "review", user_id=user_id)
    logger.info(f"Feedback: reviewed {job_id} (user={user_id}).")


async def handle_skip(job_id: str, reason: str = "", user_id: str = None) -> None:
    """
    Record a skip signal and adjust future scoring weights.
    reason should be one of: too_junior, wrong_stack, bad_company,
                              wrong_location, not_interested
    """
    store_feedback(job_id, "skip", reason, user_id=user_id)
    update_job_lead(job_id, {"status": "Dismissed"}, user_id=user_id)
    logger.info(f"Feedback: dismissed {job_id} (reason='{reason}', user={user_id}).")

    if reason and reason in SKIP_REASON_WEIGHTS and user_id:
        await _adjust_weights(reason, user_id)


async def _adjust_weights(skip_reason: str, user_id: str) -> None:
    """
    Apply the weight adjustment for the given skip reason.
    Stored in user_profiles.preferences under scoring['scoring_adjustments'].
    """
    adjustments = SKIP_REASON_WEIGHTS.get(skip_reason, {})
    if not adjustments or not user_id:
        return

    try:
        from core.database_manager import get_profile, update_profile

        profile = get_profile(user_id)
        if not profile:
            return

        prefs = profile.get("preferences") or {}
        scoring = prefs.get("scoring") or {}
        scoring_adjustments = scoring.get(PREFS_KEY, {})

        for key, val in adjustments.items():
            if isinstance(val, bool):
                scoring_adjustments[key] = val
            else:
                scoring_adjustments[key] = round(scoring_adjustments.get(key, 0) + val, 4)

        scoring[PREFS_KEY] = scoring_adjustments
        prefs["scoring"] = scoring
        update_profile({"preferences": prefs}, user_id=user_id)

        logger.info(
            f"Feedback: scoring prefs updated for user {user_id} (reason='{skip_reason}'): {scoring_adjustments}"
        )
    except Exception as e:
        logger.error(f"Feedback: failed to update scoring prefs for {user_id}: {e}")


def get_skip_reasons() -> list[dict]:
    """Return the list of skip reason options for the Telegram inline keyboard."""
    return [
        {"label": "Too junior", "value": "too_junior"},
        {"label": "Wrong stack", "value": "wrong_stack"},
        {"label": "Bad company", "value": "bad_company"},
        {"label": "Wrong location", "value": "wrong_location"},
        {"label": "Not interested", "value": "not_interested"},
    ]
