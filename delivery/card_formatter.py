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


def _clean_text(text: str) -> str:
    """Sanitize dynamic user/scraped text for safe Telegram Markdown rendering."""
    if not text:
        return ""
    return str(text).replace("*", "").replace("_", " ").replace("`", "'").strip()


def format_radar_summary(leads: list[dict]) -> str:
    """
    Format a lightweight summary digest entry point for the Telegram Bot.
    Invites the user into the Compact Mini App without chat clutter.
    """
    if not leads:
        return (
            "🎯 *PHANTMOS RADAR*\n\n"
            "✨ *All caught up!*\n"
            "No pending matches right now. Tap below to launch Radar and scan new opportunities."
        )

    total_count = len(leads)
    hot_count = 0
    good_count = 0
    mod_count = 0

    for lead in leads:
        band = str(lead.get("score_band", "")).upper()
        raw_score = lead.get("match_score", 0) or 0
        score = (raw_score * 100) if raw_score <= 1.0 else raw_score

        if band in ("HOT", "A") or score >= 88:
            hot_count += 1
        elif band in ("WARM", "B", "GOOD") or score >= 70:
            good_count += 1
        else:
            mod_count += 1

    top_lead = leads[0]
    top_title = _clean_text(top_lead.get("title", "Software Engineer"))
    top_company = _clean_text(top_lead.get("company", "Company"))
    top_location = _clean_text(top_lead.get("location", "Remote"))
    raw_top_score = top_lead.get("match_score", 0) or 0
    top_score = (raw_top_score * 100) if raw_top_score <= 1.0 else raw_top_score

    lines = [
        "🎯 *PHANTMOS RADAR*",
        "",
        f"*{total_count} strong matches found.*",
        "",
        f"🔥 {hot_count} Hot",
        f"🟢 {good_count} Good",
        f"⚪ {mod_count} Moderate",
        "",
        "*Top Match:*",
        f"💼 *{top_title}*",
        f"🏢 {top_company}",
        f"📍 {top_location}",
        f"🔥 *{top_score:.0f}% Match*",
    ]
    return "\n".join(lines).strip()


def format_triage_card(lead: dict, current_idx: int = 0, total_count: int = 1) -> str:
    """
    Format a clean, concise, clutter-free single-page Triage Deck card for Telegram.
    Optimized for glanceability on mobile screens without scrolling.
    """
    band = lead.get("score_band", "WARM")
    raw_score = lead.get("match_score", 0) or 0
    score = (raw_score * 100) if raw_score <= 1.0 else raw_score
    company = lead.get("company", "Unknown")
    title = lead.get("title", "Unknown Role")
    location = lead.get("location", "Remote")
    salary = lead.get("salary", "")
    resume_url = lead.get("resume_url", "")
    status = lead.get("status", "Found")

    notes_raw = lead.get("notes") or "{}"
    try:
        notes = json.loads(notes_raw) if isinstance(notes_raw, str) else notes_raw
    except Exception:
        notes = {}

    rationale = notes.get("rationale", "")

    breakdown_raw = lead.get("score_breakdown") or "{}"
    try:
        breakdown = json.loads(breakdown_raw) if isinstance(breakdown_raw, str) else breakdown_raw
    except Exception:
        breakdown = {}

    emoji = BAND_EMOJI.get(band, "⚡")

    safe_title = _clean_text(title)
    safe_company = _clean_text(company)
    safe_location = _clean_text(location)

    if rationale:
        angle_text = _clean_text(rationale[:160])
    else:
        angle_text = _clean_text(_build_why_bullets(breakdown, "").replace("• ", ""))
        if not angle_text:
            angle_text = "Strong technical match for required tech stack and experience level."

    salary_part = f" · 💵 {salary}" if salary else ""
    is_tailored = status == "Tailored" or (resume_url and str(resume_url).startswith("http"))
    status_indicator = "✅ Tailored PDF Ready" if is_tailored else "⚡ Ready to Tailor"

    lines = [
        f"🎯 *PhantmOS Radar*  ·  `{current_idx + 1}/{total_count}`",
        "",
        f"💼 *{safe_title}*",
        f"🏢 *{safe_company}* · 📍 {safe_location}{salary_part}",
        f"{emoji} *{score:.0f}% Match ({band})*",
        "",
        f"💡 *Key Match:*",
        f"_{angle_text}_",
        "",
        f"📄 *Status:* {status_indicator}",
    ]

    return "\n".join(lines).strip()



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
        f"🔗 {jd_link}"
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
    if text is None:
        return ""
    text = str(text)
    # For Markdown mode (not V2), fewer escapes needed
    special = ["_", "*", "[", "]", "(", ")", "~", "`", ">", "#",
               "+", "-", "=", "|", "{", "}", ".", "!"]
    for ch in special:
        text = text.replace(ch, f"\\{ch}")
    return text
