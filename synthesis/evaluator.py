"""
synthesis/evaluator.py — Ghost Protocol v3.0
ATS Score & Interview Prep Card Generator (Phase 4).
Runs a single compact LLM call to score the resume and generate 3 prep questions.
"""
import json
from core.logger import get_logger
from synthesis.llm_waterfall import run_waterfall

logger = get_logger(__name__)

SYSTEM_PROMPT = """You are an ATS parser and senior technical recruiter.
Evaluate the candidate's resume against the Job Description.
Return ONLY a valid JSON object. No explanation. No preamble. No markdown code fences.

Expected output JSON format:
{
  "ats_score": 85,
  "ats_feedback": [
    "Highlight experience with Jina AI embeddings more prominently.",
    "Add specific metrics on FastAPI throughput.",
    "Structure programming languages section at the top."
  ],
  "interview_prep": [
    "How would you optimize the memory footprint of sentence-transformers in a containerized environment?",
    "Explain the deduplication strategy you implemented to handle high-throughput job harvesting.",
    "Why is Jina AI preferred over local paraphrase-MiniLM for representation learning in your resume matcher?"
  ]
}"""

async def evaluate_lead(
    master_resume: dict,
    jd_text: str,
    api_keys: dict = None
) -> dict:
    """
    Score the resume and generate 3 interview prep questions.
    Returns a dict with ats_score, ats_feedback, and interview_prep.
    """
    user_prompt = (
        f"RESUME:\n{json.dumps(master_resume)}\n\n"
        f"JOB DESCRIPTION:\n{jd_text[:2000]}\n"
    )
    try:
        # We reuse the waterfall to be completely rate-limit safe
        res = await run_waterfall(SYSTEM_PROMPT, user_prompt, master_resume, api_keys)
        if res and "ats_score" in res:
            return {
                "ats_score": int(res.get("ats_score", 75)),
                "ats_feedback": res.get("ats_feedback", []),
                "interview_prep": res.get("interview_prep", [])
            }
    except Exception as e:
        logger.error(f"Evaluator failed: {e}")
    
    # Safe default fallback
    return {
        "ats_score": 70,
        "ats_feedback": ["Could not run ATS Critic. Please check LLM keys."],
        "interview_prep": [
            "Tell me about a challenging machine learning project you built.",
            "How do you ensure data pipeline integrity with Supabase?",
            "What is your experience with FastAPI and asynchronous Python?"
        ]
    }
