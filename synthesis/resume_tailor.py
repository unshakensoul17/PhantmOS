"""
synthesis/resume_tailor.py — PhantmOS v3.0

NEW ARCHITECTURE (on-demand tailoring):
  Stage 3 now only queues HOT/WARM/COLD leads for Telegram delivery.
  NO LLM calls here — resume tailoring is triggered on-demand when
  the user clicks "Create Resume" in Telegram for a specific job.

This dramatically reduces pipeline runtime and API costs.

On-demand tailoring lives in:
  interface/telegram_delivery.py → _on_create_resume()
"""

import json

from core.database_manager import (
    get_leads_by_band,
    log_stage_success,
    queue_delivery,
)
from core.logger import get_logger

logger = get_logger(__name__)


async def run_tailoring(profile: dict, api_keys: dict = None) -> dict:
    """
    Stage 3: Queue HOT/WARM/COLD leads for Telegram delivery.
    NO resume tailoring or LLM calls happen here.
    Tailoring is on-demand, triggered via Telegram 'Create Resume' button.
    """
    logger.info("=== Stage 3: Resume Tailoring started ===")
    user_id = profile.get("id")
    counts = {"hot_queued": 0, "warm_queued": 0, "cold_queued": 0}

    for band in ("HOT", "WARM", "COLD"):
        leads = get_leads_by_band(band, user_id=user_id)
        band_key = f"{band.lower()}_queued"
        logger.info(f"{band} leads to tailor: {len(leads)}")

        for lead in leads:
            job_id = lead.get("job_id")
            # Mark as Tailored (with original resume) so it clears Stage 4
            # and gets picked up by Stage 5 delivery queue
            notes_raw = lead.get("notes") or "{}"
            try:
                json.loads(notes_raw)
            except Exception:
                pass

            # Queue for delivery. Leave status untouched (e.g. 'New') so Telegram displays the 'Create Resume' button.
            queue_delivery(job_id, user_id)
            counts[band_key] += 1
            logger.info(f"Queued delivery for job {job_id}.")

    total = sum(counts.values())
    logger.info(
        f"=== Stage 3 complete: "
        f"HOT={counts['hot_queued']} WARM={counts['warm_queued']} "
        f"COLD={counts['cold_queued']} FAILED=0 / {total} ==="
    )
    log_stage_success(None, "tailoring", f"Queued {total} leads for delivery (on-demand tailoring)")
    return counts
