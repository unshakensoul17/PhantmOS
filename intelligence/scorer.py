"""
intelligence/scorer.py — PhantmOS v2.0

Multi-signal job scoring engine:
  Signal 1 — Semantic similarity  (50%) via embedding cosine distance
  Signal 2 — Keyword overlap      (30%) fast word-set intersection
  Signal 3 — Title match          (20%) target title list check

Final score is 0–100. Band assigned as HOT / WARM / COLD / REJECT.
"""

import asyncio
import json

from core.config import (
    SCORE_WEIGHTS,
)
from core.database_manager import (
    get_leads_by_status,
    log_stage_failure,
    log_stage_success,
    update_job_lead,
)
from core.logger import get_logger
from intelligence.embedding_engine import (
    cosine_similarity,
    get_job_embedding,
    get_master_embedding,
)

logger = get_logger(__name__)


# ─────────────────────────────────────────────────────────
#  Core scoring functions
# ─────────────────────────────────────────────────────────


from intelligence.hybrid_retriever import FastBM25, reciprocal_rank_fusion, rerank_candidates


def _keyword_score(job_description: str, resume_skills: list[str], bm25_engine: FastBM25 | None = None) -> float:
    """
    Combines BM25 lexical relevance and direct exact skill overlap.
    Guarantees exact matching on mandatory tools (PyTorch, PostgreSQL, FastAPI).
    """
    if not resume_skills or not job_description:
        return 0.0

    desc_lower = job_description.lower()
    resume_words = {s.lower() for s in resume_skills if s}

    hits = sum(1 for skill in resume_words if skill in desc_lower)
    overlap = (hits / len(resume_words)) if len(resume_words) > 0 else 0.0
    direct_score = min(overlap * 2.0, 1.0)

    if bm25_engine:
        bm25_scores = bm25_engine.get_scores(list(resume_words))
        # Normalized BM25 component
        raw_bm25 = bm25_scores[0] if bm25_scores else 0.0
        normalized_bm25 = min(raw_bm25 / 10.0, 1.0)
        return 0.6 * direct_score + 0.4 * normalized_bm25

    return direct_score


def _title_score(job_title: str, target_titles: list[str]) -> float:
    """
    1.0 if the job title contains any target title phrase, else 0.3.
    """
    title_lower = job_title.lower()
    if not target_titles:
        return 0.3
    return 1.0 if any(t.lower() in title_lower for t in target_titles) else 0.3


def _compute_final_score(
    semantic: float,
    keyword: float,
    title: float,
) -> float:
    """
    Weighted combination of semantic embedding similarity (45%),
    BM25 lexical/skill match (35%), and title match (20%) -> final score 0-100.
    """
    raw = (semantic * 0.45) + (keyword * 0.35) + (title * 0.20)
    return round(raw * 100, 2)


def _assign_band(score: float, telegram_threshold: float) -> str:
    """
    Map 0-100 score to WARM or HOT based on the user's telegram_threshold.
    HOT is halfway between threshold and 100.
    """
    hot_threshold = telegram_threshold + ((100.0 - telegram_threshold) / 2.0)

    if score >= hot_threshold:
        return "HOT"
    elif score >= telegram_threshold:
        return "WARM"
    elif score >= 40.0:
        return "COLD"
    return "REJECT"


# ─────────────────────────────────────────────────────────
#  Single-job scorer
# ─────────────────────────────────────────────────────────


