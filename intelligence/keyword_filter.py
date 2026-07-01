"""
intelligence/keyword_filter.py — Ghost Protocol v2.0

Instant keyword pre-filter applied before any embedding or API call.
Rejects jobs that don't match the target tech/role profile.
O(n) string check — zero cost, zero latency.
"""
from core.config import REQUIRED_KEYWORDS, EXCLUDE_KEYWORDS
from core.logger import get_logger

logger = get_logger(__name__)


def passes_keyword_filter(title: str, description: str) -> bool:
    """
    Returns True if the job passes all keyword rules:
      - Contains at least ONE tech_stack keyword
      - Contains at least ONE role_type keyword
      - Contains NONE of the hard-exclude keywords
    """
    combined = (title + " " + description).lower()

    # Hard exclusions — reject immediately
    for kw in EXCLUDE_KEYWORDS:
        if kw.lower() in combined:
            logger.debug(f"Rejected (exclude keyword '{kw}'): {title[:60]}")
            return False

    # Must match tech stack
    if not any(kw in combined for kw in REQUIRED_KEYWORDS["tech_stack"]):
        logger.debug(f"Rejected (no tech_stack keyword): {title[:60]}")
        return False

    # Must match role type
    if not any(kw in combined for kw in REQUIRED_KEYWORDS["role_type"]):
        logger.debug(f"Rejected (no role_type keyword): {title[:60]}")
        return False

    return True
