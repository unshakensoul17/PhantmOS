"""
core/database_manager.py — Ghost Protocol v2.0
Single Supabase client + all DB operations used across the pipeline.
"""
import json
from typing import Any, Optional
from supabase import create_client, Client

from core.config import SUPABASE_URL, SUPABASE_KEY
from core.logger import get_logger

logger = get_logger(__name__)

_client: Optional[Client] = None


# ─────────────────────────────────────────────────────────
#  CLIENT
# ─────────────────────────────────────────────────────────

def get_client() -> Client:
    global _client
    if _client is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise EnvironmentError(
                "SUPABASE_URL and SUPABASE_KEY must be set in your .env file."
            )
        # Use SERVICE_ROLE_KEY if provided to bypass RLS, otherwise fallback to anon SUPABASE_KEY
        from core.config import SERVICE_ROLE_KEY
        active_key = SERVICE_ROLE_KEY if SERVICE_ROLE_KEY else SUPABASE_KEY
        _client = create_client(SUPABASE_URL, active_key)
    return _client


# ─────────────────────────────────────────────────────────
#  USER PROFILE
# ─────────────────────────────────────────────────────────

def get_profile(user_id: Optional[str] = None) -> Optional[dict]:
    """Retrieve user profile by user_id, including external resume_data."""
    try:
        # OPTIMIZATION 2: Join with partitioned user_resumes table
        q = get_client().table("user_profiles").select("*, user_resumes(resume_data)")
        if user_id:
            q = q.eq("id", user_id)
        resp = q.limit(1).execute()
        if not resp.data:
            return None
            
        profile = resp.data[0]
        # Flatten resume data from partitioned table
        resumes = profile.pop("user_resumes", None)
        if resumes:
            resume_obj = resumes[0] if isinstance(resumes, list) else resumes
            profile["resume_data"] = resume_obj.get("resume_data", {})
        elif "resume_data" not in profile or profile["resume_data"] is None:
            profile["resume_data"] = {}
            
        # --- Lazy Monthly Credit Refill Logic ---
        import datetime
        current_month = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m")
        prefs = profile.get("preferences") or {}
        last_refill = prefs.get("last_refill_month", "")
        
        if last_refill != current_month:
            # Add 30 credits, max 1000
            new_credits = min(1000, (profile.get("credits") or 0) + 30)
            prefs["last_refill_month"] = current_month
            
            # Save updates back to Supabase silently in background
            try:
                get_client().table("user_profiles").update({
                    "credits": new_credits,
                    "preferences": prefs
                }).eq("id", profile["id"]).execute()
            except Exception as inner_e:
                logger.error(f"Failed to save monthly credit refill: {inner_e}")
                
            profile["credits"] = new_credits
            profile["preferences"] = prefs
            
        return profile
    except Exception as e:
        logger.error(f"Error fetching profile: {e}")
        return None


def update_profile(updates: dict, user_id: Optional[str] = None) -> Optional[dict]:
    """Update user profile by user_id, supporting partitioned resume table."""
    try:
        profile = get_profile(user_id)
        if not profile:
            return None
            
        client = get_client()
        resume_data = updates.pop("resume_data", None)
        
        # 1. Update core profile if there are core updates
        if updates:
            client.table("user_profiles").update(updates).eq("id", profile["id"]).execute()
            
        # 2. Upsert resume data into partitioned table if provided
        if resume_data is not None:
            client.table("user_resumes").upsert({
                "user_id": profile["id"],
                "resume_data": resume_data
            }).execute()
            
        return get_profile(profile["id"])
    except Exception as e:
        logger.error(f"Error updating profile: {e}")
        return None


# ─────────────────────────────────────────────────────────
#  JOB LEADS
# ─────────────────────────────────────────────────────────

def upsert_job_lead(lead: dict) -> Optional[dict]:
    # Keeping this for backward compatibility for single-job operations
    try:
        res = bulk_upsert_job_leads([lead])
        return res[0] if res else None
    except Exception as e:
        logger.error(f"Error in single upsert: {e}")
        return None

