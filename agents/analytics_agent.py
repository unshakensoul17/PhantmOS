"""
agents/analytics_agent.py — PhantmOS Multi-Agent Architecture

Purpose:
    Aggregates pipeline statistics, sends daily digest reports, and
    provides data for dashboard visualizations.

Responsibilities:
    - Pipeline statistics aggregation (band counts, status counts)
    - Daily summary digest generation and delivery
    - Success rate tracking
    - Application metrics
    - Dashboard statistics endpoint support

Must NOT:
    - Modify leads or resumes
    - Perform scoring or tailoring
    - Handle user feedback

Public Methods:
    get_stats(user_id)              — Aggregate pipeline stats for one user
    send_digest()                   — Send the daily digest to all users
    record(pipeline_summary)        — Log a completed pipeline run

Dependencies:
    core.database_manager, delivery.daily_digest, core.logger
"""
from core.database_manager import get_all_stats, log_stage_success
from core.logger import get_logger
from delivery.daily_digest import send_daily_digest

logger = get_logger(__name__)


class AnalyticsAgent:
    """Owns pipeline statistics, daily digests, and metrics reporting."""

    def get_stats(self, user_id: str = None) -> dict:
        """Return aggregated pipeline stats for the dashboard."""
        return get_all_stats(user_id)

    async def send_digest(self) -> bool:
        """Send the daily digest to all connected Telegram users."""
        logger.info("AnalyticsAgent: sending daily digest")
        return await send_daily_digest()

    def record(self, summary: dict) -> None:
        """Log a completed pipeline run summary."""
        users = summary.get("users_processed", 0)
        log_stage_success(
            None, "full_pipeline", f"Processed {users} users. Summary: {summary}"
        )
        logger.info(f"AnalyticsAgent: pipeline run recorded ({users} users)")
