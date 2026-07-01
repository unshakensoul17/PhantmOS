"""
intelligence/scorer.py — Ghost Protocol v2.0

Multi-signal job scoring engine:
  Signal 1 — Semantic similarity  (50%) via embedding cosine distance
  Signal 2 — Keyword overlap      (30%) fast word-set intersection
  Signal 3 — Title match          (20%) target title list check

Final score is 0–100. Band assigned as HOT / WARM / COLD / REJECT.
"""
import asyncio
import json
from typing import Optional

from core.config import (
    SCORE_WEIGHTS,
    BAND_THRESHOLDS,
    TARGET_TITLES,
)
from core.database_manager import (
    update_job_lead,
    get_leads_by_status,
    log_stage_success,
    log_stage_failure,
)
from core.logger import get_logger
from intelligence.embedding_engine import (
    embed_text_async,
    cosine_similarity,
    get_master_embedding,
)

logger = get_logger(__name__)


# ─────────────────────────────────────────────────────────
#  Core scoring functions
# ─────────────────────────────────────────────────────────

def _keyword_score(job_description: str, resume_skills: list[str]) -> float:
    """
    Fraction of resume skills/keywords found in the job description.
    Normalized to [0, 1], capped at 1.0.
    """
    if not resume_skills:
        return 0.0

    jd_words = set(job_description.lower().split())
    resume_words = {s.lower() for s in resume_skills}

    hits    = len(jd_words & resume_words)
    overlap = hits / len(resume_words)
    return min(overlap * 2.0, 1.0)   # ×2 so 50% overlap = perfect score


def _title_score(job_title: str) -> float:
    """
    1.0 if the job title contains any target title phrase, else 0.3.
    """
    title_lower = job_title.lower()
    return 1.0 if any(t in title_lower for t in TARGET_TITLES) else 0.3


def _compute_final_score(
    semantic: float,
    keyword: float,
    title: float,
) -> float:
    """
    Weighted combination of the three signals → final score 0–100.
    """
    w = SCORE_WEIGHTS
    raw = (
        semantic * w["semantic"] +
        keyword  * w["keyword"]  +
        title    * w["title"]
    )
    return round(raw * 100, 2)


def assign_band(score: float) -> str:
    """Map a 0–100 score to a band string."""
    if score >= BAND_THRESHOLDS["HOT"]:
        return "HOT"
    elif score >= BAND_THRESHOLDS["WARM"]:
        return "WARM"
    elif score >= BAND_THRESHOLDS["COLD"]:
        return "COLD"
    else:
        return "REJECT"


# ─────────────────────────────────────────────────────────
#  Single-job scorer
# ─────────────────────────────────────────────────────────

async def score_job(
    job: dict,
    master_embedding: list[float],
    resume_skills: list[str],
) -> dict:
    """
    Score a single job lead and return the updated fields to write to DB.
    Never raises — returns None signals on failure.
    """
    job_id  = job.get("job_id", "unknown")
    title   = job.get("title", "")
    desc    = job.get("raw_description", "")

    if not desc:
        logger.warning(f"Scorer: job {job_id} has no description — skipping.")
        return {}

    try:
        # Signal 1: Semantic similarity
        job_embedding   = await embed_text_async(desc)
        semantic        = cosine_similarity(master_embedding, job_embedding)

        # Signal 2: Keyword overlap
        keyword         = _keyword_score(desc, resume_skills)

        # Signal 3: Title match
        title_s         = _title_score(title)

        # Final weighted score
        final_score     = _compute_final_score(semantic, keyword, title_s)
        band            = assign_band(final_score)

        breakdown = {
            "semantic": round(semantic, 4),
            "keyword":  round(keyword, 4),
            "title":    round(title_s, 4),
            "final":    final_score,
        }

        logger.info(
            f"Scored [{band:6s} {final_score:5.1f}%] "
            f"{title[:50]!r}"
        )

        return {
            "match_score":     final_score / 100.0,  # keep legacy column 0–1
            "score_band":      band,
            "score_breakdown": json.dumps(breakdown),
        }

    except Exception as e:
        logger.error(f"Scorer: error scoring job {job_id}: {e}")
        log_stage_failure(job_id, "scoring", str(e))
        return {}