def bulk_upsert_job_leads(leads: list[dict]) -> list[dict]:
    """Upsert multiple jobs in exactly 2 network roundtrips."""
    if not leads:
        return []
        
    try:
        global_jobs_payload = []
        pipelines_payload = []
        
        for lead in leads:
            # 1. Prepare global_jobs payload
            g_data = {
                "job_id": lead.get("job_id"),
                "company": lead.get("company"),
                "title": lead.get("title"),
                "description": lead.get("description") or lead.get("raw_description"),
                "location": lead.get("location"),
                "url": lead.get("url") or lead.get("job_url"),
                "source": lead.get("source"),
                "dedup_hash": lead.get("dedup_hash")
            }
            g_data = {k: v for k, v in g_data.items() if v is not None}
            global_jobs_payload.append(g_data)
            
            # 2. Prepare user_job_pipelines payload
            user_id = lead.get("user_id")
            if user_id:
                p_data = {
                    "user_id": user_id,
                    "job_id": lead.get("job_id"),
                    "status": lead.get("status", "Found"),
                    "match_score": lead.get("match_score", 0),
                    "score_band": lead.get("score_band"),
                    "notes": lead.get("notes"),
                    "resume_url": lead.get("resume_url"),
                    "resume_tailored": lead.get("resume_tailored")
                }
                p_data = {k: v for k, v in p_data.items() if v is not None}
                pipelines_payload.append(p_data)
                
        client = get_client()
        # Bulk Upsert 1: global_jobs
        if global_jobs_payload:
            client.table("global_jobs").upsert(global_jobs_payload, on_conflict="job_id").execute()
            
        # Bulk Upsert 2: user_job_pipelines
        if pipelines_payload:
            resp = client.table("user_job_pipelines").upsert(pipelines_payload, on_conflict="user_id, job_id").execute()
            return resp.data or []
            
        return global_jobs_payload
    except Exception as e:
        logger.error(f"Error in bulk upsert: {e}")
        return []


def update_job_lead(job_id: str, updates: dict[str, Any], user_id: Optional[str] = None) -> Optional[dict]:
    try:
        q = get_client().table("user_job_pipelines").update(updates).eq("job_id", job_id)
        if user_id:
            q = q.eq("user_id", user_id)
        resp = q.execute()
        return resp.data[0] if resp.data else None
    except Exception as e:
        logger.error(f"Error updating lead {job_id}: {e}")
        return None


def _flatten_lead(row: dict) -> dict:
    """Helper to flatten user_job_pipelines row joined with global_jobs."""
    global_job = row.pop("global_jobs", {}) or {}
    flat = {**global_job, **row}
    # Map legacy keys for backward compatibility
    flat["raw_description"] = flat.get("description")
    flat["job_url"] = flat.get("url")
    flat["source_platform"] = flat.get("source")
    
    notes_raw = flat.get("notes")
    if notes_raw and isinstance(notes_raw, str):
        try:
            import json
            notes_dict = json.loads(notes_raw)
            flat["justification"] = notes_dict.get("rationale")
        except Exception:
            pass
            
    return flat


def get_leads_by_status(status: str, limit: int = 50, user_id: Optional[str] = None) -> list[dict]:
    try:
        q = get_client().table("user_job_pipelines").select("*, global_jobs(*)").eq("status", status)
        if user_id:
            q = q.eq("user_id", user_id)
        resp = q.limit(limit).execute()
        return [_flatten_lead(row) for row in (resp.data or [])]
    except Exception as e:
        logger.error(f"Error fetching leads by status {status}: {e}")
        return []


def get_leads_by_band(band: str, limit: int = 50, user_id: Optional[str] = None) -> list[dict]:
    """Fetch job leads by score_band (HOT / WARM / COLD)."""
    try:
        q = (
            get_client()
            .table("user_job_pipelines")
            .select("*, global_jobs(*)")
            .eq("score_band", band)
            .eq("status", "Found")
        )
        if user_id:
            q = q.eq("user_id", user_id)
        resp = q.order("match_score", desc=True).limit(limit).execute()
        return [_flatten_lead(row) for row in (resp.data or [])]
    except Exception as e:
        logger.error(f"Error fetching leads by band {band}: {e}")
        return []


