from core.database_manager import get_client
import json

client = get_client()
resp = client.table("user_job_pipelines").select("job_id, status, score_band, match_score, notes, global_jobs(title)").execute()

found = 0
for r in resp.data:
    title = (r.get("global_jobs") or {}).get("title", "").lower()
    
    if "python" in title or "programmer" in title:
        print(f"Title: {title}")
        print(f"Status: {r.get('status')} | Band: {r.get('score_band')} | Score: {r.get('match_score')}")
        print(f"Notes: {r.get('notes')}")
        print("---")
        found += 1
        
        if found >= 5:
            break

if found == 0:
    print("No python/programmer jobs found in the database at all.")
