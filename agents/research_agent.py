"""
agents/research_agent.py — PhantmOS Multi-Agent Architecture

Purpose:
    Gathers company context — recent news, tech stack, hiring info — via
    DuckDuckGo scraping. Caches results in Supabase with a 7-day TTL.

Responsibilities:
    - Company research via web scraping
    - Cached context retrieval (DB-backed, 7-day TTL)
    - Context refresh on stale entries
    - Company metadata assembly

Must NOT:
    - Score jobs
    - Modify resumes
    - Generate PDFs

Public Methods:
    research_company(company_name)  — Return context string (cached or fresh)
    get_cached_context(company_name) — DB cache lookup only
    refresh_context(company_name)    — Force fresh scrape + cache update

Dependencies:
    synthesis.context_researcher, core.database_manager
"""
from core.database_manager import get_company_context, store_company_context
from core.config import COMPANY_CONTEXT_MAX_AGE_DAYS
from core.logger import get_logger
from synthesis.context_researcher import get_cached_company_context, _scrape_ddg

logger = get_logger(__name__)


class ResearchAgent:
    """Owns company research & context caching."""

    async def research_company(self, company_name: str) -> str:
        """Return cached or freshly scraped company context."""
        if not company_name:
            return ""
        return await get_cached_company_context(company_name)

    def get_cached_context(self, company_name: str) -> str:
        """Return context from DB cache only (no scraping)."""
        cached = get_company_context(company_name)
        if cached:
            age = cached.get("age_days", 99)
            if age is not None and int(age) < COMPANY_CONTEXT_MAX_AGE_DAYS:
                return cached.get("context", "")
        return ""

    async def refresh_context(self, company_name: str) -> str:
        """Force a fresh scrape and update the cache."""
        import asyncio
        context = await asyncio.to_thread(_scrape_ddg, company_name)
        store_company_context(company_name, context)
        logger.info(f"ResearchAgent: refreshed context for '{company_name}'")
        return context
