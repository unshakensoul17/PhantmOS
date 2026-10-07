"""
harvesting/text_cleaner.py — PhantmOS v3.0

High-speed boilerplate stripper & HTML cleaner for Job Descriptions.
Removes:
  - Legal disclaimers (EEO, affirmative action, background checks)
  - Generic benefits lists (401k, dental, gym stipends)
  - Cookie/privacy notices
Preserves:
  - Role Summary
  - Core Responsibilities
  - Technical Requirements & Qualifications
"""

import html
import re

try:
    import trafilatura
    HAS_TRAFILATURA = True
except ImportError:
    HAS_TRAFILATURA = False

from bs4 import BeautifulSoup

# Common boilerplate header patterns to strip everything beneath them
BOILERPLATE_SECTION_PATTERNS = [
    r"(?i)\b(equal\s+opportunity\s+employer|eeo\s+statement|affirmative\s+action)\b.*",
    r"(?i)\b(we\s+do\s+not\s+discriminate\s+on\s+the\s+basis\s+of)\b.*",
    r"(?i)\b(benefits\s+&\s+perks|what\s+we\s+offer|compensation\s+and\s+benefits|why\s+join\s+us|perks\s+and\s+benefits)\b.*",
    r"(?i)\b(privacy\s+policy|applicant\s+privacy\s+notice|candidate\s+privacy)\b.*",
    r"(?i)\b(background\s+check\s+notice|drug\s+testing\s+policy|u\.?s\.?\s+citizenship\s+required)\b.*",
    r"(?i)\b(pay\s+transparency\s+nondiscrimination\s+provision)\b.*",
]

# Inline phrases to strip
INLINE_JUNK_PATTERNS = [
    r"(?i)we are an equal opportunity employer[^\.\n]*[\.\n]?",
    r"(?i)all qualified applicants will receive consideration for employment[^\.\n]*[\.\n]?",
    r"(?i)applicants must be authorized to work in the [^\.\n]*[\.\n]?",
    r"(?i)visa sponsorship is (not|unavailable|not available)[^\.\n]*[\.\n]?",
    r"(?i)we do not accept unsolicited resumes from recruiters[^\.\n]*[\.\n]?",
]


def clean_job_description(raw_text_or_html: str, max_chars: int = 4500) -> str:
    """
    Clean raw job HTML or markdown into clean, dense, boilerplate-free text.
    Prunes legal disclaimers, perks/benefits lists, and cookie notices.
    Reduces token payload by ~40% and boosts semantic embedding relevance.
    """
    if not raw_text_or_html:
        return ""

    text = str(raw_text_or_html).strip()

    # 1. Try Trafilatura if available and text is HTML
    if HAS_TRAFILATURA and ("<p>" in text or "<div>" in text or "<br" in text):
        try:
            extracted = trafilatura.extract(
                text,
                include_links=False,
                include_images=False,
                include_tables=True,
                no_fallback=False
            )
            if extracted and len(extracted) > 100:
                text = extracted
        except Exception:
            pass

    # 2. Strip HTML tags with BeautifulSoup if HTML tags are still present
    if "<" in text and ">" in text:
        try:
            soup = BeautifulSoup(text, "html.parser")
            # Remove scripts, styles, and SVG
            for tag in soup(["script", "style", "svg", "noscript", "iframe", "header", "footer"]):
                tag.decompose()
            text = soup.get_text(separator="\n")
        except Exception:
            text = re.sub(r"<[^>]+>", " ", text)

    # 3. Unescape HTML entities (&amp; -> &, &nbsp; -> ' ')
    text = html.unescape(text)
    text = text.replace("\xa0", " ").replace("\u200b", "")

    # 4. Strip trailing boilerplate sections (EEO, Perks, Legal)
    for pattern in BOILERPLATE_SECTION_PATTERNS:
        # Match only if it occurs in the lower portion (>30%) of the document
        match = re.search(pattern, text, flags=re.DOTALL)
        if match and match.start() > len(text) * 0.30:
            text = text[:match.start()].strip()

    # 5. Remove inline legal boilerplate
    for pattern in INLINE_JUNK_PATTERNS:
        text = re.sub(pattern, "", text)

    # 6. Clean excess whitespace and multiple empty lines
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    cleaned = "\n".join(lines)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)

    return cleaned[:max_chars].strip()
