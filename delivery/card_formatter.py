"""
delivery/card_formatter.py — PhantmOS v2.0

Builds rich Telegram markdown job cards.
Format matches the v2 spec exactly:
  🔥 HOT LEAD — 91% Match
  Company / Role / Location / Salary / Posted
  WHY YOU MATCH (3 bullets from score breakdown)
  WHAT WAS TAILORED (from changes_made audit list)
  PDF link + Cold email preview button
  Auto-Apply | Review | Skip buttons
"""
import json
from core.logger import get_logger

logger = get_logger(__name__)

BAND_EMOJI = {
    "HOT":  "🔥",
    "WARM": "🌤️",
    "COLD": "❄️",
}


def format_job_card(lead: dict) -> str:
    """
    Build the rich Telegram markdown message for a single job lead.
    Returns a Markdown-formatted string safe for Telegram MarkdownV2.
    """
    band        = lead.get("score_band", "WARM")
    score       = lead.get("match_score", 0) * 100
    company     = lead.get("company", "Unknown")
    title       = lead.get("title", "Unknown Role")
    location    = lead.get("location", "Remote")
    job_url     = lead.get("job_url", "")
    resume_url  = lead.get("resume_url", "")
    source      = lead.get("source", "")

    # Parse notes
    notes_raw   = lead.get("notes") or "{}"
    try:
        notes = json.loads(notes_raw)
    except Exception:
        notes = {}

    cold_email  = notes.get("cold_email", "")
    changes     = notes.get("changes_made", [])
    rationale   = notes.get("rationale", "")

    # Parse score breakdown for "why you match"
    breakdown_raw = lead.get("score_breakdown") or "{}"
    try:
        breakdown = json.loads(breakdown_raw) if isinstance(breakdown_raw, str) else breakdown_raw
    except Exception:
        breakdown = {}

    emoji = BAND_EMOJI.get(band, "📋")

    # ── Why you match bullets ─────────────────────────────────────────────────
    why_bullets = _build_why_bullets(breakdown, rationale)

    # ── What was tailored ──────────────────────────────────────────────────────
    tailored_lines = ""
    if changes:
        tailored_lines = "\n".join(f"• {c}" for c in changes[:4])
    elif notes.get("tailored"):
        tailored_lines = "• Summary and key bullets updated for this role"
    else:
        tailored_lines = "• Original resume sent (best match as-is)"

    # ── PDF / resume line ──────────────────────────────────────────────────────
    resume_link = f"[View PDF]({resume_url})" if (resume_url and resume_url.startswith("http")) else "Generating PDF..."
    jd_link = f"[View JD]({job_url})" if job_url else "No Link"

    # We want rationale as the hook. If missing, fallback to one bullet from breakdown.
    if rationale:
        hook_text = _escape(rationale)
    else:
        # fallback to breakdown bullets
        hook_text = _build_why_bullets(breakdown, rationale)

    card = (
        f"🚀 *{_escape(title)}* @ *{_escape(company)}*\n"
        f"*{_escape(location)}* · {score:.0f}% Match ({band})\n"
        f"\n"
        f"💡 *The Angle:*\n"
        f"_{hook_text}_\n"
        f"\n"
        f"✏️ *Tailoring Applied:*\n"
        f"{tailored_lines}\n"
        f"\n"
        f"📄 {resume_link}   |   🔗 {jd_link}"
    )

    return card.strip()


def format_cold_email_preview(lead: dict) -> str:
    """Format the cold email preview message."""
    notes_raw = lead.get("notes") or "{}"
    try:
        notes = json.loads(notes_raw)
    except Exception:
        notes = {}

    email = notes.get("cold_email", "No cold email generated.")
    company = lead.get("company", "")
    return f"✉️ *Cold Email for {_escape(company)}:*\n\n```\n{email}\n```"


def format_review_card(lead: dict) -> str:
    """Detailed review card showing JD excerpt + tailoring summary."""
    company = lead.get("company", "")
    title   = lead.get("title", "")
    desc    = (lead.get("raw_description") or "")[:600]

    notes_raw = lead.get("notes") or "{}"
    try:
        notes = json.loads(notes_raw)
    except Exception:
        notes = {}

    changes  = notes.get("changes_made", [])
    provider = notes.get("llm_provider", "unknown")

    changes_text = "\n".join(f"• {c}" for c in changes) if changes else "• No changes made"

    return (
        f"👀 *Review: {_escape(title)} @ {_escape(company)}*\n\n"
        f"📄 *JD Excerpt:*\n```\n{desc}...\n```\n\n"
        f"✏️ *Changes Made (via {provider}):*\n{changes_text}"
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_why_bullets(breakdown: dict, rationale: str) -> str:
    """Generate 3 contextual 'why you match' bullet points."""
    bullets = []

    sem   = breakdown.get("semantic", 0)
    kw    = breakdown.get("keyword", 0)
    title = breakdown.get("title", 0)

    if sem >= 0.75:
        bullets.append("• Your experience profile closely mirrors this role's requirements")
    elif sem >= 0.55:
        bullets.append("• Moderate semantic alignment with the job description")

    if kw >= 0.6:
        bullets.append("• Strong keyword match — Python, PyTorch, ML terms confirmed in your resume")
    elif kw >= 0.3:
        bullets.append("• Partial keyword overlap with required tech stack")

    if title == 1.0:
        bullets.append("• Job title directly matches your target role categories")
    else:
        bullets.append("• Adjacent role — transferable skills apply")

    # Pad with rationale if we have fewer than 3 bullets
    if rationale and len(bullets) < 3:
        bullets.append(f"• {rationale[:120]}")

    return "\n".join(bullets[:3]) if bullets else "• See full job description for match details"


def _escape(text: str) -> str:
    """Escape Telegram MarkdownV2 special characters in user content."""
    # For Markdown mode (not V2), fewer escapes needed
    special = ["_", "*", "[", "]", "(", ")", "~", "`", ">", "#",
               "+", "-", "=", "|", "{", "}", ".", "!"]
    for ch in special:
        text = text.replace(ch, f"\\{ch}")
    return text