def get_lead_by_id(job_id: str, user_id: Optional[str] = None) -> Optional[dict]:
    try:
        q = get_client().table("user_job_pipelines").select("*, global_jobs(*)").eq("job_id", job_id)
        if user_id:
            q = q.eq("user_id", user_id)
        resp = q.limit(1).execute()
        
        if not resp.data:
            return None
            
        return _flatten_lead(resp.data[0])
    except Exception as e:
        logger.error(f"Error fetching lead {job_id}: {e}")
        return None


def get_existing_dedup_hashes(hashes: list[str], user_id: Optional[str] = None) -> set[str]:
    """Batch-check which dedup hashes already exist in the DB."""
    if not hashes:
        return set()
    try:
        client = get_client()
        existing = set()
        
        # We chunk the hashes in batches of 200 to avoid URL too long / payload issues
        batch_size = 200
        for i in range(0, len(hashes), batch_size):
            chunk = hashes[i:i + batch_size]
            if user_id:
                # OPTIMIZATION #4: Use high-performance RPC with array unnesting instead of large IN clause
                try:
                    resp = client.rpc("check_existing_hashes", {"user_id_param": user_id, "hashes": chunk}).execute()
                    for row in (resp.data or []):
                        existing.add(row["dedup_hash"])
                except Exception as e:
                    # Fallback if migration hasn't run
                    logger.warning(f"Dedup RPC failed, falling back: {e}")
                    q = client.table("global_jobs").select("dedup_hash").in_("dedup_hash", chunk)
                    resp = q.execute()
                    for row in (resp.data or []):
                        existing.add(row["dedup_hash"])
            else:
                # Global check
                q = client.table("global_jobs").select("dedup_hash").in_("dedup_hash", chunk)
                resp = q.execute()
                for row in (resp.data or []):
                    existing.add(row["dedup_hash"])
                    
        return existing
    except Exception as e:
        logger.error(f"Error checking dedup hashes: {e}")
        return set()


def get_all_stats(user_id: Optional[str] = None) -> dict:
    """Aggregate pipeline statistics using high-performance SQL RPC and Views."""
    if not user_id:
        return {}
        
    try:
        client = get_client()
        # 1. Fetch core numeric stats instantly via RPC
        stats_resp = client.rpc("get_dashboard_stats", {"user_id_param": user_id}).execute()
        base_stats = stats_resp.data if stats_resp.data else {
            "total": 0, "found": 0, "tailored": 0, "approved": 0,
            "applied": 0, "dismissed": 0, "hot": 0, "warm": 0, "cold": 0, "interviews": 0
        }
        
        # Ensure interviews key exists if RPC doesn't return it yet
        if "interviews" not in base_stats:
            base_stats["interviews"] = 0
            
        # Initialize additional fields
        base_stats["sources"] = {}
        base_stats["scores"] = [0] * 20
        
        # 2. Fetch lightweight source/score analytics from View instead of full tables
        # This returns just (score, source) which is orders of magnitude smaller
        analytics_resp = client.table("user_job_analytics").select("score, source").eq("user_id", user_id).execute()
        
        for row in (analytics_resp.data or []):
            src = row.get("source") or "unknown"
            base_stats["sources"][src] = base_stats["sources"].get(src, 0) + 1
            
            score = row.get("score")
            if score is not None:
                # Use friend's updated score_val logic if it's 0-1
                score_val = score * 100 if score <= 1.0 else score
                bucket = min(19, int(score_val / 5))
                base_stats["scores"][bucket] += 1
                
        return base_stats
    except Exception as e:
        logger.error(f"Error aggregating stats (fallback to old method might be needed if migrations aren't run): {e}")
        # To avoid breaking the dashboard if they haven't run the SQL yet:
        return _fallback_get_all_stats(user_id)

