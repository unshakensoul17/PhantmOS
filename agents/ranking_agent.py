"""
agents/ranking_agent.py — PhantmOS Multi-Agent Architecture

Purpose:
    Scores discovered jobs against the user's resume using a multi-signal
    weighted formula, then classifies each into HOT/WARM/COLD/REJECT bands.

Responsibilities:
    - Embedding generation (Jina AI primary, local fallback)
    - Semantic similarity scoring (50% weight)
    - Keyword overlap scoring (30% weight)
    - Title match scoring (20% weight)
    - Final weighted composite score (0-100)
    - Band classification: HOT >= 85, WARM >= 60, COLD >= 40, REJECT < 40
    - Persisting scores and bands to DB

Must NOT:
    - Modify resumes
    - Research companies
    - Send notifications

Public Methods:
    run(profile)  — Score all 'Found' leads for this user, persist results

Dependencies:
    intelligence.scorer, intelligence.embedding_engine, core.database_manager
"""
from core.logger import get_logger
from intelligence.scorer import run_scoring

logger = get_logger(__name__)


class RankingAgent:
    """Owns the scoring & band classification pipeline (Stage 2)."""

    async def run(self, profile: dict) -> dict:
        """
        Score all 'Found' leads for the given user profile.
        Returns summary dict with band counts: {hot, warm, cold, reject, total}.
        """
        logger.info(f"RankingAgent: scoring leads for user {profile.get('id')}")
        try:
            return await run_scoring(profile)
        except Exception as e:
            import traceback
            logger.error(f"RankingAgent: scoring failed — {e}")
            logger.error(traceback.format_exc())
            return {"hot": 0, "warm": 0, "cold": 0, "reject": 0, "total": 0}
