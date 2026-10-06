import os
import json
import pypdf
import requests
from fastapi import FastAPI, HTTPException, BackgroundTasks, Header, Depends, UploadFile, File, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uvicorn
from dotenv import load_dotenv, set_key
from concurrent.futures import ProcessPoolExecutor
import asyncio

from core.database_manager import get_client, update_job_lead, get_profile, update_profile, get_all_stats, _flatten_lead
from core.logger import get_logger
from synthesis.llm_groq import call_groq
from synthesis.company_research import generate_company_intelligence, generate_interview_playbook

load_dotenv(override=True)
logger = get_logger(__name__)

app = FastAPI(title="PhantmOS v3.0 SaaS Dashboard")

# Global ProcessPool to offload the heavy orchestrator without blocking the FastAPI event loop
process_pool = ProcessPoolExecutor(max_workers=1)

# Sync wrappers — ProcessPoolExecutor only accepts plain sync functions.
# These bridge the gap between the async orchestrators and the executor.
def _run_pipeline(query: str = None, user_id: str = None):
    import asyncio
    from main_orchestrator import process_pipeline
    asyncio.run(process_pipeline(manual_query=query, target_user_id=user_id))

def _run_digest():
    import asyncio
    from delivery.daily_digest import send_daily_digest
    asyncio.run(send_daily_digest())


import time

_TOKEN_CACHE = {} # token -> {"user_id": id, "expires": time.time() + 300}

DEMO_USER_ID = "00000000-0000-0000-0000-000000000000"