def _fallback_get_all_stats(user_id: str) -> dict:
    try:
        client = get_client()
        q = client.table("user_job_pipelines").select("status, score_band, match_score, global_jobs(source)")
        if user_id:
            q = q.eq("user_id", user_id)
        resp = q.execute()
        leads = resp.data or []

        stats: dict[str, any] = {
            "total": len(leads),
            "found": 0,
            "tailored": 0,
            "approved": 0,
            "applied": 0,
            "dismissed": 0,
            "hot": 0,
            "warm": 0,
            "cold": 0,
            "interviews": 0,
            "sources": {},
            "scores": [0] * 20, # 20 buckets for score histogram
        }
        for lead in leads:
            s = (lead.get("status") or "").lower()
            b = (lead.get("score_band") or "").lower()
            if s == "found": stats["found"] += 1
            elif s == "tailored": stats["tailored"] += 1
            elif s == "approved": stats["approved"] += 1
            elif s == "applied": stats["applied"] += 1
            elif s == "dismissed": stats["dismissed"] += 1
            elif s in ["interviewing", "offer"]: stats["interviews"] += 1
            
            if b == "hot" or b == "a": stats["hot"] += 1
            elif b == "warm" or b == "b": stats["warm"] += 1
            elif b == "cold" or b == "c": stats["cold"] += 1
            
            # Source
            src = lead.get("global_jobs", {}).get("source", "unknown") if lead.get("global_jobs") else "unknown"
            stats["sources"][src] = stats["sources"].get(src, 0) + 1
            
            # Score distribution
            match_score = lead.get("match_score")
            if match_score is not None:
                score_val = match_score * 100 if match_score <= 1.0 else match_score
                bucket = min(19, int(score_val / 5)) # 0-4, 5-9, ..., 95-100
                stats["scores"][bucket] += 1
        return stats
    except Exception as e:
        logger.error(f"Fallback stats failed: {e}")
        return {}


def deduct_credit(user_id: str) -> bool:
    """Deduct 1 credit from the user's account safely using an atomic Postgres RPC."""
    try:
        resp = get_client().rpc("decrement_user_credits", {"user_id_param": user_id}).execute()
        # RPC should return boolean success
        return bool(resp.data)
    except Exception as e:
        # Fallback to the old method if RPC isn't deployed yet
        logger.warning(f"RPC decrement failed, falling back to Python-level decrement: {e}")
        try:
            profile = get_profile(user_id)
            if not profile: return False
            current = profile.get("credits", 0) or 0
            if current <= 0: return False
            get_client().table("user_profiles").update({"credits": current - 1}).eq("id", user_id).execute()
            return True
        except Exception as inner_e:
            logger.error(f"Error deducting credit for user {user_id}: {inner_e}")
            return False


# ─────────────────────────────────────────────────────────
#  COMPANY CONTEXT CACHE
# ─────────────────────────────────────────────────────────

def get_company_context(company_name: str) -> Optional[dict]:
    """
    Returns {"context": str, "age_days": int} or None if not cached.
    """
    try:
        resp = (
            get_client()
            .table("company_context")
            .select("context, age_days")
            .eq("company_name", company_name)
            .limit(1)
            .execute()
        )
        return resp.data[0] if resp.data else None
    except Exception as e:
        logger.error(f"Error fetching company context for {company_name}: {e}")
        return None


def store_company_context(company_name: str, context: str) -> None:
    try:
        get_client().table("company_context").upsert(
            {"company_name": company_name, "context": context},
            on_conflict="company_name",
        ).execute()
    except Exception as e:
        logger.error(f"Error storing company context for {company_name}: {e}")


# ─────────────────────────────────────────────────────────
#  DELIVERY QUEUE
# ─────────────────────────────────────────────────────────

def queue_delivery(job_id: str, user_id: str) -> None:
    try:
        get_client().table("delivery_queue").insert(
            {"job_id": job_id, "user_id": user_id, "status": "pending", "attempts": 0}
        ).execute()
    except Exception as e:
        logger.error(f"Error queuing delivery for job {job_id}: {e}")


