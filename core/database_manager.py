import os
from typing import Any, Optional
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

_client: Optional[Client] = None

def get_client() -> Client:
    global _client
    if _client is None:
        url = os.getenv("SUPABASE_URL", "").strip()
        key = os.getenv("SUPABASE_KEY", "").strip()
        if not url or not key:
            raise EnvironmentError("SUPABASE_URL and SUPABASE_KEY must be set in your .env file.")
        _client = create_client(url, key)
    return _client

def get_profile() -> Optional[dict]:
    """Retrieve the master profile for unshakensoul17"""
    client = get_client()
    try:
        resp = client.table("user_profiles").select("*").limit(1).execute()
        return resp.data[0] if resp.data else None
    except Exception as e:
        print(f"Error fetching profile: {e}")
        return None

def update_profile(updates: dict) -> Optional[dict]:
    """Update the master profile."""
    client = get_client()
    try:
        profile = get_profile()
        if not profile:
            return None
        resp = client.table("user_profiles").update(updates).eq("id", profile["id"]).execute()
        return resp.data[0] if resp.data else None
    except Exception as e:
        print(f"Error updating profile: {e}")
        return None

def upsert_job_lead(lead: dict) -> Optional[dict]:
    client = get_client()
    try:
        resp = client.table("job_leads").upsert(lead, on_conflict="job_id").execute()
        return resp.data[0] if resp.data else None
    except Exception as e:
        print(f"Error upserting lead {lead.get('job_id')}: {e}")
        return None

def update_job_lead(job_id: str, updates: dict[str, Any]) -> Optional[dict]:
    client = get_client()
    try:
        resp = client.table("job_leads").update(updates).eq("job_id", job_id).execute()
        return resp.data[0] if resp.data else None
    except Exception as e:
        print(f"Error updating lead {job_id}: {e}")
        return None

def get_leads_by_status(status: str, limit: int = 20) -> list[dict]:
    client = get_client()
    try:
        resp = client.table("job_leads").select("*").eq("status", status).limit(limit).execute()
        return resp.data or []
    except Exception as e:
        print(f"Error fetching leads by status {status}: {e}")
        return []

def get_lead_by_id(job_id: str) -> Optional[dict]:
    client = get_client()
    try:
        resp = client.table("job_leads").select("*").eq("job_id", job_id).limit(1).execute()
        return resp.data[0] if resp.data else None
    except Exception as e:
        print(f"Error fetching lead {job_id}: {e}")
        return None
