"""
agents/ats_agent.py — PhantmOS Multi-Agent Architecture

Purpose:
    Evaluates tailored resumes against job descriptions to produce ATS
    compatibility scores, quality feedback, and interview prep questions.

Responsibilities:
    - ATS score generation (0-100)
    - Resume quality checks via LLM
    - Keyword gap / missing skills detection
    - Interview prep question generation
    - Resume improvement suggestions

Must NOT:
    - Modify resumes directly (read-only evaluation)
    - Send notifications
    - Research companies

Public Methods:
    evaluate(resume_data, jd_text, api_keys) — Score + feedback for one lead
    run(profile, api_keys) — Batch-evaluate all Tailored leads

Dependencies:
    synthesis.evaluator, core.database_manager
"""
import json

from core.database_manager import get_leads_by_status, update_job_lead
from core.logger import get_logger
from synthesis.evaluator import evaluate_lead

logger = get_logger(__name__)


class ATSAgent:
    """Owns ATS scoring, quality checks, and interview prep (read-only analysis)."""

    async def evaluate(
        self, resume_data: dict, jd_text: str, api_keys: dict = None
    ) -> dict:
        """
        Evaluate a single resume against a JD.
        Returns {ats_score, ats_feedback, interview_prep}.
        """
        return await evaluate_lead(resume_data, jd_text, api_keys)

    async def run(self, profile: dict, api_keys: dict = None) -> dict:
        """
        Batch-evaluate all Tailored leads that don't yet have an ATS score.
        Writes results into the lead's notes JSON.
        Returns summary: {evaluated, skipped, failed}.
        """
        user_id = profile.get("id")
        leads = get_leads_by_status("Tailored", limit=200, user_id=user_id)
        evaluated = skipped = failed = 0

        for lead in leads:
            notes_raw = lead.get("notes") or "{}"
            try:
                notes = json.loads(notes_raw)
            except Exception:
                notes = {}

            # Skip if already evaluated
            if notes.get("ats_score") and notes.get("ats_score") != 70:
                skipped += 1
                continue

            jd = lead.get("raw_description", "")
            resume = notes.get("updated_resume_json") or profile.get("resume_data", {})

            try:
                result = await evaluate_lead(resume, jd, api_keys)
                notes["ats_score"] = result.get("ats_score", 70)
                notes["ats_feedback"] = result.get("ats_feedback", [])
                notes["interview_prep"] = result.get("interview_prep", [])
                update_job_lead(
                    lead["job_id"], {"notes": json.dumps(notes)}, user_id=user_id
                )
                evaluated += 1
            except Exception as e:
                logger.error(f"ATSAgent: evaluation failed for {lead.get('job_id')}: {e}")
                failed += 1

        logger.info(
            f"ATSAgent: evaluated={evaluated} skipped={skipped} failed={failed}"
        )
        return {"evaluated": evaluated, "skipped": skipped, "failed": failed}