# ─────────────────────────────────────────────────────────
#  Batch scorer — run Stage 2 for all "Found" leads
# ─────────────────────────────────────────────────────────

async def run_scoring(profile: dict) -> dict:
    """
    Score all leads with status='Found'.
    Updates each lead in Supabase with match_score, score_band, score_breakdown.
    REJECT-band leads are updated to status='Dismissed' immediately.

    Args:
        profile: master user profile dict from DB (must have resume_data).

    Returns:
        Summary dict with band counts.
    """
    logger.info("=== Stage 2: Embedding & Matching started ===")

    resume_data  = profile.get("resume_data", {})
    resume_text  = json.dumps(resume_data)

    # Extract skill keywords for keyword signal
    resume_skills = _extract_skills(resume_data)
    logger.info(f"Scoring with {len(resume_skills)} resume skill keywords.")

    # Get (or compute + cache) master embedding
    master_embedding = await get_master_embedding(resume_text)

    # Fetch all unscored leads for this user
    user_id = profile.get("id")
    leads = get_leads_by_status("Found", limit=200, user_id=user_id)
    if not leads:
        logger.info(f"No 'Found' leads to score for user {user_id}.")
        return {"hot": 0, "warm": 0, "cold": 0, "reject": 0, "total": 0}

    logger.info(f"Scoring {len(leads)} leads for user {user_id}…")

    counts = {"hot": 0, "warm": 0, "cold": 0, "reject": 0}

    # Score all jobs concurrently (each embed call is async)
    tasks = [score_job(lead, master_embedding, resume_skills) for lead in leads]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    async def _update_lead_async(jid, udict, uid):
        return await asyncio.to_thread(update_job_lead, jid, udict, user_id=uid)

    update_tasks = []
    for lead, result in zip(leads, results):
        job_id = lead.get("job_id", "")

        if isinstance(result, Exception):
            logger.error(f"Scoring task error for {job_id}: {result}")
            log_stage_failure(job_id, "scoring", str(result))
            continue

        if not result:
            continue

        band = result.get("score_band", "REJECT")
        upd = {
            "match_score": result["match_score"],
            "score_band": band,
            "score_breakdown": result.get("score_breakdown"),
        }

        if band == "REJECT":
            upd["status"] = "Dismissed"
            counts["reject"] += 1
        else:
            counts[band.lower()] += 1

        update_tasks.append(_update_lead_async(job_id, upd, user_id))
        log_stage_success(job_id, "scoring")

    if update_tasks:
        await asyncio.gather(*update_tasks)

    total = sum(counts.values())
    logger.info(
        f"=== Stage 2 complete: "
        f"HOT={counts['hot']} WARM={counts['warm']} "
        f"COLD={counts['cold']} REJECT={counts['reject']} / {total} ==="
    )
    log_stage_success(None, "scoring_batch", f"Scored {total} leads. {counts}")
    return {**counts, "total": total}


# ─────────────────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────────────────

def _extract_skills(resume_data: dict) -> list[str]:
    """
    Pull all skill keywords from the master resume JSON.
    Handles both the 'skills' section and general keywords.
    """
    skills: list[str] = []

    cv      = resume_data.get("cv", {})
    sections = cv.get("sections", {})

    # Structured skills section: [{label: "...", details: "..."}, ...]
    for skill_entry in sections.get("skills", []):
        details = skill_entry.get("details", "")
        # Split comma/slash-delimited skills
        for s in details.replace("/", ",").split(","):
            s = s.strip()
            if s:
                skills.append(s.lower())

    # Also pull from tech_stack top-level key if present
    tech = resume_data.get("tech_stack", {})
    for s in tech.get("skills", []):
        skills.append(s.lower())

    # Common AI/ML terms — always include as anchor keywords
    anchors = [
        "python", "pytorch", "tensorflow", "nlp", "ml", "machine learning",
        "deep learning", "llm", "transformer", "fastapi", "docker",
    ]
    skills.extend(anchors)

    return list(set(skills))
