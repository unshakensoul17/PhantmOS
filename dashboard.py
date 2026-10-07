import asyncio
import json
import os
import time
from concurrent.futures import ProcessPoolExecutor
from contextlib import asynccontextmanager

import pypdf
import requests
import uvicorn
from dotenv import load_dotenv
from fastapi import (
    BackgroundTasks,
    Depends,
    FastAPI,
    File,
    Header,
    HTTPException,
    Request,
    UploadFile,
)
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from core.database_manager import (
    _flatten_lead,
    get_all_stats,
    get_client,
    get_profile,
    update_job_lead,
    update_profile,
)
from core.logger import get_logger
from interface.telegram_delivery import app as telegram_app
from synthesis.company_research import generate_company_intelligence, generate_interview_playbook
from synthesis.llm_groq import call_groq

load_dotenv(override=True)
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    from core.config import TELEGRAM_API_BASE_URL, TELEGRAM_BOT_TOKEN

    space_host = os.getenv("SPACE_HOST")
    if space_host and TELEGRAM_BOT_TOKEN:
        webhook_url = f"https://{space_host}/telegram/webhook"
        logger.info(f"Auto-registering Telegram Webhook: {webhook_url}")
        try:
            resp = requests.post(
                f"{TELEGRAM_API_BASE_URL}/bot{TELEGRAM_BOT_TOKEN}/setWebhook",
                json={"url": webhook_url},
                timeout=30,
                proxies={"http": None, "https": None},
            )
            logger.info(f"Webhook registration response: {resp.text}")
        except Exception as e:
            logger.error(f"Failed to register webhook: {e}")
    from interface.telegram_delivery import application

    if application:
        await application.initialize()
        await application.start()

    yield
    # Shutdown logic
    if application:
        await application.stop()
        await application.shutdown()


app = FastAPI(title="PhantmOS v3.0 SaaS Dashboard", lifespan=lifespan)

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


_TOKEN_CACHE = {}  # token -> {"user_id": id, "expires": time.time() + 300}


DEMO_USER_ID = "00000000-0000-0000-0000-000000000000"


def generate_demo_leads(query: str = "") -> list:
    q = (query or "").strip()
    q_lower = q.lower()

    if "intern" in q_lower:
        return [
            {
                "id": "demo-intern-1",
                "job_id": "demo-intern-1",
                "title": "AI / Machine Learning Research Intern",
                "company": "OpenAI",
                "location": "Remote (Global)",
                "salary": "$50 - $70 / hr",
                "score": 98,
                "score_total": 98,
                "match_score": 0.98,
                "score_band": "HOT",
                "status": "Found",
                "url": "https://openai.com/careers",
                "source": "Himalayas",
                "justification": f"Strong candidate match for '{q or 'AI Intern'}': PyTorch, model fine-tuning, and LLM evaluation foundation.",
                "created_at": "2026-10-07T12:00:00Z",
            },
            {
                "id": "demo-intern-2",
                "job_id": "demo-intern-2",
                "title": "Machine Learning Engineering Intern",
                "company": "Hugging Face",
                "location": "Remote, Worldwide",
                "salary": "$45 - $60 / hr",
                "score": 94,
                "score_total": 94,
                "match_score": 0.94,
                "score_band": "HOT",
                "status": "Approved",
                "url": "https://huggingface.co/join-us",
                "source": "Remotive",
                "justification": f"High relevance for '{q or 'ML Intern'}': Transformers, dataset pipelines, and open-weights optimization.",
                "created_at": "2026-10-07T11:45:00Z",
            },
            {
                "id": "demo-intern-3",
                "job_id": "demo-intern-3",
                "title": "Generative AI & LLM Systems Intern",
                "company": "Cohere",
                "location": "Remote",
                "salary": "$40 - $55 / hr",
                "score": 91,
                "score_total": 91,
                "match_score": 0.91,
                "score_band": "HOT",
                "status": "Found",
                "url": "https://cohere.com/careers",
                "source": "HackerNews",
                "justification": f"Excellent overlap with '{q or 'AI Intern'}': RAG architectures, prompt pipelines, and embeddings.",
                "created_at": "2026-10-07T11:00:00Z",
            },
        ]
    return [
        {
            "id": "demo-1",
            "job_id": "demo-1",
            "title": "Applied AI Engineer (Autonomous Agents)",
            "company": "Anthropic",
            "location": "Remote (US/EU/Global)",
            "salary": "$180,000 - $240,000",
            "score": 96,
            "score_total": 96,
            "match_score": 0.96,
            "score_band": "HOT",
            "status": "Approved",
            "url": "https://anthropic.com/careers",
            "source": "Himalayas",
            "justification": "96% Match: Deep experience in Python backends, agentic orchestration, and LLM evaluation.",
            "created_at": "2026-10-07T14:30:00Z",
        },
        {
            "id": "demo-2",
            "job_id": "demo-2",
            "title": "Senior Machine Learning Engineer",
            "company": "Mistral AI",
            "location": "Paris, FR / Remote",
            "salary": "$160,000 - $210,000",
            "score": 91,
            "score_total": 91,
            "match_score": 0.91,
            "score_band": "HOT",
            "status": "Found",
            "url": "https://mistral.ai/jobs",
            "source": "Remotive",
            "justification": "91% Match: Strong PyTorch, model optimization, and low-latency inference serving.",
            "created_at": "2026-10-07T13:15:00Z",
        },
        {
            "id": "demo-3",
            "job_id": "demo-3",
            "title": "AI Platform & Backend Engineer",
            "company": "Perplexity",
            "location": "San Francisco, CA / Remote",
            "salary": "$175,000 - $230,000",
            "score": 88,
            "score_total": 88,
            "match_score": 0.88,
            "score_band": "WARM",
            "status": "Found",
            "url": "https://perplexity.ai/careers",
            "source": "HackerNews",
            "justification": "88% Match: Search indexing, vector databases, and high-throughput FastAPI microservices.",
            "created_at": "2026-10-07T12:00:00Z",
        },
    ]


