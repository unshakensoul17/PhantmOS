import asyncio
import os
import random
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from dotenv import load_dotenv

from intelligence.harvesting_engine import harvest_jobs
from core.database_manager import get_leads_by_status, update_job_lead, get_profile
from synthesis.context_researcher import get_company_context
from synthesis.resume_tailor import tailor_resume
from synthesis.pdf_factory import generate_pdf
from interface.telegram_delivery import send_job_card, app

load_dotenv()
DEFAULT_TIMEZONE = os.getenv("DEFAULT_TIMEZONE", "Asia/Kolkata")

async def process_pipeline():
    """Central unified orchestration loop for Ghost Protocol."""
    print("\n--- [Orchestrator] Starting Intelligence Pipeline Run ---")
    
    # 1. Harvest & Filter Engine
    print("[Orchestrator] Step 1: Harvesting Jobs via SerpApi...")
    # This runs synchronously; in a full prod setup, you might offload to a thread pool
    harvest_jobs()
    
    # 2. Synthesis Factory
    print("[Orchestrator] Step 2: Synthesis for 'Discovered' leads...")
    leads_to_tailor = get_leads_by_status("Discovered")
    profile = get_profile()
    master_resume_json = profile.get("resume_data", {}) if profile else {}
    
    if not master_resume_json:
        print("[Orchestrator] Cannot run synthesis: Master resume JSON empty.")
    else:
        for lead in leads_to_tailor:
            job_id = lead["job_id"]
            company = lead.get("company", "")
            description = lead.get("raw_description", "")
            
            # Deep Research
            hooks = get_company_context(company)
            
            # Surgical Tailoring
            tailored_data = await tailor_resume(master_resume_json, description, hooks)
            if not tailored_data or "updated_resume_json" not in tailored_data:
                print(f"[Orchestrator] Tailoring failed for lead {job_id}")
                continue
                
            # PDF Generation
            pdf_dir = os.path.join(os.getcwd(), "data", "resumes")
            pdf_path = os.path.join(pdf_dir, f"{job_id}.pdf")
            
            final_pdf_path = generate_pdf(
                updated_resume_json=tailored_data["updated_resume_json"],
                output_path=pdf_path
            )
            
            if not final_pdf_path:
                print(f"[Orchestrator] PDF Generation failed for lead {job_id}")
                continue
            
            # Update State
            update_job_lead(job_id, {
                "status": "Tailored",
                "cold_email": tailored_data.get("cold_email", ""),
                "rationale": tailored_data.get("rationale", ""),
                "resume_path": final_pdf_path
            })
            print(f"[Orchestrator] Completed synthesis for {company}")
        
    # 3. Delivery Hub
    print("[Orchestrator] Step 3: Delivering 'Tailored' leads via Telegram...")
    ready_leads = get_leads_by_status("Tailored")
    for lead in ready_leads:
        await send_job_card(lead)
        
    print("--- [Orchestrator] Pipeline Run Complete ---\n")

async def scheduled_tick():
    """Wrapper to add an irregular delay before running the pipeline."""
    # Irregular time buffer (1 to 20 minutes)
    delay = random.randint(60, 1200)
    print(f"[Orchestrator] Scheduled run triggered. Waiting for {delay} seconds (irregular buffer) to avoid robotic patterns...")
    await asyncio.sleep(delay)
    await process_pipeline()

async def main():
    """Initializes and starts the APScheduler in a pure asyncio loop."""
    scheduler = AsyncIOScheduler(timezone=DEFAULT_TIMEZONE)
    # Execute twice daily inside standard Indian business operational windows
    scheduler.add_job(scheduled_tick, 'cron', hour=10, minute=0)
    scheduler.add_job(scheduled_tick, 'cron', hour=14, minute=30)
    
    print("[Orchestrator] Starting APScheduler...")
    scheduler.start()
    print("Ghost Protocol Data Stream Pipeline Started (Pure Scheduler)...")
    
    try:
        while True:
            await asyncio.sleep(3600)
    except (KeyboardInterrupt, SystemExit):
        print("Shutting down Ghost Protocol.")

if __name__ == "__main__":
    asyncio.run(main())