async def score_job(
    job: dict,
    master_embedding: list[float],
    resume_skills: list[str],
    target_titles: list[str],
    telegram_threshold: float,
    bm25_score: float = 0.0,
) -> dict:
    """
    Score a single job lead with hybrid signals (Semantic + Lexical BM25 + Title).
    Never raises — returns None signals on failure.
    """
    job_id = job.get("job_id", "unknown")
    title = job.get("title", "")
    desc = job.get("raw_description", "")

    if not desc:
        logger.warning(f"Scorer: job {job_id} has no description — skipping.")
        return {}

    try:
        # Signal 1: Semantic similarity
        job_embedding = await get_job_embedding(desc)
        semantic = cosine_similarity(master_embedding, job_embedding)

        # Signal 2: Keyword + BM25 overlap
        direct_kw = _keyword_score(desc, resume_skills)
        normalized_bm25 = min(bm25_score / 10.0, 1.0) if bm25_score > 0 else direct_kw
        keyword = 0.6 * direct_kw + 0.4 * normalized_bm25

        # Signal 3: Title match
        title_s = _title_score(title, target_titles)

        # Final weighted score
        final_score = _compute_final_score(semantic, keyword, title_s)

        # Convert to band
        band = _assign_band(final_score, telegram_threshold)

        breakdown = {
            "semantic": round(semantic, 4),
            "keyword": round(keyword, 4),
            "bm25": round(bm25_score, 3),
            "title": round(title_s, 4),
            "final": final_score,
        }

        logger.info(f"Scored [{band:6s} {final_score:5.1f}%] {title[:50]!r}")

        return {
            "match_score": final_score / 100.0,  # keep legacy column 0–1
            "score_band": band,
            "score_breakdown": json.dumps(breakdown),
        }

    except Exception as e:
        logger.error(f"Scorer: error scoring job {job_id}: {e}")
        log_stage_failure(job_id, "scoring", str(e))
        return {}


# ─────────────────────────────────────────────────────────
#  Batch scorer — run Stage 2 for all "Found" leads
# ─────────────────────────────────────────────────────────