DEMO_LEADS = generate_demo_leads()

DEMO_PROFILE = {
    "cv": {
        "name": "Alex Mercer",
        "email": "alex.mercer@example.com",
        "phone": "+1 (555) 234-5678",
        "location": "San Francisco, CA",
        "social_networks": [
            {"network": "LinkedIn", "username": "alex-mercer-ai"},
            {"network": "GitHub", "username": "alexmercer"},
        ],
        "sections": {
            "summary": [
                "Full-stack AI Engineer with 4+ years of experience designing autonomous agent architectures, distributed Python pipelines, and scalable LLM inference systems."
            ],
            "skills": [
                {"label": "Languages", "details": "Python, TypeScript, SQL, Rust, Go"},
                {"label": "Frameworks", "details": "PyTorch, FastAPI, React, Next.js, Node.js"},
                {"label": "AI & Data", "details": "RAG, Vector DBs, LangChain, Transformers, PostgreSQL"},
            ],
            "experience": [
                {
                    "company": "Cognitive Scale AI",
                    "position": "Senior AI Systems Engineer",
                    "start_date": "2023-01",
                    "end_date": "present",
                    "location": "San Francisco, CA",
                    "highlights": [
                        "Architected autonomous multi-agent task execution pipeline reducing workflow latency by 45%.",
                        "Engineered high-throughput RAG search using vector indices and local embeddings.",
                    ],
                }
            ],
        },
    }
}

DEMO_SETTINGS = {
    "llm": {
        "groq_api_key": "***",
        "gemini_api_key": "***",
        "primary_engine": "gemini|gemini-2.5-flash",
        "secondary_engine": "groq|openai/gpt-oss-120b",
    },
    "scoring": {
        "target_roles": ["AI Engineer", "Machine Learning Engineer", "Python Backend"],
        "blacklist_keywords": ["Senior Director"],
        "blacklist_companies": ["Revature"],
        "telegram_threshold": 80,
    },
    "scheduler": {"frequency_hours": 4, "pause_weekends": True},
    "notifications": {"daily_digest": True, "instant_telegram_alerts": False},
}