def generate_demo_leads(query: str = "") -> list:
    q = (query or "").strip()
    q_lower = q.lower()
    
    if "intern" in q_lower:
        return [
            {
                "id": "demo-intern-1", "job_id": "demo-intern-1",
                "title": "AI / Machine Learning Research Intern", "company": "OpenAI",
                "location": "Remote (Global)", "salary": "$50 - $70 / hr",
                "score": 98, "score_total": 98, "score_band": "A", "status": "Found",
                "url": "https://openai.com/careers", "source": "Himalayas",
                "justification": f"Strong candidate match for '{q}' role: PyTorch, model fine-tuning, and LLM evaluation foundation.",
                "created_at": "2026-10-04T12:00:00Z"
            },
            {
                "id": "demo-intern-2", "job_id": "demo-intern-2",
                "title": "Machine Learning Engineering Intern", "company": "Hugging Face",
                "location": "Remote, Worldwide", "salary": "$45 - $60 / hr",
                "score": 94, "score_total": 94, "score_band": "A", "status": "Approved",
                "url": "https://huggingface.co/join-us", "source": "Remotive",
                "justification": f"High relevance for '{q}': Transformers, dataset pipelines, and open-weights optimization.",
                "created_at": "2026-10-04T11:45:00Z"
            },
            {
                "id": "demo-intern-3", "job_id": "demo-intern-3",
                "title": "Generative AI & LLM Systems Intern", "company": "Cohere",
                "location": "Remote", "salary": "$40 - $55 / hr",
                "score": 91, "score_total": 91, "score_band": "A", "status": "Found",
                "url": "https://cohere.com/careers", "source": "HackerNews",
                "justification": f"Excellent overlap with '{q}': RAG architectures, prompt pipelines, and embeddings.",
                "created_at": "2026-10-04T11:00:00Z"
            },
            {
                "id": "demo-intern-4", "job_id": "demo-intern-4",
                "title": "Applied AI / Computer Vision Intern", "company": "Midjourney",
                "location": "Remote", "salary": "$45 - $65 / hr",
                "score": 88, "score_total": 88, "score_band": "B", "status": "Applied",
                "url": "https://midjourney.com", "source": "Arbeitnow",
                "justification": f"Candidate demonstrates required core competencies for '{q}' internship.",
                "created_at": "2026-10-04T10:15:00Z"
            },
            {
                "id": "demo-intern-5", "job_id": "demo-intern-5",
                "title": "Data Science & Deep Learning Intern", "company": "Scale AI",
                "location": "Remote, North America", "salary": "$40 - $50 / hr",
                "score": 85, "score_total": 85, "score_band": "B", "status": "Interviewing",
                "url": "https://scale.com/careers", "source": "Himalayas",
                "justification": f"Matched skills in Python, NumPy, SciPy, and neural network training for '{q}'.",
                "created_at": "2026-10-04T09:30:00Z"
            }
        ]
    elif "full" in q_lower or "stack" in q_lower or "dev" in q_lower or "software" in q_lower:
        return [
            {
                "id": "demo-fs-1", "job_id": "demo-fs-1",
                "title": "Full Stack Developer (React & Python/FastAPI)", "company": "Vercel",
                "location": "Remote (Worldwide)", "salary": "$150,000 - $195,000",
                "score": 97, "score_total": 97, "score_band": "A", "status": "Found",
                "url": "https://vercel.com/careers", "source": "Remotive",
                "justification": f"Direct match for '{q}': React 19, Next.js/Vite, TypeScript, and modern API architecture.",
                "created_at": "2026-10-04T12:00:00Z"
            },
            {
                "id": "demo-fs-2", "job_id": "demo-fs-2",
                "title": "Senior Full Stack Software Engineer", "company": "Supabase",
                "location": "Remote, Global", "salary": "$160,000 - $210,000",
                "score": 94, "score_total": 94, "score_band": "A", "status": "Approved",
                "url": "https://supabase.com/careers", "source": "HackerNews",
                "justification": f"Exceptional overlap for '{q}': PostgreSQL, distributed backends, and responsive dashboard UIs.",
                "created_at": "2026-10-04T11:30:00Z"
            },
            {
                "id": "demo-fs-3", "job_id": "demo-fs-3",
                "title": "Full Stack Product Engineer", "company": "Linear",
                "location": "Remote", "salary": "$165,000 - $215,000",
                "score": 91, "score_total": 91, "score_band": "A", "status": "Found",
                "url": "https://linear.app/careers", "source": "Himalayas",
                "justification": f"High relevance for '{q}': Real-time WebSockets, state sync, and high-polish frontend engineering.",
                "created_at": "2026-10-04T11:00:00Z"
            },
            {
                "id": "demo-fs-4", "job_id": "demo-fs-4",
                "title": "Full Stack AI Applications Engineer", "company": "Scale AI",
                "location": "Remote", "salary": "$155,000 - $200,000",
                "score": 88, "score_total": 88, "score_band": "B", "status": "Applied",
                "url": "https://scale.com/careers", "source": "Arbeitnow",
                "justification": f"Matches '{q}' with hands-on AI workflow builder and full-stack integration expertise.",
                "created_at": "2026-10-04T10:15:00Z"
            },
            {
                "id": "demo-fs-5", "job_id": "demo-fs-5",
                "title": "Lead Full Stack Engineer", "company": "Stripe",
                "location": "Remote, US/EU", "salary": "$175,000 - $230,000",
                "score": 86, "score_total": 86, "score_band": "B", "status": "Interviewing",
                "url": "https://stripe.com/jobs", "source": "Himalayas",
                "justification": f"Targeted role match for '{q}' involving payment workflows and full-stack scalability.",
                "created_at": "2026-10-04T09:30:00Z"
            }
        ]
    elif "front" in q_lower or "react" in q_lower or "web" in q_lower:
        return [
            {
                "id": "demo-fe-1", "job_id": "demo-fe-1",
                "title": "Senior Frontend Engineer (React/TypeScript)", "company": "Vercel",
                "location": "Remote", "salary": "$145,000 - $185,000",
                "score": 96, "score_total": 96, "score_band": "A", "status": "Found",
                "url": "https://vercel.com/careers", "source": "Remotive",
                "justification": f"Exact match for '{q}': Tailwind, component architectures, and responsive micro-animations.",
                "created_at": "2026-10-04T12:00:00Z"
            },
            {
                "id": "demo-fe-2", "job_id": "demo-fe-2",
                "title": "Lead UI/UX Frontend Developer", "company": "Figma",
                "location": "Remote, Global", "salary": "$155,000 - $195,000",
                "score": 92, "score_total": 92, "score_band": "A", "status": "Approved",
                "url": "https://figma.com/careers", "source": "Himalayas",
                "justification": f"High relevance for '{q}': Design system engineering and Canvas/WebGL rendering.",
                "created_at": "2026-10-04T11:00:00Z"
            }
        ]
    elif "back" in q_lower or "python" in q_lower:
        return [
            {
                "id": "demo-be-1", "job_id": "demo-be-1",
                "title": "Senior Python Backend Architect", "company": "Supabase",
                "location": "Remote", "salary": "$160,000 - $200,000",
                "score": 96, "score_total": 96, "score_band": "A", "status": "Found",
                "url": "https://supabase.com/careers", "source": "HackerNews",
                "justification": f"High overlap on PostgreSQL, FastAPI, AsyncIO, and multi-tenant architectures.",
                "created_at": "2026-10-04T12:00:00Z"
            },
            {
                "id": "demo-be-2", "job_id": "demo-be-2",
                "title": "Distributed Systems Python Engineer", "company": "Anthropic",
                "location": "Remote, Global", "salary": "$170,000 - $220,000",
                "score": 93, "score_total": 93, "score_band": "A", "status": "Approved",
                "url": "https://anthropic.com/careers", "source": "Himalayas",
                "justification": f"Strong alignment for '{q}' involving high-throughput async pipelines and database scaling.",
                "created_at": "2026-10-04T11:00:00Z"
            }
        ]
    elif q:
        clean_title = q.title()
        return [
            {
                "id": "demo-gen-1", "job_id": "demo-gen-1",
                "title": f"Senior {clean_title}", "company": "Anthropic",
                "location": "Remote, Global", "salary": "$150,000 - $200,000",
                "score": 96, "score_total": 96, "score_band": "A", "status": "Found",
                "url": "https://anthropic.com/careers", "source": "Himalayas",
                "justification": f"Targeted neural match for your custom role query: {q}.",
                "created_at": "2026-10-04T12:00:00Z"
            },
            {
                "id": "demo-gen-2", "job_id": "demo-gen-2",
                "title": f"Staff {clean_title}", "company": "Vercel",
                "location": "Remote (Worldwide)", "salary": "$145,000 - $190,000",
                "score": 92, "score_total": 92, "score_band": "A", "status": "Approved",
                "url": "https://vercel.com/careers", "source": "Remotive",
                "justification": f"High relevance based on semantic similarity to '{q}'.",
                "created_at": "2026-10-04T11:00:00Z"
            },
            {
                "id": "demo-gen-3", "job_id": "demo-gen-3",
                "title": f"{clean_title} Specialist", "company": "Supabase",
                "location": "Remote", "salary": "$140,000 - $185,000",
                "score": 88, "score_total": 88, "score_band": "B", "status": "Applied",
                "url": "https://supabase.com/careers", "source": "HackerNews",
                "justification": f"Strong alignment with target domain and core skills for '{q}'.",
                "created_at": "2026-10-04T10:00:00Z"
            }
        ]
    return [
        {
            "id": "demo-1", "job_id": "demo-1", "title": "Senior AI Systems Engineer", "company": "Anthropic",
            "location": "Remote, Global", "salary": "$180,000 - $240,000", "score": 96, "score_total": 96,
            "score_band": "A", "status": "Found", "url": "https://anthropic.com/careers", "source": "Himalayas",
            "justification": "Exceptional fit with candidate's Python, LLM orchestration, and distributed pipeline background.",
            "created_at": "2026-10-04T12:00:00Z"
        },
        {
            "id": "demo-2", "job_id": "demo-2", "title": "Staff Full-Stack AI Engineer", "company": "Vercel",
            "location": "Remote (Worldwide)", "salary": "$170,000 - $210,000", "score": 91, "score_total": 91,
            "score_band": "A", "status": "Approved", "url": "https://vercel.com/careers", "source": "Remotive",
            "justification": "Strong match with React 19, TypeScript, and autonomous agents expertise.",
            "created_at": "2026-10-04T11:30:00Z"
        },
        {
            "id": "demo-3", "job_id": "demo-3", "title": "Senior Python Backend Architect", "company": "Supabase",
            "location": "Remote", "salary": "$160,000 - $200,000", "score": 88, "score_total": 88,
            "score_band": "B", "status": "Applied", "url": "https://supabase.com/careers", "source": "HackerNews",
            "justification": "High overlap on PostgreSQL, FastAPI, AsyncIO, and multi-tenant architectures.",
            "created_at": "2026-10-04T10:15:00Z"
        },
        {
            "id": "demo-4", "job_id": "demo-4", "title": "Machine Learning Engineer", "company": "Mistral AI",
            "location": "Remote, EU/US", "salary": "$175,000 - $225,000", "score": 84, "score_total": 84,
            "score_band": "B", "status": "Interviewing", "url": "https://mistral.ai/careers", "source": "Arbeitnow",
            "justification": "Candidate has hands-on experience with LLM quantization, Hugging Face, and embedding fine-tuning.",
            "created_at": "2026-10-04T09:00:00Z"
        },
        {
            "id": "demo-5", "job_id": "demo-5", "title": "Principal Agentic AI Engineer", "company": "Perplexity",
            "location": "Remote", "salary": "$200,000 - $260,000", "score": 93, "score_total": 93,
            "score_band": "A", "status": "Offer", "url": "https://perplexity.ai/careers", "source": "Himalayas",
            "justification": "Deep search, DuckDuckGo scraper integration, and autonomous tool calling expertise.",
            "created_at": "2026-10-04T08:00:00Z"
        }
    ]

