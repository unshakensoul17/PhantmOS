import os
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uvicorn
from dotenv import load_dotenv, set_key

from core.database_manager import get_client, update_job_lead, get_profile, update_profile
from intelligence.harvesting_engine import harvest_jobs

load_dotenv()

app = FastAPI(title="Ghost Protocol Dashboard")

# Mount the tailored resumes directory so they are directly downloadable
RESUMES_DIR = os.path.join(os.getcwd(), "data", "resumes")
os.makedirs(RESUMES_DIR, exist_ok=True)
app.mount("/resumes", StaticFiles(directory=RESUMES_DIR), name="resumes")

from interface.telegram_delivery import app as telegram_app

class StatusUpdateRequest(BaseModel):
    status: str

# Mount Telegram Webhook app
app.mount("/telegram", telegram_app)

class HarvestRequest(BaseModel):
    query: str

class ProfileUpdateRequest(BaseModel):
    resume_data: dict

class EnvUpdateRequest(BaseModel):
    TARGET_ROLES: str = ""
    APOLLO_API_KEY: str = ""
    SNOV_CLIENT_ID: str = ""
    SNOV_CLIENT_SECRET: str = ""
    GROQ_API_KEY: str = ""
    SERPAPI_API_KEY: str = ""

@app.get("/")
async def serve_dashboard():
    """Serves the dashboard HTML interface."""
    html_path = os.path.join(os.getcwd(), "interface", "dashboard", "index.html")
    if not os.path.exists(html_path):
        raise HTTPException(status_code=404, detail="Dashboard index.html not found.")
    return FileResponse(html_path)

@app.get("/api/stats")
async def get_stats():
    """Aggregates real-time stats from Supabase."""
    client = get_client()
    try:
        # Fetch all leads status to aggregate locally to minimize DB query count
        resp = client.table("job_leads").select("status").execute()
        leads = resp.data or []
        
        stats = {
            "discovered": 0,
            "tailored": 0,
            "applied": 0,
            "dismissed": 0
        }
        
        for lead in leads:
            status = lead.get("status", "Discovered").lower()
            if status == "discovered":
                stats["discovered"] += 1
            elif status in ["tailored", "sent"]:
                stats["tailored"] += 1
            elif status == "applied":
                stats["applied"] += 1
            elif status == "dismissed":
                stats["dismissed"] += 1
                
        return JSONResponse(stats)
    except Exception as e:
        print(f"[Dashboard Backend] Error aggregating stats: {e}")
        return JSONResponse({"discovered": 0, "tailored": 0, "applied": 0, "dismissed": 0})

@app.get("/api/leads")
async def get_leads():
    """Fetches job leads sorted by discovered_at desc."""
    client = get_client()
    try:
        resp = client.table("job_leads").select("*").order("discovered_at", desc=True).limit(100).execute()
        return resp.data or []
    except Exception as e:
        print(f"[Dashboard Backend] Error fetching leads: {e}")
        return []

@app.post("/api/leads/{job_id}/status")
async def change_status(job_id: str, request: StatusUpdateRequest):
    """Updates a lead's status in Supabase."""
    valid_statuses = ["Discovered", "Tailored", "Sent", "Applied", "Dismissed"]
    if request.status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status type.")
        
    updated = update_job_lead(job_id, {"status": request.status})
    if not updated:
        raise HTTPException(status_code=404, detail="Lead not found or update failed.")
    return {"status": "ok", "updated_lead": updated}

@app.post("/api/harvest")
async def trigger_harvester(request: HarvestRequest, background_tasks: BackgroundTasks):
    """Triggers the harvester manually in the background."""
    from fastapi import BackgroundTasks
    background_tasks.add_task(harvest_jobs, queries=[request.query], limit=5)
    return {"status": "ok", "message": f"Harvesting triggered for {request.query}"}

@app.get("/api/profile")
async def fetch_profile():
    profile = get_profile()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")
    return profile.get("resume_data", {})

@app.post("/api/profile")
async def save_profile(request: ProfileUpdateRequest):
    updated = update_profile({"resume_data": request.resume_data})
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to update profile.")
    return {"status": "ok"}

@app.get("/api/env")
async def fetch_env():
    return {
        "TARGET_ROLES": os.getenv("TARGET_ROLES", ""),
        "APOLLO_API_KEY": os.getenv("APOLLO_API_KEY", ""),
        "SNOV_CLIENT_ID": os.getenv("SNOV_CLIENT_ID", ""),
        "SNOV_CLIENT_SECRET": os.getenv("SNOV_CLIENT_SECRET", ""),
        "GROQ_API_KEY": os.getenv("GROQ_API_KEY", ""),
        "SERPAPI_API_KEY": os.getenv("SERPAPI_API_KEY", "")
    }

@app.post("/api/env")
async def update_env(request: EnvUpdateRequest):
    env_path = os.path.join(os.getcwd(), ".env")
    
    # Safely update using set_key
    if request.TARGET_ROLES: set_key(env_path, "TARGET_ROLES", request.TARGET_ROLES)
    if request.APOLLO_API_KEY: set_key(env_path, "APOLLO_API_KEY", request.APOLLO_API_KEY)
    if request.SNOV_CLIENT_ID: set_key(env_path, "SNOV_CLIENT_ID", request.SNOV_CLIENT_ID)
    if request.SNOV_CLIENT_SECRET: set_key(env_path, "SNOV_CLIENT_SECRET", request.SNOV_CLIENT_SECRET)
    if request.GROQ_API_KEY: set_key(env_path, "GROQ_API_KEY", request.GROQ_API_KEY)
    if request.SERPAPI_API_KEY: set_key(env_path, "SERPAPI_API_KEY", request.SERPAPI_API_KEY)
    
    # Reload environment variables in current process
    load_dotenv(override=True)
    return {"status": "ok"}

if __name__ == "__main__":
    print("🚀 Ghost Protocol Dashboard Launching at http://localhost:8080 🚀")
    uvicorn.run(app, host="0.0.0.0", port=8080)
