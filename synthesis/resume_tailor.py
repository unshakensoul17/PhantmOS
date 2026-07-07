"""
synthesis/resume_tailor.py — PhantmOS v2.0  (Tailor Orchestrator)

Tiered tailoring strategy based on score band:
  HOT  (85%+) → Full tailoring: company research + LLM waterfall + cold email
  WARM (60-84%)→ Light tailoring: summary only + generic email
  COLD (40-59%)→ No tailoring: send original resume as-is
  REJECT       → Never reaches this stage (dismissed in scoring)

One job failing NEVER affects others.
"""
import asyncio
import json

from core.database_manager import (
    get_leads_by_band,
    get_leads_by_status,
    update_job_lead,
    log_stage_success,
    log_stage_failure,
    queue_delivery,
)
from core.logger import get_logger
from synthesis.context_researcher import get_cached_company_context
from synthesis.prompt_builder import (
    SYSTEM_PROMPT,
    build_hot_prompt,
    build_warm_prompt,
)
from synthesis.llm_waterfall import run_waterfall
from synthesis.evaluator import evaluate_lead

logger = get_logger(__name__)

# Default email when all LLMs fail
DEFAULT_COLD_EMAIL = (
    "I came across this role and believe my background in AI/ML engineering "
    "aligns well with your team's work. "
    "I have hands-on experience with Python, PyTorch, and end-to-end ML pipelines "
    "that directly match what you're looking for. "
    "I'd love to connect — please find my resume attached."
)


async def run_tailoring(profile: dict, api_keys: dict = None) -> dict:
    """
    Run Stage 3 for all scored (HOT + WARM) leads.
    COLD leads: marked Tailored immediately with original resume.

    Args:
        profile: master user profile dict (must have resume_data).
        api_keys: optional custom keys for BYOK.

    Returns:
        Summary dict with counts.
    """
    logger.info("=== Stage 3: Resume Tailoring started ===")
    user_id = profile.get("id")
    master_resume = profile.get("resume_data", {})
    preferences = profile.get("preferences", {})
    counts = {"hot_tailored": 0, "warm_tailored": 0, "cold_queued": 0, "failed": 0}

    # ── HOT leads: full tailoring ─────────────────────────────────────────────
    hot_leads = get_leads_by_band("HOT", user_id=user_id)
    logger.info(f"HOT leads to tailor: {len(hot_leads)}")

    hot_tasks = [_tailor_hot(lead, master_resume, api_keys, user_id, preferences) for lead in hot_leads]
    hot_results = await asyncio.gather(*hot_tasks, return_exceptions=True)

    for lead, result in zip(hot_leads, hot_results):
        if isinstance(result, Exception):
            logger.error(f"HOT tailoring error for {lead.get('job_id')}: {result}")
            counts["failed"] += 1
        elif result:
            counts["hot_tailored"] += 1
        else:
            counts["failed"] += 1

    # ── WARM leads: light tailoring ───────────────────────────────────────────
    warm_leads = get_leads_by_band("WARM", user_id=user_id)
    logger.info(f"WARM leads to tailor: {len(warm_leads)}")

    warm_tasks = [_tailor_warm(lead, master_resume, api_keys, user_id, preferences) for lead in warm_leads]
    warm_results = await asyncio.gather(*warm_tasks, return_exceptions=True)

    for lead, result in zip(warm_leads, warm_results):
        if isinstance(result, Exception):
            logger.error(f"WARM tailoring error for {lead.get('job_id')}: {result}")
            counts["failed"] += 1
        elif result:
            counts["warm_tailored"] += 1
        else:
            counts["failed"] += 1

    # ── COLD leads: no tailoring — queue original resume directly ─────────────
    cold_leads = get_leads_by_band("COLD", user_id=user_id)
    logger.info(f"COLD leads (no tailoring): {len(cold_leads)}")

    for lead in cold_leads:
        job_id = lead.get("job_id")
        _mark_tailored(
            job_id=job_id,
            updated_resume=master_resume,
            cold_email=DEFAULT_COLD_EMAIL,
            changes_made=[],
            rationale="COLD match — original resume sent.",
            tailored=False,
            user_id=user_id,
        )
        counts["cold_queued"] += 1

    total = counts["hot_tailored"] + counts["warm_tailored"] + counts["cold_queued"]
    logger.info(
        f"=== Stage 3 complete: HOT={counts['hot_tailored']} "
        f"WARM={counts['warm_tailored']} COLD={counts['cold_queued']} "
        f"FAILED={counts['failed']} / {total} ==="
    )
    log_stage_success(
        None, "tailoring",
        f"HOT={counts['hot_tailored']} WARM={counts['warm_tailored']} COLD={counts['cold_queued']}"
    )
    return counts