DEMO_LEADS = generate_demo_leads()

DEMO_PROFILE = {
    "target_role": "Senior AI Systems Engineer",
    "cv": {
        "name": "Ali Ahmad", "email": "aliahmad071205@gmail.com", "phone": "+91-9876543210", "location": "Remote / India",
        "social_networks": [
            {"network": "LinkedIn", "username": "aliahmad", "url": "https://linkedin.com/in/aliahmad"},
            {"network": "GitHub", "username": "aliahmad", "url": "https://github.com/aliahmad"}
        ],
        "sections": {
            "summary": ["Autonomous agentic AI engineer specializing in LLM cascades, distributed data scraping, and high-throughput backend architecture."],
            "education": [{"institution": "Indian Institute of Technology", "area": "Computer Science", "degree": "B.Tech", "date": "2020 - 2024", "highlights": ["Dean's List"]}],
            "experience": [{"company": "Phantm Systems", "position": "Senior AI Engineer", "location": "Remote", "date": "2024 - Present", "highlights": ["Engineered 6-agent autonomous pipeline orchestrating real-time job discovery and automated resume tailoring."]}],
            "projects": [{"name": "PhantmOS Engine", "date": "2025", "url": "https://github.com/...", "highlights": ["Engineered multi-agent LLM waterfall with BM25 pre-filtering and Typst PDF generation."]}],
            "skills": [{"label": "Languages & Frameworks", "details": "Python, TypeScript, FastAPI, React 19, PyTorch, Docker, Supabase"}]
        }
    }
}

DEMO_SETTINGS = {
    "llm": {"groq_api_key": "***", "gemini_api_key": "***", "primary_engine": "groq|llama-3.1-8b-instant", "secondary_engine": "gemini|gemini-1.5-flash"},
    "scoring": {"target_roles": ["AI Engineer", "Python Backend", "Full Stack"], "blacklist_keywords": ["Senior Director"], "blacklist_companies": ["Revature"], "telegram_threshold": 80},
    "scheduler": {"frequency_hours": 4, "pause_weekends": True},
    "notifications": {"daily_digest": True, "instant_telegram_alerts": False}
}

