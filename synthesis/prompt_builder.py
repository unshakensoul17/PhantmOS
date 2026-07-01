"""
synthesis/prompt_builder.py — Ghost Protocol v2.0

Strict prompt templates for HOT (full tailor) and WARM (light tailor).
The LLM is given no wiggle room — output schema is enforced.
"""
import json


SYSTEM_PROMPT = """You are a precise resume editor. You ONLY modify what is necessary.
Return ONLY valid JSON. No explanation. No preamble. No markdown code fences.

STRICT RULES:
1. ONLY modify bullet points that already exist — never invent new ones
2. ONLY reference skills already present in the master_resume object
3. Maximum 6 bullet points per role
4. Total resume must fit on ONE page
5. Cold email must be EXACTLY 3 sentences
6. Cold email must reference one specific company detail from the context
7. If a bullet does not relate to the JD, leave it UNCHANGED
8. If you are unsure about any modification, keep the original text exactly
9. Never add years of experience you don't have
10. Never add skills not in the master resume"""


def build_hot_prompt(
    master_resume_json: dict,
    jd_text: str,
    company_context: str,
) -> str:
    """Full tailoring prompt for HOT leads (85%+)."""
    return (
        f"MASTER RESUME JSON:\n{json.dumps(master_resume_json)}\n\n"
        f"JOB DESCRIPTION:\n{jd_text[:3000]}\n\n"
        f"COMPANY RESEARCH:\n{company_context[:800]}\n\n"
        "TASK:\n"
        "1. Rewrite 2-3 existing bullet points in the most recent experience role "
        "to mirror the JD's exact technical keywords. Keep them truthful.\n"
        "2. For the most recent role: keep EXACTLY 3 bullet points.\n"
        "3. For all older roles: keep EXACTLY 1-2 bullet points each.\n"
        "4. Write a 3-sentence cold email:\n"
        "   - Sentence 1: Hook referencing a specific company detail from research.\n"
        "   - Sentence 2: Pitch matching their top requirement to your best metric.\n"
        "   - Sentence 3: Confident, low-friction call to action.\n"
        "5. List every change made for audit.\n\n"
        "OUTPUT FORMAT (strict JSON, no markdown):\n"
        "{\n"
        '  "updated_resume_json": { ...full modified resume... },\n'
        '  "cold_email": "Sentence 1. Sentence 2. Sentence 3.",\n'
        '  "changes_made": ["change 1", "change 2"],\n'
        '  "rationale": "2-line explanation of why this is a strong match"\n'
        "}"
    )


def build_warm_prompt(
    master_resume_json: dict,
    jd_text: str,
) -> str:
    """Light tailoring prompt for WARM leads (60-84%) — title + summary only."""
    return (
        f"MASTER RESUME JSON:\n{json.dumps(master_resume_json)}\n\n"
        f"JOB DESCRIPTION:\n{jd_text[:2000]}\n\n"
        "TASK (light tailoring only):\n"
        "1. Rewrite the 'summary' field only to highlight the most relevant skills for this JD.\n"
        "2. Do NOT modify any bullet points or experience entries.\n"
        "3. Write a short 3-sentence cold email using a generic but professional tone.\n\n"
        "OUTPUT FORMAT (strict JSON, no markdown):\n"
        "{\n"
        '  "updated_resume_json": { ...resume with only summary changed... },\n'
        '  "cold_email": "Sentence 1. Sentence 2. Sentence 3.",\n'
        '  "changes_made": ["Updated summary"],\n'
        '  "rationale": "Brief reason this is a WARM match"\n'
        "}"
    )