# ── Per-lead handlers ─────────────────────────────────────────────────────────

async def _tailor_hot(lead: dict, master_resume: dict, api_keys: dict = None, user_id: str = None, preferences: dict = None) -> bool:
    """Full tailoring pipeline for a single HOT lead."""
    job_id  = lead.get("job_id") or ""
    company = lead.get("company") or ""
    title   = lead.get("title") or ""
    desc    = lead.get("raw_description") or ""

    logger.info(f"HOT: tailoring '{title}' @ {company}")

    try:
        # Company research (cached)
        context = await get_cached_company_context(company)

        # Build prompt and run waterfall
        user_prompt = build_hot_prompt(master_resume, desc, context)
        result = await run_waterfall(SYSTEM_PROMPT, user_prompt, master_resume, api_keys, preferences)

        if result:
            updated_res = result.get("updated_resume_json", master_resume)
            eval_res = await evaluate_lead(updated_res, desc, api_keys)
            
            _mark_tailored(
                job_id=job_id,
                updated_resume=updated_res,
                cold_email=result.get("cold_email", DEFAULT_COLD_EMAIL),
                changes_made=result.get("changes_made", []),
                rationale=result.get("rationale", ""),
                tailored=True,
                provider=result.get("_provider", ""),
                ats_score=eval_res.get("ats_score", 75),
                ats_feedback=eval_res.get("ats_feedback", []),
                interview_prep=eval_res.get("interview_prep", []),
                user_id=user_id,
            )
            log_stage_success(job_id, "tailoring_hot")
            return True
        else:
            # All LLMs failed — send original resume with note
            logger.warning(f"HOT: all LLMs failed for {job_id} — using original resume.")
            _mark_tailored(
                job_id=job_id,
                updated_resume=master_resume,
                cold_email=DEFAULT_COLD_EMAIL,
                changes_made=[],
                rationale="All LLMs failed — original resume sent.",
                tailored=False,
                user_id=user_id,
            )
            log_stage_failure(job_id, "tailoring_hot", "All LLMs failed")
            return False

    except Exception as e:
        logger.error(f"HOT: exception for {job_id}: {e}")
        log_stage_failure(job_id, "tailoring_hot", str(e))
        return False


async def _tailor_warm(lead: dict, master_resume: dict, api_keys: dict = None, user_id: str = None, preferences: dict = None) -> bool:
    """Light tailoring (summary + generic email) for a single WARM lead."""
    job_id = lead.get("job_id") or ""
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
            
            _mark_tailored(
                job_id=job_id,
                updated_resume=updated_res,
                cold_email=result.get("cold_email", DEFAULT_COLD_EMAIL),
                changes_made=result.get("changes_made", []),
                rationale=result.get("rationale", ""),
                tailored=True,
                provider=result.get("_provider", ""),
                ats_score=eval_res.get("ats_score", 70),
                ats_feedback=eval_res.get("ats_feedback", []),
                interview_prep=eval_res.get("interview_prep", []),
                user_id=user_id,
            )
            log_stage_success(job_id, "tailoring_warm")
            return True
        else:
            _mark_tailored(
                job_id=job_id,
                updated_resume=master_resume,
                cold_email=DEFAULT_COLD_EMAIL,
                changes_made=[],
                rationale="LLMs failed — original resume sent.",
                tailored=False,
                user_id=user_id,
            )
            log_stage_failure(job_id, "tailoring_warm", "All LLMs failed")
            return False

    except Exception as e:
        logger.error(f"WARM: exception for {job_id}: {e}")
        log_stage_failure(job_id, "tailoring_warm", str(e))
        return False


# ── DB update helper ──────────────────────────────────────────────────────────

def _mark_tailored(
    job_id: str,
    updated_resume: dict,
    cold_email: str,
    changes_made: list,
    rationale: str,
    tailored: bool,
    provider: str = "",
    ats_score: int = 70,
    ats_feedback: list = None,
    interview_prep: list = None,
    user_id: str = None,
) -> None:
    """
    Save tailoring results to DB and queue the lead for delivery.
    Notes JSON stores the full tailored resume + cold email + audit trail.
    """
    notes = json.dumps({
        "updated_resume_json": updated_resume,
        "cold_email":          cold_email,
        "changes_made":        changes_made,
        "rationale":           rationale,
        "tailored":            tailored,
        "llm_provider":        provider,
        "ats_score":           ats_score,
        "ats_feedback":        ats_feedback or [],
        "interview_prep":      interview_prep or [],
    })

    update_job_lead(job_id, {
        "status": "Tailored",
        "notes":  notes,
    }, user_id=user_id)

    # Add to delivery queue so Stage 5 picks it up
    queue_delivery(job_id, user_id)
    logger.info(f"Queued delivery for job {job_id}.")
