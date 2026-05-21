import os
import uuid
import datetime
from serpapi import GoogleSearch
from dotenv import load_dotenv

from core.database_manager import upsert_job_lead, get_profile
from intelligence.embedding_engine import score_match, embed_text
from intelligence.genuity_checker import check_genuity

load_dotenv()

SERPAPI_API_KEY = os.getenv("SERPAPI_API_KEY", "")

def harvest_jobs(queries: list[str] = None, location: str = "Indore, India", limit: int = None):
    if queries is None:
        # Load from .env so it can be dynamically edited via Dashboard
        env_roles = os.getenv("TARGET_ROLES", "")
        if env_roles:
            # Reconstruct the boolean OR query from comma-separated roles in .env
            roles = [r.strip() for r in env_roles.split(",") if r.strip()]
            combined_query = " OR ".join([f'"{r}"' for r in roles])
            queries = [combined_query]
        else:
            # Fallback default
            queries = ['"AI engineer" OR "Machine Learning Engineer" OR "computer vision engineer" OR "NLP engineer" OR "data scientist"']
        
    profile = get_profile()
    if not profile:
        print("[Harvester] No master profile found in user_profiles.")
        return

    master_resume_json = profile.get("resume_data", {})
    master_resume = str(master_resume_json) if master_resume_json else ""
    if not SERPAPI_API_KEY:
        print("[Harvester] SERPAPI_API_KEY is not configured.")
        return
        
    print(f"[Harvester] Starting harvest for {len(queries)} queries...")
    
    saved_count = 0
    for q in queries:
        if limit and saved_count >= limit:
            break
            
        print(f"[Harvester] Querying: {q}")
        params = {
          "engine": "google_jobs",
          "q": q,
          "location": location,
          "api_key": SERPAPI_API_KEY
        }
        
        try:
            search = GoogleSearch(params)
            results = search.get_dict()
            jobs = results.get("jobs_results", [])
            
            for job in jobs:
                if limit and saved_count >= limit:
                    break
                    
                raw_id = job.get("job_id", str(uuid.uuid4()))
                import hashlib
                job_id = hashlib.md5(raw_id.encode()).hexdigest()
                
                title = job.get("title", "")
                company = job.get("company_name", "")
                description = job.get("description", "")
                related_links = job.get("related_links", [])
                apply_link = related_links[0].get("link", "") if related_links else ""
                if not apply_link:
                    apply_link = f"https://unknown-link.local/{job_id}"
                
                score = score_match(master_resume, description)
                
                # Enforce strict 75% (0.75) minimum match score threshold
                threshold = 0.75
                if score < threshold:
                    continue
                    
                genuity_status = check_genuity(company, description)
                # Create a valid UUID from the job hash
                job_uuid = str(uuid.UUID(hashlib.md5(raw_id.encode()).hexdigest()))
                
                lead = {
                    "job_id": job_uuid,
                    "title": title,
                    "company": company,
                    "job_url": apply_link,
                    "match_score": score,
                    "genuity_flag": genuity_status == "Verified",
                    "status": "Found",
                    "raw_description": description,
                    "source_platform": "Google SERP",
                    "embedding": embed_text(description)
                }
                
                saved = upsert_job_lead(lead)
                if saved:
                    print(f"[Harvester] Saved Lead: {title} @ {company} (Score: {score:.2f})")
                    saved_count += 1
                    
        except Exception as e:
            print(f"[Harvester] Error processing query '{q}': {e}")
            
    print("[Harvester] Harvesting complete.")
