"""
agents/resume_agent.py — Ghost Protocol Multi-Agent Architecture

Purpose:
    Encapsulates all LLM interactions: prompt construction, resume tailoring
    via the waterfall chain, cold email generation, and output validation.

Responsibilities:
    - Prompt construction (HOT full tailor, WARM light tailor)
    - LLM waterfall execution (Gemini → Groq → HuggingFace → fallback)
    - Output validation (JSON structure, hallucination check, bullet limits)
    - Cold email generation (exactly 3 sentences)
    - Resume version management (persist tailored JSON to DB notes)
    - Tiered strategy: HOT=full, WARM=light, COLD=skip

Must NOT:
    - Score jobs (ranking_agent's job)
    - Generate PDFs (application_agent's job)
    - Send notifications (application_agent's job)

Public Methods:
    run(profile, api_keys)  — Tailor all scored leads for this user

Dependencies:
    synthesis.resume_tailor, synthesis.llm_waterfall, synthesis.prompt_builder,
    synthesis.output_validator, core.database_manager
"""
from core.logger import get_logger
from synthesis.resume_tailor import run_tailoring

logger = get_logger(__name__)


class ResumeAgent:
    """Owns all LLM-based resume tailoring & cold email synthesis (Stage 3)."""

    async def run(self, profile: dict, api_keys: dict = None) -> dict:
        """
        Tailor HOT/WARM/COLD leads for the user.
        Returns summary: {hot_tailored, warm_tailored, cold_queued, failed}.
        """
        logger.info(f"ResumeAgent: tailoring for user {profile.get('id')}")
        try:
            return await run_tailoring(profile, api_keys)
        except Exception as e:
            logger.error(f"ResumeAgent: tailoring failed — {e}")
            return {"hot_tailored": 0, "warm_tailored": 0, "cold_queued": 0, "failed": 0}