async def run_scoring(profile: dict, manual_query: str = None) -> dict:
    """
    Score all leads with status='Found'.
    manual_query: when provided (manual pipeline trigger), use it to build target_roles
                  so the title signal reflects what was actually searched — not the
                  user's saved profile preferences.
    """

    # 1. Fetch resume & skills
    resume_data = profile.get("resume_data") or {}
    resume_text = json.dumps(resume_data)

    # Extract skill keywords for keyword signal
    resume_skills = _extract_skills(resume_data)
    logger.info(f"Scoring with {len(resume_skills)} resume skill keywords.")

    user_id = profile.get("id")

    # Get (or compute + cache) master embedding
    master_embedding = await get_master_embedding(resume_text, user_id)

    # Fetch all unscored leads for this user
    leads = get_leads_by_status("Found", limit=200, user_id=user_id)
    if not leads:
        logger.info(f"No 'Found' leads to score for user {user_id}.")
        return {"hot": 0, "warm": 0, "cold": 0, "reject": 0, "total": 0}

    logger.info(f"Scoring {len(leads)} leads for user {user_id}…")

    # Fetch settings from user profile
    preferences = profile.get("preferences") or {}

    # Fallback to settings.json if preferences is empty
    if not preferences:
        try:
            with open("settings.json") as f:
                preferences = json.load(f)
        except Exception:
            pass

    scoring_settings = preferences.get("scoring") or {}

    blacklist_companies = scoring_settings.get("blacklist_companies") or []
    blacklist_companies = [c.lower() for c in blacklist_companies if c]

    blacklist_keywords = scoring_settings.get("blacklist_keywords") or []
    blacklist_keywords = [k.lower() for k in blacklist_keywords if k]

    target_roles = scoring_settings.get("target_roles") or []
    # KEY FIX: if a manual query was used (e.g. "cloud engineer"),
    # override target_roles with the search terms so the title signal
    # scores cloud jobs high, not the profile's saved ML/AI preferences.
    if manual_query:
        target_roles = [manual_query]
        logger.info(f"Scoring: title signal overridden by manual_query='{manual_query}'")
    elif not target_roles:
        target_roles = ["developer", "engineer"]  # safe fallback

    logger.info("=== Stage 2: Embedding & Matching started ===")
    telegram_threshold = scoring_settings.get("telegram_threshold", 60.0)

    counts = {"hot": 0, "warm": 0, "cold": 0, "reject": 0}

    # Pre-filter blacklist
    filtered_leads = []
    for lead in leads:
        company_lower = (lead.get("company") or "").lower()
        desc_lower = (lead.get("raw_description") or "").lower()

        is_blacklisted = False
        if any(bc in company_lower for bc in blacklist_companies if bc) or any(
            bk in desc_lower for bk in blacklist_keywords if bk
        ):
            is_blacklisted = True

        if is_blacklisted:
            job_id = lead.get("job_id", "")
            logger.info(f"Scorer: auto-rejecting blacklisted job {job_id}")
            update_job_lead(job_id, {"status": "Dismissed"}, user_id=user_id)
            counts["reject"] += 1
        else:
            filtered_leads.append(lead)

    # Stage 2A Fast Recall: Vectorized BM25 indexing across candidate job descriptions
    bm25_corpus = [lead.get("raw_description", "") for lead in filtered_leads]
    bm25_engine = FastBM25(bm25_corpus)
    bm25_scores = bm25_engine.get_scores(resume_skills) if resume_skills else [0.0] * len(filtered_leads)

    # Score all jobs concurrently (each embed call is async)
    tasks = [
        score_job(lead, master_embedding, resume_skills, target_roles, telegram_threshold, bm25_s)
        for lead, bm25_s in zip(filtered_leads, bm25_scores, strict=False)
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Bulk update all scored jobs in a single DB request
    upsert_batch = []

    for lead, result in zip(filtered_leads, results, strict=False):
        job_id = lead.get("job_id", "")

        if isinstance(result, Exception):
            logger.error(f"Scoring task error for {job_id}: {result}")
            log_stage_failure(job_id, "scoring", str(result))
            continue

        if not result:
            continue

        band = result.get("score_band", "REJECT")

        # Only pick pipeline-table columns — never pass global_jobs fields into user_job_pipelines upsert

        # BUG FIX 1: Keep status as "Found" for HOT/WARM so Stage 3's
        # get_leads_by_band(.eq("status","Found")) can find them.
        # Only REJECT leads get status="Dismissed".
        status = "Dismissed" if band == "REJECT" else "Found"

        # BUG FIX 2: Do NOT queue_delivery here. Delivery is queued by
        # _mark_tailored in Stage 3, AFTER the resume is actually tailored.
        # Queueing here caused 100+ stale queue entries with no resume attached.
        if band == "REJECT":
            counts["reject"] += 1
        else:
            counts[band.lower()] += 1

        # Store score breakdown and initial rationale into notes JSON
        notes_dict = {}
        if lead.get("notes"):
            try:
                notes_dict = (
                    json.loads(lead.get("notes"))
                    if isinstance(lead.get("notes"), str)
                    else lead.get("notes")
                )
            except Exception:
                notes_dict = {}

        breakdown_str = result.get("score_breakdown", "{}")
        try:
            breakdown_obj = (
                json.loads(breakdown_str) if isinstance(breakdown_str, str) else breakdown_str
            )
        except Exception:
            breakdown_obj = {}

        notes_dict["score_breakdown"] = breakdown_obj
        if not notes_dict.get("rationale") and result.get("match_score"):
            score_pct = result.get("match_score", 0) * 100
            notes_dict["rationale"] = (
                f"{band} match ({score_pct:.0f}%): strong role and technical skill alignment."
            )

        pipeline_row = {
            "user_id": user_id,
            "job_id": job_id,
            "status": status,
            "match_score": result.get("match_score", 0),
            "score_band": band,
            "notes": json.dumps(notes_dict),
        }
        upsert_batch.append(pipeline_row)
        log_stage_success(job_id, "scoring")

    if upsert_batch:
        try:
            from core.database_manager import get_client

            # Perform a single bulk upsert for all scored leads!
            get_client().table("user_job_pipelines").upsert(
                upsert_batch, on_conflict="user_id, job_id"
            ).execute()
        except Exception as e:
            logger.error(f"Scorer: bulk upsert failed - {e}")

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

    cv = resume_data.get("cv", {})
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

    return list(set(skills))
