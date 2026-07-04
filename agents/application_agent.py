"""
agents/application_agent.py — Ghost Protocol Multi-Agent Architecture

Purpose:
    Handles all outbound communication: PDF generation, Telegram delivery,
    email dispatch, WhatsApp fallback, and delivery queue processing.

Responsibilities:
    - PDF generation (Jinja2 + WeasyPrint)
    - PDF upload to Supabase Storage
    - Telegram job card delivery
    - Cold email dispatch via Gmail SMTP
    - Delivery queue processing with retry logic

Must NOT:
    - Score jobs
    - Tailor resumes
    - Research companies

Public Methods:
    generate_pdfs(profile)           — Generate PDFs for all Tailored leads
    process_deliveries()             — Process the delivery queue
    run(profile)                     — Full Stage 4+5: PDFs then deliveries

Dependencies:
    synthesis.pdf_factory, delivery.queue_manager, interface.telegram_delivery,
    interface.email_dispatcher
"""
import asyncio
import json

from core.database_manager import get_leads_by_status, update_job_lead
from core.logger import get_logger
from synthesis.pdf_factory import generate_and_upload_pdf
from delivery.queue_manager import process_delivery_queue
from interface.telegram_delivery import send_job_card

logger = get_logger(__name__)


class ApplicationAgent:
    """Owns PDF generation and all outbound delivery (Stages 4 & 5)."""

    async def generate_pdfs(self, profile: dict) -> dict:
        """Generate PDFs for Tailored leads missing a resume_url."""
        user_id = profile.get("id")
        leads = get_leads_by_status("Tailored", limit=50, user_id=user_id)
        needs_pdf = [l for l in leads if not l.get("resume_url")]

        logger.info(
            f"ApplicationAgent: {len(needs_pdf)} leads need PDF for user {user_id}"
        )
        generated = failed = 0

        async def _gen(lead: dict):
            nonlocal generated, failed
            job_id = lead.get("job_id", "")
            company = lead.get("company", "")

            notes_raw = lead.get("notes") or "{}"
            try:
                notes = json.loads(notes_raw)
            except Exception:
                notes = {}

            resume_data = notes.get("updated_resume_json") or profile.get(
                "resume_data", {}
            )
            url = await generate_and_upload_pdf(
                job_id=job_id, resume_data=resume_data, company_name=company
            )
            if url:
                update_job_lead(job_id, {"resume_url": url}, user_id=user_id)
                generated += 1
            else:
                failed += 1

        await asyncio.gather(*[_gen(l) for l in needs_pdf], return_exceptions=True)
        return {
            "generated": generated,
            "failed": failed,
            "skipped": len(leads) - len(needs_pdf),
        }

    async def process_deliveries(self, profile: dict) -> dict:
        """Process the global delivery queue."""
        return await process_delivery_queue(
            profile=profile,
            send_fn=send_job_card
        )

    async def run(self, profile: dict) -> dict:
        """Full outbound pipeline: generate PDFs then process delivery queue."""
        pdf_summary = await self.generate_pdfs(profile)
        delivery_summary = await self.process_deliveries(profile)
        return {"pdf": pdf_summary, "delivery": delivery_summary}
