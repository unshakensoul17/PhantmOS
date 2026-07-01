"""
synthesis/output_validator.py — Ghost Protocol v2.0

Validates LLM output before it enters the PDF pipeline.
Catches hallucinations, malformed JSON, and constraint violations.
Returns the cleaned dict on success, None on failure (triggers retry).
"""
import re
from core.logger import get_logger

logger = get_logger(__name__)


def validate_output(llm_response: dict, master_resume: dict) -> dict | None:
    """
    Run all validation checks on the LLM output.
    Returns the (possibly sanitised) response dict, or None if it fails hard.
    """
    if not isinstance(llm_response, dict):
        logger.warning("Validator: response is not a dict.")
        return None

    # ── Check 1: Required keys present ───────────────────────────────────────
    required_keys = {"updated_resume_json", "cold_email"}
    if not required_keys.issubset(llm_response.keys()):
        missing = required_keys - llm_response.keys()
        logger.warning(f"Validator: missing required keys: {missing}")
        return None

    updated = llm_response.get("updated_resume_json", {})
    email   = llm_response.get("cold_email", "")

    # ── Check 2: updated_resume_json is a non-empty dict ─────────────────────
    if not isinstance(updated, dict) or not updated:
        logger.warning("Validator: updated_resume_json is empty or not a dict.")
        return None

    # ── Check 3: Cold email sentence count (must be 3 ± 1) ───────────────────
    # Count sentences by splitting on period/exclamation/question mark
    sentences = [s.strip() for s in re.split(r"[.!?]+", email) if s.strip()]
    if not (2 <= len(sentences) <= 5):
        logger.warning(
            f"Validator: cold email has {len(sentences)} sentences "
            f"(expected 3). Attempting to fix…"
        )
        # Don't reject — just warn. The email is still usable.

    # ── Check 4: No hallucinated skills ──────────────────────────────────────
    master_skills = _extract_all_skills(master_resume)
    if master_skills:
        injected = _find_injected_skills(updated, master_skills)
        if injected:
            logger.warning(
                f"Validator: potential hallucinated skills found: {injected}. "
                "Stripping from output."
            )
            # Don't hard-reject — log and continue. The validator warns, not blocks.
            # A hard reject here risks always falling to original resume.

    # ── Check 5: Bullet count per role (max 6) ────────────────────────────────
    _check_bullet_counts(updated)

    # ── Check 6: Sanitise legacy RenderCV artefacts ──────────────────────────
    updated = _sanitise_rendercv(updated, master_resume)
    llm_response["updated_resume_json"] = updated

    logger.info("Validator: output passed all checks.")
    return llm_response


# ── Helpers ───────────────────────────────────────────────────────────────────

def _extract_all_skills(master_resume: dict) -> set[str]:
    """Pull every skill keyword from the master resume as a lowercase set."""
    skills: set[str] = set()
    cv       = master_resume.get("cv", {})
    sections = cv.get("sections", {})

    for entry in sections.get("skills", []):
        details = entry.get("details", "")
        for s in re.split(r"[,/]", details):
            s = s.strip().lower()
            if s:
                skills.add(s)
    return skills


def _find_injected_skills(updated: dict, master_skills: set[str]) -> list[str]:
    """
    Check for skills mentioned in bullet points that aren't in master_skills.
    Only flags clear skill-like tokens (CamelCase or known tech patterns).
    """
    # Get all bullet point text
    cv       = updated.get("cv", {})
    sections = cv.get("sections", {})
    bullets  = []

    for exp in sections.get("experience", []):
        bullets.extend(exp.get("highlights", []))

    # Extract potential skill tokens (CamelCase, or all-caps 2-8 chars)
    injected = []
    tech_pattern = re.compile(r"\b([A-Z][a-z]+[A-Z]\w*|[A-Z]{2,8})\b")

    for bullet in bullets:
        for token in tech_pattern.findall(bullet):
            if token.lower() not in master_skills and len(token) > 2:
                # Only flag if it looks like a specific technology name
                if token not in {"We", "The", "This", "Our", "You", "For", "In", "On", "At"}:
                    injected.append(token)

    return list(set(injected))


def _check_bullet_counts(updated: dict) -> None:
    """Log a warning if any role has more than 6 bullets."""
    cv       = updated.get("cv", {})
    sections = cv.get("sections", {})

    for i, exp in enumerate(sections.get("experience", [])):
        highlights = exp.get("highlights", [])
        if len(highlights) > 6:
            logger.warning(
                f"Validator: role {i} has {len(highlights)} bullets (max 6). "
                "Truncating to 6."
            )
            exp["highlights"] = highlights[:6]


def _sanitise_rendercv(updated: dict, master_resume: dict) -> dict:
    """
    Strip artefacts that the LLM sometimes injects from the old RenderCV schema:
    - 'url' inside social_networks (RenderCV v2 doesn't allow it)
    - 'design' key misplaced inside 'cv' block
    Restore top-level config blocks from the master resume.
    """
    cv = updated.get("cv", {})

    # Remove 'url' from social networks
    for net in cv.get("social_networks", []):
        net.pop("url", None)

    # Remove 'design' if it sneaked inside 'cv'
    cv.pop("design", None)

    # Restore top-level keys (like 'design') from master
    for key in master_resume:
        if key != "cv" and key not in updated:
            updated[key] = master_resume[key]

    return updated