def get_current_user_id(authorization: str = Header(None)) -> str:
    """Strictly validate Supabase JWT auth token with local 5-min caching."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized: Missing or invalid token format")

    token = authorization.split(" ")[1]
    if token == "guest-demo-token":
        return DEMO_USER_ID
        
    now = time.time()
    if token in _TOKEN_CACHE and _TOKEN_CACHE[token]["expires"] > now:
        return _TOKEN_CACHE[token]["user_id"]
        
    try:
        client = get_client()
        user_res = client.auth.get_user(token)
        if not user_res or not user_res.user:
            raise HTTPException(status_code=401, detail="Unauthorized: Invalid token")
            
        user_id = user_res.user.id
        _TOKEN_CACHE[token] = {"user_id": user_id, "expires": now + 300}
        return user_id
    except Exception as e:
        logger.error(f"JWT Verification failed: {e}")
        raise HTTPException(status_code=401, detail="Unauthorized: Token verification failed")

# Static resumes dir (local fallback — Supabase Storage is primary in v2)
RESUMES_DIR = os.path.join(os.getcwd(), "data", "resumes")
os.makedirs(RESUMES_DIR, exist_ok=True)
app.mount("/resumes", StaticFiles(directory=RESUMES_DIR), name="resumes")

# Mount Telegram webhook sub-app
from interface.telegram_delivery import app as telegram_app
app.mount("/telegram", telegram_app)


import json

# ── Request models ────────────────────────────────────────────────────────────

class CreditsUpdateRequest(BaseModel):
    credits: int

class StatusUpdateRequest(BaseModel):
    status: str

class HarvestRequest(BaseModel):
    query: str = ""

class ProfileUpdateRequest(BaseModel):
    resume_data: dict

class BYOKUpdateRequest(BaseModel):
    GEMINI_API_KEY: str = ""
    GROQ_API_KEY:   str = ""
    HF_API_KEY:     str = ""

class EnvUpdateRequest(BaseModel):
    JINA_API_KEY:        str = ""
    GEMINI_API_KEY:      str = ""
    HF_API_KEY:          str = ""
    GROQ_API_KEY:        str = ""
    CALLMEBOT_API_KEY:   str = ""
    CALLMEBOT_PHONE:     str = ""
    TARGET_ROLES:        str = ""
    TELEGRAM_BOT_TOKEN:  str = ""
    GMAIL_USER:          str = ""
    GMAIL_APP_PASSWORD:  str = ""


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/api/stats")
async def get_stats(user_id: str = Depends(get_current_user_id)):
    """Real-time pipeline stats — includes v2 band counts."""
    if user_id == DEMO_USER_ID:
        return JSONResponse({
            "hot": 16, "warm": 22, "cold": 10, "discovered": 48,
            "tailored": 12, "applied": 10, "dismissed": 2, "total": 48,
            "interviews": 3, "approved": 6,
            "sources": {"Himalayas": 18, "Remotive": 15, "HackerNews": 9, "Arbeitnow": 6},
            "scores": [96, 93, 91, 88, 84, 82, 79, 75, 72, 68],
            "weekly_applications": [1, 2, 4, 3, 5, 2, 6, 7, 4, 8, 9, 3],
            "credits": 28, "max_credits": 1000
        })
    try:
        stats = get_all_stats(user_id)
        import datetime
        now = datetime.datetime.now(datetime.timezone.utc)
        twelve_weeks_ago = now - datetime.timedelta(weeks=12)
        
        client = get_client()
        app_resp = client.table("user_job_pipelines").select("created_at").eq("user_id", user_id).eq("status", "Applied").gte("created_at", twelve_weeks_ago.isoformat()).execute()
        
        weeks_data = [0] * 12
        for row in (app_resp.data or []):
            try:
                dt_str = row["created_at"].replace("Z", "+00:00")
                if "." not in dt_str and "+" in dt_str:
                    pass
                dt = datetime.datetime.fromisoformat(dt_str)
                delta = now - dt
                week_idx = 11 - (delta.days // 7)
                if 0 <= week_idx < 12:
                    weeks_data[week_idx] += 1
            except Exception:
                pass

        return JSONResponse({
            "hot":        stats.get("hot", 0),
            "warm":       stats.get("warm", 0),
            "cold":       stats.get("cold", 0),
            "discovered": stats.get("found", 0),
            "tailored":   stats.get("tailored", 0),
            "applied":    stats.get("applied", 0),
            "dismissed":  stats.get("dismissed", 0),
            "total":      stats.get("total", 0),
            "interviews": stats.get("interviews", 0),
            "sources":    stats.get("sources", {}),
            "scores":     stats.get("scores", []),
            "approved":   stats.get("approved", 0),
            "weekly_applications": weeks_data,
            "credits":    get_profile(user_id).get("credits", 0) if get_profile(user_id) else 0,
            "max_credits": 1000
        })
    except Exception as e:
        logger.error(f"Stats error: {e}")
        return JSONResponse({"hot": 0, "warm": 0, "cold": 0, "discovered": 0,
                             "tailored": 0, "applied": 0, "dismissed": 0, "total": 0, "sources": {}, "scores": [], "approved": 0})


@app.get("/api/leads")
async def get_leads(
    band: str = "", 
    status: str = "", 
    limit: int = 50, 
    cursor: str = "", 
    user_id: str = Depends(get_current_user_id)
):
    """Fetch job leads with cursor-based pagination."""
    if user_id == DEMO_USER_ID:
        res = list(DEMO_LEADS)
        if status:
            res = [l for l in res if l.get("status") == status]
        if band:
            res = [l for l in res if l.get("score_band") == band.upper()]
        return res

    client = get_client()
    try:
        q = client.table("user_job_pipelines").select("*, global_jobs(*)").eq("user_id", user_id).order("created_at", desc=True)
        if band:
            q = q.eq("score_band", band.upper())
        if status:
            q = q.eq("status", status)
        if cursor:
            # Decode the cursor if it was url-encoded, it should be an ISO timestamp
            import urllib.parse
            decoded_cursor = urllib.parse.unquote(cursor)
            q = q.lt("created_at", decoded_cursor)
            
        resp = q.limit(limit).execute()
        
        leads = []
        for row in (resp.data or []):
            flat = _flatten_lead(row)
            # Add score_total and score for frontend compatibility
            match_score = flat.get("match_score", 0) or 0
            score_val = int(match_score * 100) if match_score <= 1.0 else int(match_score)
            flat["score_total"] = score_val
            flat["score"] = score_val
            leads.append(flat)
            
        # Implement LIFO for identical batches
        from itertools import groupby
        lifo_leads = []
        for _, group in groupby(leads, key=lambda x: x.get("created_at")):
            lifo_leads.extend(reversed(list(group)))
            
        return lifo_leads
    except Exception as e:
        logger.error(f"Leads fetch error: {e}")
        return []


@app.post("/api/leads/{job_id}/status")
async def change_lead_status(job_id: str, request: StatusUpdateRequest, user_id: str = Depends(get_current_user_id)):
    valid = ["Found", "Tailored", "Approved", "Applied", "Dismissed", "Interviewing", "Offer", "Rejected"]
    if request.status not in valid:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid}")
    if user_id == DEMO_USER_ID:
        for l in DEMO_LEADS:
            if l.get("id") == job_id or l.get("job_id") == job_id:
                l["status"] = request.status
        return {"status": "ok"}
    updated = update_job_lead(job_id, {"status": request.status}, user_id=user_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Lead not found or update failed.")
    return {"status": "ok", "updated_lead": updated}


@app.post("/api/harvest")
async def trigger_pipeline(request: HarvestRequest, user_id: str = Depends(get_current_user_id)):
    """Trigger the full pipeline run scoped to the authenticated user only."""
    if user_id == DEMO_USER_ID:
        global DEMO_LEADS
        DEMO_LEADS = generate_demo_leads(request.query)
        q = (request.query or "").strip()
        return {
            "status": "ok",
            "message": f"PhantmOS v3.0 pipeline harvested opportunities for '{q or 'All Roles'}'.",
            "stages": ["harvest", "scoring", "tailoring", "pdf", "delivery"],
        }

    asyncio.get_running_loop().run_in_executor(
        process_pool,
        _run_pipeline,
        request.query or None,
        user_id,
    )
    return {
        "status": "ok",
        "message": "PhantmOS v3.0 pipeline triggered.",
        "stages": ["harvest", "scoring", "tailoring", "pdf", "delivery"],
    }


@app.post("/api/digest")
async def trigger_digest(user_id: str = Depends(get_current_user_id)):
    """Manually trigger the daily digest."""
    asyncio.get_running_loop().run_in_executor(process_pool, _run_digest)
    return {"status": "ok", "message": "Daily digest triggered."}


@app.get("/api/profile")
async def fetch_profile(user_id: str = Depends(get_current_user_id)):
    if user_id == DEMO_USER_ID:
        return DEMO_PROFILE
    profile = get_profile(user_id)
    if not profile:
        return DEMO_PROFILE
    return profile.get("resume_data") or DEMO_PROFILE


@app.post("/api/profile")
async def save_profile(request: ProfileUpdateRequest, user_id: str = Depends(get_current_user_id)):
    """Save updated resume JSON for this user. Also invalidates the embedding cache and updates discovery leads."""
    target_role = request.resume_data.get("target_role") or ""
    if not target_role and "sections" in request.resume_data.get("cv", {}):
        exp = request.resume_data["cv"]["sections"].get("experience", [])
        if exp and exp[0].get("position"):
            target_role = exp[0]["position"]

    if user_id == DEMO_USER_ID:
        global DEMO_PROFILE, DEMO_LEADS
        DEMO_PROFILE = request.resume_data
        if target_role:
            DEMO_LEADS = generate_demo_leads(target_role)
        return {"status": "ok", "message": "Profile saved and discovery leads updated."}
    updated = update_profile({"resume_data": request.resume_data}, user_id=user_id)
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to update profile.")
    try:
        from intelligence.embedding_engine import invalidate_master_cache
        invalidate_master_cache(user_id)
    except Exception:
        pass
    return {"status": "ok", "message": "Profile saved. Embedding cache invalidated."}


@app.get("/api/byok")
async def fetch_byok(user_id: str = Depends(get_current_user_id)):
    """Retrieve decrypted credentials masking values for security."""
    if user_id == DEMO_USER_ID:
        return {
            "GEMINI_API_KEY": "***",
            "GROQ_API_KEY":   "***",
            "HF_API_KEY":     "",
            "credits":        28,
        }
    profile = get_profile(user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")
    
    return {
        "GEMINI_API_KEY": "***" if profile.get("has_gemini_key") else "",
        "GROQ_API_KEY":   "***" if profile.get("has_groq_key") else "",
        "HF_API_KEY":     "***" if profile.get("has_hf_key") else "",
        "credits":        profile.get("credits", 0),
    }


@app.post("/api/byok")
async def save_byok(request: BYOKUpdateRequest, user_id: str = Depends(get_current_user_id)):
    """Securely encrypt and update the user's custom BYOK keys."""
    profile = get_profile(user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")
    
    from core.encryption import encrypt_key
    enc_keys = profile.get("encrypted_keys") or {}
    if isinstance(enc_keys, str):
        try:
            enc_keys = json.loads(enc_keys)
        except Exception:
            enc_keys = {}

    updates = {}
    profile_updates = {}
    if request.GEMINI_API_KEY and request.GEMINI_API_KEY != "***":
        updates["GEMINI_API_KEY"] = encrypt_key(request.GEMINI_API_KEY)
        profile_updates["has_gemini_key"] = True
    if request.GROQ_API_KEY and request.GROQ_API_KEY != "***":
        updates["GROQ_API_KEY"] = encrypt_key(request.GROQ_API_KEY)
        profile_updates["has_groq_key"] = True
    if request.HF_API_KEY and request.HF_API_KEY != "***":
        updates["HF_API_KEY"] = encrypt_key(request.HF_API_KEY)
        profile_updates["has_hf_key"] = True

    for k, v in updates.items():
        enc_keys[k] = v

    profile_updates["encrypted_keys"] = enc_keys
    updated = update_profile(profile_updates, user_id=user_id)
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to save credentials.")
    return {"status": "ok", "message": "Custom credentials saved successfully."}


@app.get("/api/telegram/link")
async def get_telegram_link(user_id: str = Depends(get_current_user_id)):
    """Generate the dynamic Telegram Bot deep link for the user."""
    from interface.telegram_delivery import bot
    if not bot:
        return {"link": ""}
    try:
        me = await bot.get_me()
        bot_username = me.username
        return {"link": f"https://t.me/{bot_username}?start={user_id}"}
    except Exception as e:
        logger.error(f"Error fetching Telegram bot details: {e}")
        return {"link": ""}


@app.get("/api/env")
async def fetch_env():
    """Return system env info (JINA_API_KEY etc.)."""
    return {
        "JINA_API_KEY":       "***" if os.getenv("JINA_API_KEY") else "",
        "TELEGRAM_BOT_TOKEN": "***" if os.getenv("TELEGRAM_BOT_TOKEN") else "",
    }


# ── Admin Routes ──────────────────────────────────────────────────────────────

@app.post("/api/profile/upload")
async def upload_master_resume(
    resume: UploadFile = File(...), 
    user_id: str = Depends(get_current_user_id)
):
    try:
        os.makedirs(RESUMES_DIR, exist_ok=True)
        file_path = os.path.join(RESUMES_DIR, f"master_{user_id}.pdf")
        with open(file_path, "wb") as f:
            f.write(await resume.read())
            
        text = ""
        with open(file_path, "rb") as f:
            reader = pypdf.PdfReader(f)
            for page in reader.pages:
                text += page.extract_text() + "\n"
        
        # Truncate text to avoid 413 Payload Too Large errors (Groq token limit)
        text = text[:10000]
                
        system_prompt = '''You are an expert resume parser. Extract the user's details from the following resume text and output ONLY a valid JSON object matching the strict RenderCV schema below. 
If the text provided does NOT appear to be a resume or CV, output exactly: {"error": "invalid_resume"}
Do NOT wrap the output in markdown blocks (e.g. ```json). Just output raw JSON.

Schema requirements:
{
  "cv": {
    "name": "Full Name",
    "email": "Email",
    "phone": "Phone number",
    "location": "City, State",
    "social_networks": [ {"network": "LinkedIn", "username": "username"} ],
    "sections": {
      "summary": ["Sentence 1.", "Sentence 2."],
      "education": [
        {
          "institution": "University Name",
          "area": "Major/Field",
          "degree": "B.S. or M.S. etc",
          "start_date": "YYYY-MM",
          "end_date": "YYYY-MM"
        }
      ],
      "experience": [
        {
          "company": "Company Name",
          "position": "Job Title",
          "location": "City, State",
          "start_date": "YYYY-MM",
          "end_date": "YYYY-MM or present",
          "highlights": ["Bullet point 1", "Bullet point 2"]
        }
      ],
      "projects": [
        {
          "name": "Project Name",
          "date": "YYYY-MM to YYYY-MM",
          "url": "https://github.com/...",
          "highlights": ["Bullet point 1", "Bullet point 2"]
        }
      ],
      "skills": [
        {"label": "Category (e.g. Languages)", "details": "Skill 1, Skill 2"}
      ]
    }
  }
}
'''
        user_prompt = f"RESUME TEXT:\n{text[:8000]}"
        
        parsed_data = await call_groq(system_prompt, user_prompt)
        
        # Strip markdown if Gemini included it (e.g. ```json)
        if isinstance(parsed_data, str):
            if parsed_data.startswith("```json"):
                parsed_data = parsed_data[7:-3]
            parsed_data = json.loads(parsed_data)
            
        if "error" in parsed_data:
            os.remove(file_path)
            raise HTTPException(status_code=400, detail="The uploaded PDF does not appear to be a valid resume.")
            
        json_path = os.path.join(RESUMES_DIR, f"master_{user_id}.json")
        with open(json_path, "w") as f:
            json.dump(parsed_data, f)
            
        return {"status": "success", "profile": parsed_data}
    except Exception as e:
        logger.error(f"Error processing resume upload: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/admin/users")
async def admin_list_users():
    """List all profiles with basic state indicators."""
    try:
        resp = get_client().table("user_profiles").select("id, full_name, credits, encrypted_keys, telegram_chat_id").execute()
        users = resp.data or []
        for u in users:
            enc = u.get("encrypted_keys") or {}
            if isinstance(enc, str):
                try:
                    enc = json.loads(enc)
                except Exception:
                    enc = {}
            u["has_byok"] = any(enc.values())
            u.pop("encrypted_keys", None)
        return users
    except Exception as e:
        logger.error(f"Admin list users error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/admin/users/{user_id}/credits")
async def admin_update_credits(user_id: str, request: CreditsUpdateRequest):
    """Directly update credits count for a user."""
    updated = update_profile({"credits": request.credits}, user_id=user_id)
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to update credits.")
    return {"status": "ok", "message": f"Credits set to {request.credits}."}


@app.post("/api/admin/users/{user_id}/harvest")
async def admin_trigger_user_pipeline(user_id: str, background_tasks: BackgroundTasks):
    """Trigger the pipeline specifically for this user."""
    from main_orchestrator import process_pipeline
    background_tasks.add_task(process_pipeline, target_user_id=user_id)
    return {"status": "ok", "message": f"Pipeline scheduled for user {user_id}."}


@app.post("/api/admin/harvest")
async def admin_trigger_global_pipeline(background_tasks: BackgroundTasks):
    """Trigger the global pipeline for all users."""
    from main_orchestrator import process_pipeline
    background_tasks.add_task(process_pipeline)
    return {"status": "ok", "message": "Global pipeline scheduled."}


@app.get("/api/admin/logs")
async def admin_get_logs(limit: int = 50):
    """Fetch recent system-wide stage logs."""
    try:
        resp = get_client().table("stage_logs").select("*").order("created_at", desc=True).limit(limit).execute()
        return resp.data or []
    except Exception as e:
        logger.error(f"Admin fetch logs error: {e}")
        return []


@app.get("/api/companies/research")
async def get_company_research(company: str):
    """Generate OSINT tech stack and risk assessment for a company."""
    if not company:
        raise HTTPException(status_code=400, detail="Company name required")
    data = await generate_company_intelligence(company)
    return data


@app.get("/api/companies/playbook")
async def get_interview_playbook(company: str, role: str = "Software Engineer"):
    """Generate an automated interview playbook."""
    if not company:
        raise HTTPException(status_code=400, detail="Company name required")
    data = await generate_interview_playbook(company, role)
    return data


class PhantmWriterRequest(BaseModel):
    job_id: str = ""
    company: str
    role: str

@app.post("/api/applications/phantm-writer")
async def phantm_writer_followup(request: PhantmWriterRequest, user_id: str = Depends(get_current_user_id)):
    """Generate a highly professional follow-up email."""
    if user_id == DEMO_USER_ID:
        return {
            "status": "ok",
            "email": f"Subject: Following up on {request.role} Application\n\nDear {request.company} Hiring Team,\n\nI recently applied for the {request.role} role at {request.company} and wanted to briefly follow up. Given my background in Python, autonomous AI pipelines, and distributed backends, I am very excited about the opportunity to contribute to your team.\n\nPlease let me know if you would like any additional portfolio or code samples.\n\nWarm regards,\nAli Ahmad",
            "target_email": f"hiring@{request.company.lower().replace(' ', '')}.com"
        }

    # Fetch user preferences for BYOK
    profile = get_profile(user_id) or {}
    prefs = profile.get("preferences") or {}
    
    system_prompt = """You are an elite executive career coach.
Write a concise, professional follow-up email to a recruiter or hiring manager.
The applicant applied 5+ days ago and hasn't heard back. 
The tone should be polite, enthusiastic, but not desperate. 
Draw upon the provided candidate context and job context to make the email highly personalized.

CRITICAL:
- Do NOT use ANY placeholders like [Hiring Manager's Name] or [number of days]. 
- If you don't know the hiring manager's name, use "Dear Hiring Team" or "Dear [Company] Team" without brackets. 
- Just say "recently" or "a few days ago" instead of a specific number of days.
- Write the final ready-to-send text ONLY.

Output ONLY valid JSON in the following format, with no markdown or extra text:
{
  "subject": "The email subject line here",
  "body": "The full email body here"
}"""
    
    # Extract candidate context
    resume = profile.get("resume_data") or {}
    cv = resume.get("cv") or {}
    candidate_name = cv.get("name", "The Candidate")
    experience_list = cv.get("experience", [])
    candidate_experience = json.dumps(experience_list[:2]) if experience_list else "No experience data provided."
    
    # Extract job context
    job_desc = ""
    if request.job_id:
        try:
            client = get_client()
            resp = client.table("global_jobs").select("description").eq("id", request.job_id).execute()
            if resp.data and len(resp.data) > 0:
                job_desc = resp.data[0].get("description", "")
        except Exception:
            pass

    user_prompt = f"""Write a follow-up email for the {request.role} role at {request.company}.
Candidate Name: {candidate_name}

Candidate's Recent Experience:
{candidate_experience}

Job Context:
{job_desc[:1500] if job_desc else "N/A"}
"""
    
    try:
        from intelligence.email_hunter import find_company_email
        import asyncio
        loop = asyncio.get_event_loop()
        
        response_json, target_email = await asyncio.gather(
            call_groq(system_prompt, user_prompt, api_key=prefs.get("GROQ_API_KEY") or None),
            loop.run_in_executor(None, find_company_email, request.company)
        )
        
        subject = response_json.get("subject", "Following up on my application")
        body = response_json.get("body", "Error parsing email body.")
        email_text = f"Subject: {subject}\n\n{body}"
        return {"status": "ok", "email": email_text, "target_email": target_email or ""}
    except Exception as e:
        logger.error(f"Phantm Writer Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate email")


class SendEmailRequest(BaseModel):
    job_id: str
    target_email: str
    email_text: str

@app.post("/api/applications/send-email")
async def send_followup_email(request: SendEmailRequest, user_id: str = Depends(get_current_user_id)):
    if user_id == DEMO_USER_ID:
        return {"status": "ok", "message": "Email simulated successfully in Demo Mode."}

    profile = get_profile(user_id) or {}
    prefs = profile.get("preferences") or {}
    
    gmail_user = prefs.get("GMAIL_USER")
    gmail_password = prefs.get("GMAIL_APP_PASSWORD")
    
    if not gmail_user or not gmail_password:
        raise HTTPException(status_code=400, detail="Gmail credentials not configured in settings.")
        
    # Extract subject and body
    lines = request.email_text.strip().split("\n", 1)
    subject = lines[0].replace("Subject:", "").strip() if lines[0].startswith("Subject:") else "Job Application Follow-up"
    body = lines[1].strip() if len(lines) > 1 else request.email_text
    
    # Get resume url to attach if exists
    client = get_client()
    resp = client.table("user_job_pipelines").select("resume_url").eq("job_id", request.job_id).execute()
    resume_url = resp.data[0].get("resume_url") if resp.data and len(resp.data) > 0 else None
    
    from interface.email_dispatcher import send_cold_email
    success = send_cold_email(
        target_email=request.target_email,
        subject=subject,
        body_text=body,
        attachment_path=resume_url,
        gmail_user=gmail_user,
        gmail_password=gmail_password
    )
    if success:
        return {"status": "ok"}
    raise HTTPException(status_code=500, detail="Failed to send email.")


@app.get("/api/settings")
async def get_settings(user_id: str = Depends(get_current_user_id)):
    """Retrieve settings from DB for the current user."""
    if user_id == DEMO_USER_ID:
        return DEMO_SETTINGS
    try:
        profile = get_profile(user_id)
        if not profile:
            return {}
        
        prefs = profile.get("preferences") or {}
        
        # If DB is empty, read legacy settings.json
        if not prefs:
            try:
                with open("settings.json", "r") as f:
                    prefs = json.load(f)
            except:
                prefs = {}
                
        # Inject connection status so frontend can render it
        prefs["telegram_connected"] = bool(profile.get("telegram_chat_id"))
        
        # Inject masked API keys if they exist in encrypted_keys
        enc_keys = profile.get("encrypted_keys") or {}
        if isinstance(enc_keys, str):
            try:
                enc_keys = json.loads(enc_keys)
            except Exception:
                enc_keys = {}
                
        if "llm" not in prefs:
            prefs["llm"] = {}
            
        if enc_keys.get("GROQ_API_KEY"):
            prefs["llm"]["groq_api_key"] = "***"
        if enc_keys.get("GEMINI_API_KEY"):
            prefs["llm"]["gemini_api_key"] = "***"
        if enc_keys.get("HF_API_KEY"):
            prefs["llm"]["hf_api_key"] = "***"
            
        return prefs
    except Exception as e:
        logger.error(f"Error reading settings from DB: {e}")
        return {}


@app.post("/api/settings")
async def update_settings(request: Request, user_id: str = Depends(get_current_user_id)):
    """Update user preferences in DB for the current user."""
    if user_id == DEMO_USER_ID:
        return {"status": "ok", "updated_user": user_id}
    try:
        data = await request.json()
        
        has_byok_updates = False
        updates = {}
        profile_updates = {}
        
        # The frontend nests keys inside the "llm" object with lowercase names
        llm_data = data.get("llm", {})
        
        # Mapping frontend keys to database keys
        key_mapping = {
            "gemini_api_key": "GEMINI_API_KEY",
            "groq_api_key": "GROQ_API_KEY",
            "hf_api_key": "HF_API_KEY"
        }
        
        for frontend_k, backend_k in key_mapping.items():
            # Check nested "llm" object
            val = llm_data.pop(frontend_k, None)
            
            # Fallback: check top-level uppercase (just in case)
            if not val:
                val = data.pop(backend_k, None)
                
            if val and val != "***":
                from core.encryption import encrypt_key
                updates[backend_k] = encrypt_key(val)
                has_byok_updates = True
                if backend_k == "GEMINI_API_KEY": profile_updates["has_gemini_key"] = True
                if backend_k == "GROQ_API_KEY": profile_updates["has_groq_key"] = True
                if backend_k == "HF_API_KEY": profile_updates["has_hf_key"] = True

        if has_byok_updates:
            profile = get_profile(user_id)
            if profile:
                enc_keys = profile.get("encrypted_keys") or {}
                if isinstance(enc_keys, str):
                    try:
                        enc_keys = json.loads(enc_keys)
                    except Exception:
                        enc_keys = {}
                for k, v in updates.items():
                    enc_keys[k] = v
                profile_updates["encrypted_keys"] = enc_keys
                
        # Save remaining data back to preferences
        if "llm" in data:
            data["llm"] = llm_data
            
        profile_updates["preferences"] = data
        
        # Update user profile with all changes
        update_resp = get_client().table("user_profiles").update(profile_updates).eq("id", user_id).execute()
        
        # Also sync to settings.json for legacy scripts until fully migrated
        try:
            with open("settings.json", "w") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            logger.error(f"Warning: failed to sync legacy settings.json: {e}")
            
        return {"status": "ok", "updated_user": user_id}
    except Exception as e:
        logger.error(f"Error updating settings in DB: {e}")
        raise HTTPException(status_code=500, detail="Failed to save settings to database")


@app.get("/api/health")
async def health_check():
    """Basic liveness probe for Hugging Face Spaces."""
    return {"status": "ok", "version": "3.0", "service": "PhantmOS"}


# ── SPA Fallback ──────────────────────────────────────────────────────────────
# TanStack Start (Nitro) builds static assets to frontend/.output/public
FRONTEND_DIST = os.path.join(os.getcwd(), "frontend", ".output", "public")

@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    # Check if the requested path is a file in the dist directory
    file_path = os.path.join(FRONTEND_DIST, full_path)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return FileResponse(file_path)
    
    # Otherwise fallback to index.html for TanStack client-side router
    index_path = os.path.join(FRONTEND_DIST, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    
    raise HTTPException(status_code=404, detail="Frontend build not found.")

if __name__ == "__main__":
    logger.info("🚀 PhantmOS v3.0 SaaS Dashboard → http://localhost:8080")
    uvicorn.run(app, host="0.0.0.0", port=8080)