def get_pending_deliveries(max_attempts: int = 3, user_id: str = None) -> list[dict]:
    try:
        query = (
            get_client()
            .table("delivery_queue")
            .select("*, user_job_pipelines(*, global_jobs(*))")
            .eq("status", "pending")
            .lt("attempts", max_attempts)
        )
        if user_id:
            query = query.eq("user_id", user_id)
            
        resp = query.order("created_at").execute()
        
        # Flatten the response to maintain backward compatibility (lead format)
        deliveries = []
        for d in (resp.data or []):
            pipelines = d.pop("user_job_pipelines", [])
            # In Supabase, if it's a one-to-many relationship it returns a list, if one-to-one it returns a dict.
            # Assuming list because we didn't specify foreign key constraint in a way that guarantees 1-to-1 from delivery_queue
            pipeline = pipelines[0] if isinstance(pipelines, list) and pipelines else pipelines
            
            if pipeline:
                d["job_leads"] = _flatten_lead(pipeline)
            deliveries.append(d)
            
        return deliveries
    except Exception as e:
        logger.error(f"Error fetching pending deliveries: {e}")
        return []


def update_delivery_status(
    delivery_id: str, status: str, increment_attempts: bool = False
) -> None:
    try:
        updates: dict = {"status": status}
        if increment_attempts:
            # Supabase Python client doesn't support atomic increment natively;
            # fetch current attempts first
            row = (
                get_client()
                .table("delivery_queue")
                .select("attempts")
                .eq("id", delivery_id)
                .limit(1)
                .execute()
            )
            current = row.data[0]["attempts"] if row.data else 0
            updates["attempts"] = current + 1
            updates["last_attempt"] = "now()"
        get_client().table("delivery_queue").update(updates).eq(
            "id", delivery_id
        ).execute()
    except Exception as e:
        logger.error(f"Error updating delivery {delivery_id}: {e}")


# ─────────────────────────────────────────────────────────
#  USER FEEDBACK (learning loop)
# ─────────────────────────────────────────────────────────

def store_feedback(job_id: str, action: str, skip_reason: str = "") -> None:
    try:
        get_client().table("user_feedback").insert(
            {
                "job_id": job_id,
                "action": action,
                "skip_reason": skip_reason or None,
            }
        ).execute()
    except Exception as e:
        logger.error(f"Error storing feedback for job {job_id}: {e}")


# ─────────────────────────────────────────────────────────
#  EMBEDDING CACHE
# ─────────────────────────────────────────────────────────

def get_cached_embedding(key: str) -> Optional[list[float]]:
    try:
        resp = (
            get_client()
            .table("embedding_cache")
            .select("embedding")
            .eq("key", key)
            .limit(1)
            .execute()
        )
        if resp.data:
            raw = resp.data[0]["embedding"]
            # Supabase returns pgvector as a string like "[0.1, 0.2, ...]"
            if isinstance(raw, str):
                return json.loads(raw)
            return raw
        return None
    except Exception as e:
        logger.error(f"Error fetching cached embedding for {key}: {e}")
        return None


def store_embedding(key: str, embedding: list[float]) -> None:
    try:
        get_client().table("embedding_cache").upsert(
            {"key": key, "embedding": embedding}, on_conflict="key"
        ).execute()
    except Exception as e:
        logger.error(f"Error storing embedding for {key}: {e}")


# ─────────────────────────────────────────────────────────
#  STAGE LOGS
# ─────────────────────────────────────────────────────────

def log_stage_success(job_id: str, stage: str, message: str = "") -> None:
    _log_stage(job_id, stage, "success", message)


def log_stage_failure(job_id: str, stage: str, message: str = "") -> None:
    _log_stage(job_id, stage, "failure", message)


def _log_stage(job_id: str, stage: str, status: str, message: str) -> None:
    try:
        get_client().table("stage_logs").insert(
            {
                "job_id": job_id or None,
                "stage": stage,
                "status": status,
                "message": message[:2000],  # cap length
            }
        ).execute()
    except Exception as e:
        logger.error(f"Error writing stage log ({stage}): {e}")
