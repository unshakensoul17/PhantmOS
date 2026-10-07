"""
synthesis/resume_tailor_impl.py — PhantmOS v3.0

On-demand LLM tailoring functions.
Called by interface/telegram_delivery.py when user clicks "Create Resume".
NOT called in the automatic pipeline anymore.
"""
import json

from core.database_manager import (
    update_job_lead,
    queue_delivery,
    log_stage_success,
    log_stage_failure,
)
from core.logger import get_logger
from synthesis.context_researcher import get_cached_company_context
from synthesis.prompt_builder import SYSTEM_PROMPT, build_hot_prompt, build_warm_prompt
from synthesis.llm_waterfall import run_waterfall
from synthesis.evaluator import evaluate_lead

logger = get_logger(__name__)

DEFAULT_COLD_EMAIL = (
    "I came across this role and believe my background in AI/ML engineering "
    "aligns well with your team's work. "
    "I have hands-on experience with Python, PyTorch, and end-to-end ML pipelines "
    "that directly match what you're looking for. "
    "I'd love to connect — please find my resume attached."
)


async def _tailor_hot(lead: dict, master_resume: dict, api_keys: dict = None, user_id: str = None, preferences: dict = None) -> bool:
    """Full tailoring pipeline for a single HOT lead (on-demand)."""
    job_id  = lead.get("job_id") or ""
    company = lead.get("company") or ""
    title   = lead.get("title") or ""
    desc    = lead.get("raw_description") or ""
    logger.info(f"HOT: tailoring '{title}' @ {company}")
    try:
        context = await get_cached_company_context(company)
        user_prompt = build_hot_prompt(master_resume, desc, context)
        result = await run_waterfall(SYSTEM_PROMPT, user_prompt, master_resume, api_keys, preferences)
        if result:
            updated_res = result.get("updated_resume_json", master_resume)
            eval_res = await evaluate_lead(updated_res, desc, api_keys)
            _mark_tailored(job_id=job_id, updated_resume=updated_res,
                cold_email=result.get("cold_email", DEFAULT_COLD_EMAIL),
                changes_made=result.get("changes_made", []),
                rationale=result.get("rationale", ""), tailored=True,
                provider=result.get("_provider", ""),
                ats_score=eval_res.get("ats_score", 75),
                ats_feedback=eval_res.get("ats_feedback", []),
                interview_prep=eval_res.get("interview_prep", []), user_id=user_id)
            log_stage_success(job_id, "tailoring_hot")
            return True
        else:
            logger.warning(f"HOT: all LLMs failed for {job_id} — using original resume.")
            _mark_tailored(job_id=job_id, updated_resume=master_resume,
                cold_email=DEFAULT_COLD_EMAIL, changes_made=[], tailored=False,
                rationale="All LLMs failed — original resume sent.", user_id=user_id)
            log_stage_failure(job_id, "tailoring_hot", "All LLMs failed")
            return False
    except Exception as e:
        logger.error(f"HOT: exception for {job_id}: {e}")
        log_stage_failure(job_id, "tailoring_hot", str(e))
        return False


async def _tailor_warm(lead: dict, master_resume: dict, api_keys: dict = None, user_id: str = None, preferences: dict = None) -> bool:
    """Light tailoring (summary + generic email) for a single WARM lead (on-demand)."""
    job_id  = lead.get("job_id") or ""
    company = lead.get("company") or ""
    title   = lead.get("title") or ""
    desc    = lead.get("raw_description") or ""
    logger.info(f"WARM: light tailoring '{title}' @ {company}")
    try:
        user_prompt = build_warm_prompt(master_resume, desc)
        result = await run_waterfall(SYSTEM_PROMPT, user_prompt, master_resume, api_keys, preferences)
        if result:
            updated_res = result.get("updated_resume_json", master_resume)
            eval_res = await evaluate_lead(updated_res, desc, api_keys)
            _mark_tailored(job_id=job_id, updated_resume=updated_res,
                cold_email=result.get("cold_email", DEFAULT_COLD_EMAIL),
                changes_made=result.get("changes_made", []),
                rationale=result.get("rationale", ""), tailored=True,
                provider=result.get("_provider", ""),
                ats_score=eval_res.get("ats_score", 70),
                ats_feedback=eval_res.get("ats_feedback", []),
                interview_prep=eval_res.get("interview_prep", []), user_id=user_id)
            log_stage_success(job_id, "tailoring_warm")
            return True
        else:
            _mark_tailored(job_id=job_id, updated_resume=master_resume,
                cold_email=DEFAULT_COLD_EMAIL, changes_made=[], tailored=False,
                rationale="LLMs failed — original resume sent.", user_id=user_id)
            log_stage_failure(job_id, "tailoring_warm", "All LLMs failed")
            return False
    except Exception as e:
        logger.error(f"WARM: exception for {job_id}: {e}")
        log_stage_failure(job_id, "tailoring_warm", str(e))
        return False


def _mark_tailored(job_id, updated_resume, cold_email, changes_made, rationale,
                   tailored, provider="", ats_score=70, ats_feedback=None,
                   interview_prep=None, user_id=None) -> None:
    notes = json.dumps({
        "updated_resume_json": updated_resume, "cold_email": cold_email,
        "changes_made": changes_made, "rationale": rationale, "tailored": tailored,
        "llm_provider": provider, "ats_score": ats_score,
        "ats_feedback": ats_feedback or [], "interview_prep": interview_prep or [],
    })
    update_job_lead(job_id, {"status": "Tailored", "notes": notes}, user_id=user_id)
    queue_delivery(job_id, user_id)
    logger.info(f"Queued delivery for job {job_id}.")
