"""
agents/feedback_agent.py — PhantmOS Multi-Agent Architecture

Purpose:
    Records and processes user feedback signals from Telegram button
    interactions, adjusting scoring preferences for future pipeline runs.

Responsibilities:
    - Recording apply/skip/review actions
    - Tracking skip reasons
    - Application outcome recording
    - Updating scoring weight preferences
    - Providing skip reason options for UI

Must NOT:
    - Score jobs directly
    - Modify resumes
    - Send notifications

Public Methods:
    record_apply(job_id)              — Mark job as Applied
    record_skip(job_id, reason)       — Dismiss job + adjust weights
    record_review(job_id)             — Log review action
    get_skip_reasons()                — Return available skip reason options

Dependencies:
    delivery.feedback_processor, core.database_manager
"""
from core.logger import get_logger
from delivery.feedback_processor import (
    handle_apply,
    handle_review,
    handle_skip,
    get_skip_reasons as _get_skip_reasons,
)

logger = get_logger(__name__)


class FeedbackAgent:
    """Owns user feedback recording and scoring preference adjustment."""

    async def record_apply(self, job_id: str) -> None:
        """Record that the user applied to this job."""
        await handle_apply(job_id)
        logger.info(f"FeedbackAgent: recorded apply for {job_id}")

    async def record_skip(self, job_id: str, reason: str = "") -> None:
        """Record a skip signal, dismiss the lead, and adjust scoring weights."""
        await handle_skip(job_id, reason)
        logger.info(f"FeedbackAgent: recorded skip for {job_id} (reason={reason})")

    async def record_review(self, job_id: str) -> None:
        """Record that the user reviewed this job."""
        await handle_review(job_id)
        logger.info(f"FeedbackAgent: recorded review for {job_id}")

    @staticmethod
    def get_skip_reasons() -> list[dict]:
        """Return the list of skip reason options for Telegram inline keyboard."""
        return _get_skip_reasons()