def get_current_user_id(authorization: str = Header(None)) -> str:
    """Strictly validate Supabase JWT, Telegram Mini App token, or Guest Demo token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized: Missing or invalid token format")

    token = authorization.split(" ")[1]
    if token == "guest-demo-token":
        return DEMO_USER_ID

    now = time.time()

    # Fast cache lookup
    if token in _TOKEN_CACHE and _TOKEN_CACHE[token]["expires"] > now:
        return _TOKEN_CACHE[token]["user_id"]

    # Check for signed Telegram Mini App session token
    if token.startswith("tg_sess_"):
        import hashlib
        import hmac

        from core.config import TELEGRAM_BOT_TOKEN

        try:
            raw = token.replace("tg_sess_", "")
            payload_str, sig = raw.rsplit("_", 1)
            secret = TELEGRAM_BOT_TOKEN.encode() if TELEGRAM_BOT_TOKEN else b"phantmos_secret"
            expected_sig = hmac.new(secret, payload_str.encode(), hashlib.sha256).hexdigest()
            if hmac.compare_digest(sig, expected_sig):
                user_id, exp_str = payload_str.split(":")
                if float(exp_str) > now:
                    _TOKEN_CACHE[token] = {"user_id": user_id, "expires": float(exp_str)}
                    return user_id
        except Exception as e:
            logger.error(f"Telegram session verification error: {e}")
        raise HTTPException(
            status_code=401, detail="Unauthorized: Invalid or expired Telegram session"
        )

    # Supabase token verification
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
app.mount("/telegram", telegram_app)


class TelegramAuthRequest(BaseModel):
    init_data: str = ""
    user_id: str = ""


@app.post("/api/auth/telegram")
async def telegram_auth(req: TelegramAuthRequest):
    """
    Seamless zero-click authentication for Telegram Mini App users.
    Validates Telegram identity and returns a cryptographically signed session token.
    """
    import hashlib
    import hmac
    from urllib.parse import parse_qsl

    from core.config import TELEGRAM_BOT_TOKEN
    from core.database_manager import get_client, get_profile_by_chat_id

    tg_user_id = None

    # 1. Validate init_data signature if provided
    if req.init_data and TELEGRAM_BOT_TOKEN:
        try:
            parsed = dict(parse_qsl(req.init_data))
            if "hash" in parsed:
                received_hash = parsed.pop("hash")
                data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed.items()))
                secret_key = hmac.new(
                    b"WebAppData", TELEGRAM_BOT_TOKEN.encode(), hashlib.sha256
                ).digest()
                computed_hash = hmac.new(
                    secret_key, data_check_string.encode(), hashlib.sha256
                ).hexdigest()
                if hmac.compare_digest(computed_hash, received_hash):
                    user_json = json.loads(parsed.get("user", "{}"))
                    tg_user_id = str(user_json.get("id"))
        except Exception as e:
            logger.warning(f"Telegram initData verification warning: {e}")

    if not tg_user_id and req.user_id:
        tg_user_id = str(req.user_id)

    if not tg_user_id:
        raise HTTPException(status_code=400, detail="Missing Telegram user identification")

    # 2. Look up PhantmOS user profile linked to this Telegram Chat ID
    profile = get_profile_by_chat_id(tg_user_id)
    if not profile:
        # Fallback check for configured allowed chat id
        allowed_chat = os.getenv("TELEGRAM_ALLOWED_CHAT_ID", "")
        if allowed_chat and str(allowed_chat) == str(tg_user_id):
            client = get_client()
            res = client.table("user_profiles").select("*").limit(1).execute()
            if res.data:
                profile = res.data[0]

    if not profile:
        raise HTTPException(
            status_code=404, detail="No PhantmOS account linked to this Telegram ID"
        )

    user_id = profile["id"]
    email = profile.get("email") or "telegram-user@phantmos.ai"

    # 3. Mint signed session token valid for 30 days
    now = int(time.time())
    expires = now + (86400 * 30)
    payload_str = f"{user_id}:{expires}"
    secret = TELEGRAM_BOT_TOKEN.encode() if TELEGRAM_BOT_TOKEN else b"phantmos_secret"
    sig = hmac.new(secret, payload_str.encode(), hashlib.sha256).hexdigest()
    access_token = f"tg_sess_{payload_str}_{sig}"

    _TOKEN_CACHE[access_token] = {"user_id": user_id, "expires": expires}

    return {
        "status": "ok",
        "access_token": access_token,
        "user_id": user_id,
        "email": email,
        "user_metadata": {
            "name": (profile.get("resume_data") or {}).get("cv", {}).get("name", "Telegram User"),
            "telegram_chat_id": tg_user_id,
        },
    }


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
    GROQ_API_KEY: str = ""
    HF_API_KEY: str = ""


class EnvUpdateRequest(BaseModel):
    JINA_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    HF_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    CALLMEBOT_API_KEY: str = ""
    CALLMEBOT_PHONE: str = ""
    TARGET_ROLES: str = ""
    TELEGRAM_BOT_TOKEN: str = ""
    GMAIL_USER: str = ""
    GMAIL_APP_PASSWORD: str = ""


# ── Routes ────────────────────────────────────────────────────────────────────


@app.get("/api/stats")
async def get_stats(user_id: str = Depends(get_current_user_id)):
    """Real-time pipeline stats — includes v2 band counts."""
    if user_id == DEMO_USER_ID:
        return JSONResponse({
            "hot": 2, "warm": 1, "cold": 0, "discovered": 3,
            "tailored": 1, "applied": 1, "dismissed": 0, "total": 3,
            "interviews": 1, "approved": 1, "offers": 0,
            "sources": {"Himalayas": 1, "Remotive": 1, "HackerNews": 1},
            "scores": [96, 91, 88],
            "weekly_applications": [0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 1, 1],
            "credits": 1000, "max_credits": 1000
        })
    try:
        stats = get_all_stats(user_id)
        import datetime

        now = datetime.datetime.now(datetime.UTC)
        twelve_weeks_ago = now - datetime.timedelta(weeks=12)

        client = get_client()
        app_resp = (
            client.table("user_job_pipelines")
            .select("created_at")
            .eq("user_id", user_id)
            .eq("status", "Applied")
            .gte("created_at", twelve_weeks_ago.isoformat())
            .execute()
        )

        weeks_data = [0] * 12
        for row in app_resp.data or []:
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

        return JSONResponse(
            {
                "hot": stats.get("hot", 0),
                "warm": stats.get("warm", 0),
                "cold": stats.get("cold", 0),
                "discovered": stats.get("found", 0),
                "tailored": stats.get("tailored", 0),
                "applied": stats.get("applied", 0),
                "dismissed": stats.get("dismissed", 0),
                "total": stats.get("total", 0),
                "interviews": stats.get("interviews", 0),
                "sources": stats.get("sources", {}),
                "scores": stats.get("scores", []),
                "approved": stats.get("approved", 0),
                "weekly_applications": weeks_data,
                "credits": get_profile(user_id).get("credits", 0) if get_profile(user_id) else 0,
                "max_credits": 1000,
            }
        )
    except Exception as e:
        logger.error(f"Stats error: {e}")
        return JSONResponse(
            {
                "hot": 0,
                "warm": 0,
                "cold": 0,
                "discovered": 0,
                "tailored": 0,
                "applied": 0,
                "dismissed": 0,
                "total": 0,
                "sources": {},
                "scores": [],
                "approved": 0,
            }
        )


@app.get("/api/leads")
async def get_leads(
    band: str = "",
    status: str = "",
    limit: int = 50,
    cursor: str = "",
    user_id: str = Depends(get_current_user_id),
):
    """Fetch job leads with cursor-based pagination."""
    if user_id == DEMO_USER_ID:
        res = list(DEMO_LEADS)
        if status:
            res = [l for l in res if l.get("status") == status]
        if band:
            res = [l for l in res if str(l.get("score_band", "")).upper() == band.upper()]
        return res

    client = get_client()
    try:
        q = (
            client.table("user_job_pipelines")
            .select("*, global_jobs(*)")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
        )
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
        for row in resp.data or []:
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
async def change_lead_status(
    job_id: str, request: StatusUpdateRequest, user_id: str = Depends(get_current_user_id)
):
    valid = [
        "Found",
        "Tailored",
        "Approved",
        "Applied",
        "Dismissed",
        "Interviewing",
        "Offer",
        "Rejected",
    ]
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


@app.post("/api/leads/{job_id}/resume")
async def generate_lead_resume(job_id: str, user_id: str = Depends(get_current_user_id)):
    """Generate tailored resume and PDF for a specific lead on-demand."""
    from core.database_manager import get_lead_by_id, get_profile, update_job_lead
    from synthesis.pdf_factory import generate_and_upload_pdf
    from synthesis.resume_tailor_impl import _tailor_hot, _tailor_warm

    lead = get_lead_by_id(job_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found.")

    profile = get_profile(user_id) or {}
    master_resume = profile.get("resume_data") or {}
    if not master_resume:
        raise HTTPException(
            status_code=400, detail="Please upload your master resume in Resume Studio first."
        )

    preferences = profile.get("preferences") or {}
    band = lead.get("score_band", "WARM")

    # Tailor resume via LLM waterfall
    await (_tailor_hot if band == "HOT" else _tailor_warm)(
        lead, master_resume, user_id=user_id, preferences=preferences
    )

    # Refresh lead to get tailored JSON from notes
    updated_lead = get_lead_by_id(job_id) or lead
    notes = {}
    try:
        notes = json.loads(updated_lead.get("notes") or "{}")
    except Exception:
        pass

    resume_data = notes.get("updated_resume_json") or master_resume
    url = await generate_and_upload_pdf(
        job_id=job_id,
        resume_data=resume_data,
        user_id=user_id,
        company_name=lead.get("company", ""),
    )

    if not url:
        raise HTTPException(
            status_code=500, detail="PDF generation failed. Please check master resume structure."
        )

    update_job_lead(job_id, {"resume_url": url, "status": "Tailored"}, user_id=user_id)
    return {
        "status": "ok",
        "resume_url": url,
        "job_id": job_id,
        "message": "Tailored resume generated and uploaded successfully.",
    }


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
        user_id,  # ← KEY FIX: scope harvest to the requesting user only
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
    """Save updated resume JSON for this user. Also invalidates the embedding cache."""
    if user_id == DEMO_USER_ID:
        global DEMO_PROFILE, DEMO_LEADS
        DEMO_PROFILE = request.resume_data
        target_role = request.resume_data.get("target_role") or ""
        if target_role:
            DEMO_LEADS = generate_demo_leads(target_role)
        return {"status": "ok", "message": "Profile saved and demo discovery leads updated."}
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
            "GROQ_API_KEY": "***",
            "HF_API_KEY": "",
            "credits": 1000,
        }
    profile = get_profile(user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")

    return {
        "GEMINI_API_KEY": "***" if profile.get("has_gemini_key") else "",
        "GROQ_API_KEY": "***" if profile.get("has_groq_key") else "",
        "HF_API_KEY": "***" if profile.get("has_hf_key") else "",
        "credits": profile.get("credits", 0),
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


_BOT_USERNAME_CACHE = None


@app.get("/api/telegram/link")
async def get_telegram_link(user_id: str = Depends(get_current_user_id)):
    """Generate the dynamic Telegram Bot deep link for the user."""
    from core.config import TELEGRAM_BOT_TOKEN

    if not TELEGRAM_BOT_TOKEN:
        return {"link": ""}

    global _BOT_USERNAME_CACHE
    if _BOT_USERNAME_CACHE:
        return {"link": f"https://t.me/{_BOT_USERNAME_CACHE}?start={user_id}"}

    try:
        import requests

        from core.config import TELEGRAM_API_BASE_URL

        # HF Spaces frequently time out on outbound requests to api.telegram.org
        resp = requests.get(
            f"{TELEGRAM_API_BASE_URL}/bot{TELEGRAM_BOT_TOKEN}/getMe",
            timeout=2,
            proxies={"http": None, "https": None},
        ).json()
        if resp.get("ok"):
            _BOT_USERNAME_CACHE = resp["result"]["username"]
            return {"link": f"https://t.me/{_BOT_USERNAME_CACHE}?start={user_id}"}
        else:
            logger.error(f"Telegram API error: {resp}")
            return {"link": f"https://t.me/phantmos_bot?start={user_id}"}
    except Exception as e:
        logger.error(f"Error fetching Telegram bot details: {e}")
        # Fallback to the known bot if the network drops the connection
        return {"link": f"https://t.me/phantmos_bot?start={user_id}"}


@app.get("/api/env")
async def fetch_env():
    """Return system env info (JINA_API_KEY etc.)."""
    return {
        "JINA_API_KEY": "***" if os.getenv("JINA_API_KEY") else "",
        "TELEGRAM_BOT_TOKEN": "***" if os.getenv("TELEGRAM_BOT_TOKEN") else "",
    }


# ── Admin Routes ──────────────────────────────────────────────────────────────


@app.post("/api/profile/upload")
async def upload_master_resume(
    resume: UploadFile = File(...), user_id: str = Depends(get_current_user_id)
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

        system_prompt = """You are an expert resume parser. Extract the user's details from the following resume text and output ONLY a valid JSON object matching the strict RenderCV schema below.
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
"""
        user_prompt = f"RESUME TEXT:\n{text[:8000]}"

        parsed_data = await call_groq(system_prompt, user_prompt)

        # Strip markdown if Gemini included it (e.g. ```json)
        if isinstance(parsed_data, str):
            if parsed_data.startswith("```json"):
                parsed_data = parsed_data[7:-3]
            parsed_data = json.loads(parsed_data)

        if "error" in parsed_data:
            os.remove(file_path)
            raise HTTPException(
                status_code=400, detail="The uploaded PDF does not appear to be a valid resume."
            )

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
        resp = (
            get_client()
            .table("user_profiles")
            .select("id, full_name, credits, encrypted_keys, telegram_chat_id")
            .execute()
        )
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
        resp = (
            get_client()
            .table("stage_logs")
            .select("*")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
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
async def phantm_writer_followup(
    request: PhantmWriterRequest, user_id: str = Depends(get_current_user_id)
):
    """Generate a highly professional follow-up email."""
    if user_id == DEMO_USER_ID:
        return {
            "status": "ok",
            "email": f"Subject: Following up on {request.role} Application\n\nDear {request.company} Hiring Team,\n\nI recently applied for the {request.role} role at {request.company} and wanted to briefly follow up. Given my background in Python, autonomous AI pipelines, and distributed backends, I am very excited about the opportunity to contribute to your team.\n\nPlease let me know if you would like any additional portfolio or code samples.\n\nWarm regards,\nAlex Mercer",
            "target_email": f"hiring@{request.company.lower().replace(' ', '')}.com",
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
    candidate_experience = (
        json.dumps(experience_list[:2]) if experience_list else "No experience data provided."
    )

    # Extract job context
    job_desc = ""
    if request.job_id:
        try:
            client = get_client()
            resp = (
                client.table("global_jobs").select("description").eq("id", request.job_id).execute()
            )
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
        import asyncio

        from intelligence.email_hunter import find_company_email

        loop = asyncio.get_event_loop()

        response_json, target_email = await asyncio.gather(
            call_groq(system_prompt, user_prompt, api_key=prefs.get("GROQ_API_KEY") or None),
            loop.run_in_executor(None, find_company_email, request.company),
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
async def send_followup_email(
    request: SendEmailRequest, user_id: str = Depends(get_current_user_id)
):
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
    subject = (
        lines[0].replace("Subject:", "").strip()
        if lines[0].startswith("Subject:")
        else "Job Application Follow-up"
    )
    body = lines[1].strip() if len(lines) > 1 else request.email_text

    # Get resume url to attach if exists
    client = get_client()
    resp = (
        client.table("user_job_pipelines")
        .select("resume_url")
        .eq("job_id", request.job_id)
        .execute()
    )
    resume_url = resp.data[0].get("resume_url") if resp.data and len(resp.data) > 0 else None

    from interface.email_dispatcher import send_cold_email

    success = send_cold_email(
        target_email=request.target_email,
        subject=subject,
        body_text=body,
        attachment_path=resume_url,
        gmail_user=gmail_user,
        gmail_password=gmail_password,
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
                with open("settings.json") as f:
                    prefs = json.load(f)
            except Exception:
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
            "hf_api_key": "HF_API_KEY",
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
                if backend_k == "GEMINI_API_KEY":
                    profile_updates["has_gemini_key"] = True
                if backend_k == "GROQ_API_KEY":
                    profile_updates["has_groq_key"] = True
                if backend_k == "HF_API_KEY":
                    profile_updates["has_hf_key"] = True

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
        get_client().table("user_profiles").update(profile_updates).eq("id", user_id).execute()

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
