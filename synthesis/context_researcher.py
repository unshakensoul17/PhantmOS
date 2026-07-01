"""
synthesis/context_researcher.py — Ghost Protocol v2.0

Cached DuckDuckGo company research.
- Checks Supabase company_context table first (cache TTL: 7 days)
- Only scrapes if missing or stale
- Stores result back to cache
"""
import warnings
from core.config import COMPANY_CONTEXT_MAX_AGE_DAYS
from core.database_manager import get_company_context, store_company_context
from core.logger import get_logger

logger = get_logger(__name__)


async def get_cached_company_context(company_name: str) -> str:
    """
    Return company research context string.
    Uses DB cache (7 day TTL) to avoid redundant scraping.
    """
    if not company_name:
        return ""

    # Check cache
    cached = get_company_context(company_name)
    if cached:
        age = cached.get("age_days", 99)
        if age is not None and int(age) < COMPANY_CONTEXT_MAX_AGE_DAYS:
            logger.info(
                f"Context: cache HIT for '{company_name}' "
                f"(age={age} days)."
            )
            return cached.get("context", "")
        else:
            logger.info(
                f"Context: cache STALE for '{company_name}' "
                f"(age={age} days) — re-scraping."
            )

    # Scrape fresh context
    context = _scrape_ddg(company_name)

    # Store in cache (even empty string — prevents repeated failed scrapes)
    store_company_context(company_name, context)
    logger.info(f"Context: scraped and cached for '{company_name}'.")
    return context


def _scrape_ddg(company_name: str) -> str:
    """DuckDuckGo text search for recent company info."""
    query = (
        f'"{company_name}" AI engineering team OR hiring OR '
        f"recent news OR product launch 2024 2025"
    )
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            from duckduckgo_search import DDGS
            with DDGS() as ddgs:
                results = list(ddgs.text(query, max_results=4))
                snippets = [r.get("body", "") for r in results if r.get("body")]
                return " | ".join(snippets[:3])
    except Exception as e:
        logger.warning(f"Context: DDG scrape failed for '{company_name}': {e}")
        return ""
