import asyncio
import os
from dotenv import load_dotenv

from intelligence.harvesting_engine import harvest_jobs
from core.database_manager import get_leads_by_status, update_job_lead, get_profile
from synthesis.context_researcher import get_company_context
from synthesis.resume_tailor import tailor_resume
from synthesis.pdf_factory import generate_pdf
from interface.telegram_delivery import send_job_card

load_dotenv()

async def test_run():
    print("\n--- 🚀 INITIATING GHOST PROTOCOL SINGLE-FIRE TEST 🚀 ---")
    
    # 1. Harvest exactly ONE job
    print("[Test] Step 1: Harvesting 1 Job via SerpApi...")
    harvest_jobs(queries=["Python Developer"], limit=1)
    
    # 2. Synthesis Factory
    print("[Test] Step 2: Synthesis for 'Found' leads...")
    leads_to_tailor = get_leads_by_status("Found", limit=1)
    profile = get_profile()
    master_resume_json = profile.get("resume_data", {}) if profile else {}
    
    if not master_resume_json:
        print("[Test] Cannot run synthesis: Master resume JSON empty.")
    else:
        for lead in leads_to_tailor:
            job_id = lead["job_id"]
            company = lead.get("company", "")
            description = lead.get("raw_description", "")
            
            # Deep Research
            print(f"[Test] Deep Researching: {company}")
            hooks = get_company_context(company)
            
            # Surgical Tailoring
            print(f"[Test] Tailoring Resume via Groq...")
            tailored_data = await tailor_resume(master_resume_json, description, hooks)
            if not tailored_data or "updated_resume_json" not in tailored_data:
                print(f"[Test] Tailoring failed for lead {job_id}")
                continue
                
            # PDF Generation
            print(f"[Test] Generating PDF via RenderCV...")
            pdf_dir = os.path.join(os.getcwd(), "data", "resumes")
            pdf_path = os.path.join(pdf_dir, f"{job_id}.pdf")
            
            final_pdf_path = generate_pdf(
                updated_resume_json=tailored_data["updated_resume_json"],
                output_path=pdf_path
            )
            
            if not final_pdf_path:
                print(f"[Test] PDF Generation failed for lead {job_id}")
                continue
            
            # Update State
            import json
            update_job_lead(job_id, {
                "status": "Tailored",
                "notes": json.dumps({
                    "cold_email": tailored_data.get("cold_email", ""),
                    "rationale": tailored_data.get("rationale", ""),
                    "resume_path": final_pdf_path
                })
            })
            print(f"[Test] Completed synthesis for {company}")
            
    # 3. Delivery Hub
    print("[Test] Step 3: Delivering 'Tailored' leads via Telegram...")
    ready_leads = get_leads_by_status("Tailored", limit=1)
    for lead in ready_leads:
        await send_job_card(lead)
        
    print("--- 🚀 GHOST PROTOCOL SINGLE-FIRE TEST COMPLETE 🚀 ---\n")

if __name__ == "__main__":
    asyncio.run(test_run())
