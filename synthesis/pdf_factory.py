"""
synthesis/pdf_factory.py — PhantmOS v2.0 (RenderCV/Typst Backend)

Async PDF generation pipeline:
  1. Adapt AI JSON to strict RenderCV schema.
  2. Inject user-preferred theme from DB (default: classic).
  3. Compile PDF natively using RenderCV (Typst).
  4. Upload to Supabase Storage (1GB free).
  5. Return permanent public URL.
"""
import asyncio
import io
import os
import time
import json
import subprocess
import tempfile
from pathlib import Path

from core.config import SUPABASE_URL, SUPABASE_KEY
from core.database_manager import get_client
from core.logger import get_logger
from synthesis.pdf_validator import validate_pdf

logger = get_logger(__name__)
STORAGE_BUCKET = "resumes"


# ── RenderCV PDF generation (synchronous — must run in executor) ────────────

def _sanitize_cv_data(cv: dict) -> dict:
    # 0. Migrate legacy/flat schema (e.g., from old LLM outputs or DB records) to strict RenderCV sections schema
    if "sections" not in cv:
        cv["sections"] = {}
        
    for key in ["summary", "experience", "education", "projects", "skills"]:
        if key in cv:
            if key == "summary" and isinstance(cv[key], str):
                cv["sections"][key] = [cv[key]]
            elif key == "skills" and isinstance(cv[key], list) and (len(cv[key]) > 0 and isinstance(cv[key][0], str)):
                # Convert list of strings to RenderCV's strict skills format
                cv["sections"]["skills"] = [{"label": "Core Skills", "details": ", ".join(cv[key])}]
            else:
                cv["sections"][key] = cv[key]
            del cv[key]
            
    # Fix legacy field names inside arrays
    for sec in ["experience", "projects", "education"]:
        if sec in cv["sections"] and isinstance(cv["sections"][sec], list):
            for item in cv["sections"][sec]:
                if isinstance(item, dict):
                    if "title" in item and "position" not in item:
                        item["position"] = item.pop("title")
                    if "dates" in item and "date" not in item:
                        item["date"] = item.pop("dates")
                    if "bulletPoints" in item and "highlights" not in item:
                        item["highlights"] = item.pop("bulletPoints")
                        
    # 0.5. Remove unknown root fields that might have leaked into `cv`
    for unknown_key in ["target_role", "job_id", "status", "score"]:
        if unknown_key in cv:
            del cv[unknown_key]
                        
    # 1. Clean up social networks casing (RenderCV is strict)
    allowed_networks = {"LinkedIn", "GitHub", "GitLab", "Twitter", "Mastodon", "Website", "YouTube"}
    if "social_networks" in cv:
        valid_socials = []
        for s in cv["social_networks"]:
            net = s.get("network", "")
            for allowed in allowed_networks:
                if allowed.lower() == net.lower():
                    s["network"] = allowed
                    valid_socials.append(s)
                    break
        cv["social_networks"] = valid_socials
        
    # 2. Strip out empty date fields and clean up rogue newlines in short strings
    import re
    if "sections" in cv:
        for sec_name, entries in cv["sections"].items():
            if isinstance(entries, list):
                for entry in entries:
                    if isinstance(entry, dict):
                        # Clean dates (remove if empty, or invalid like "Not specified")
                        for date_field in ["start_date", "end_date", "date"]:
                            if date_field in entry:
                                val = str(entry[date_field]).strip().lower()
                                # If it's empty, or has no digits and isn't "present", it's invalid for RenderCV
                                if not val or (not any(c.isdigit() for c in val) and val != "present"):
                                    del entry[date_field]
                                elif re.match(r"^\d{4}-\d{2}$", val):
                                    # If it looks like YYYY-MM but MM is > 12 (e.g. 2024-27), RenderCV fails.
                                    # We replace "-" with " - " to force it to be treated as a string range.
                                    parts = val.split("-")
                                    if len(parts) == 2 and int(parts[1]) > 12:
                                        entry[date_field] = f"{parts[0]} - {parts[1]}"
                        # Clean short string fields to prevent Typst overlap
                        for short_field in ["institution", "area", "degree", "company", "position", "location", "name"]:
                            if short_field in entry and isinstance(entry[short_field], str):
                                entry[short_field] = " ".join(entry[short_field].split())
                                
                        # Fix long degrees overlapping in classic theme
                        if "degree" in entry and isinstance(entry["degree"], str) and len(entry["degree"]) > 8:
                            degree_val = entry["degree"]
                            area_val = entry.get("area", "")
                            # Merge long degree into area (e.g. "Expected 2027" -> "Expected 2027, BCA")
                            if area_val:
                                entry["area"] = f"{degree_val}, {area_val}"
                            else:
                                entry["area"] = degree_val
                            del entry["degree"]
                            
                        # Merge "technologies" into "highlights"
                        if "technologies" in entry and isinstance(entry["technologies"], list):
                            if "highlights" not in entry or not isinstance(entry["highlights"], list):
                                entry["highlights"] = []
                            techs = ", ".join(str(t) for t in entry["technologies"])
                            entry["highlights"].append(f"Technologies: {techs}")
                            
                        # Delete any custom fields that are lists/dicts to prevent RenderCV TypeError during string substitution
                        allowed_complex_fields = {"highlights"}
                        keys_to_delete = []
                        for k, v in entry.items():
                            if k not in allowed_complex_fields and (isinstance(v, list) or isinstance(v, dict)):
                                keys_to_delete.append(k)
                        for k in keys_to_delete:
                            del entry[k]

        # 3. Strip out entirely empty sections (like Experience: [])
        empty_sections = [sec for sec, entries in cv["sections"].items() if isinstance(entries, list) and not entries]
        for sec in empty_sections:
            del cv["sections"][sec]
            
    # 4. Fix phone number validation (RenderCV requires +countrycode)
    if "phone" in cv:
        phone_str = str(cv["phone"]).strip()
        if not phone_str.startswith("+"):
            digits = "".join(filter(str.isdigit, phone_str))
            if len(digits) == 10:
                cv["phone"] = f"+91{digits}"
            else:
                del cv["phone"]
                
    return cv

def _adapt_and_render_sync(resume_data: dict, theme: str) -> bytes:
    """Write data to a temp JSON file, run RenderCV, and return PDF bytes."""
    # Ensure RenderCV schema format
    raw_cv = resume_data.get("cv", resume_data)
    
    # RenderCV expects the root to be {"cv": {...}, "design": {...}}
    cv = _sanitize_cv_data(raw_cv)
    rendercv_data = {
        "cv": cv,
        "design": {
            "theme": theme
        }
    }
    
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir) / "resume.json"
        with open(tmp_path, "w") as f:
            json.dump(rendercv_data, f)
            
        # Run RenderCV via subprocess (safe and decoupled)
        # rendercv render output defaults to ./rendercv_output
        env = os.environ.copy()
        env["PYTHONUTF8"] = "1"
        env["PYTHONIOENCODING"] = "utf-8"
        
        res = subprocess.run(
            ["rendercv", "render", str(tmp_path)],
            cwd=tmpdir,
            capture_output=True,
            text=True,
            env=env,
            encoding="utf-8"
        )
        
        if res.returncode != 0:
            error_details = f"STDOUT:\n{res.stdout}\nSTDERR:\n{res.stderr}"
            logger.error(f"RenderCV failed: {error_details}\nJSON Dump: {json.dumps(rendercv_data, indent=2)}")
            raise RuntimeError(f"RenderCV execution failed: {error_details}")
            
        # Find the generated PDF
        output_dir = Path(tmpdir) / "rendercv_output"
        pdfs = list(output_dir.glob("*.pdf"))
        if not pdfs:
            raise FileNotFoundError("RenderCV finished but no PDF was generated.")
            
        with open(pdfs[0], "rb") as f:
            return f.read()

# ── Supabase Storage upload ────────────────────────────────────────────────────

def _upload_to_supabase(pdf_bytes: bytes, filename: str) -> str:
    """Upload PDF bytes to Supabase Storage and return public URL."""
    client = get_client()

    try:
        client.storage.create_bucket(STORAGE_BUCKET, options={"public": True})
    except Exception:
        pass

    client.storage.from_(STORAGE_BUCKET).upload(
        path=filename,
        file=pdf_bytes,
        file_options={
            "content-type": "application/pdf",
            "upsert": "true",
        },
    )

    public_url = (
        f"{SUPABASE_URL.rstrip('/')}"
        f"/storage/v1/object/public/{STORAGE_BUCKET}/{filename}"
    )
    logger.info(f"PDF uploaded: {public_url}")
    return public_url


# ── Public async interface ────────────────────────────────────────────────────

def _has_missing_dates(cv: dict) -> bool:
    """Check if critical sections (experience, projects) are missing dates."""
    sections = cv.get("sections", {})
    for sec_name in ["experience", "projects"]:
        entries = sections.get(sec_name, [])
        if isinstance(entries, list):
            for entry in entries:
                if isinstance(entry, dict):
                    has_valid_date = False
                    for k in ["start_date", "end_date", "date"]:
                        if k in entry:
                            val = str(entry[k]).strip().lower()
                            if val and (any(c.isdigit() for c in val) or val == "present"):
                                has_valid_date = True
                                break
                    if not has_valid_date:
                        return True
    return False

async def generate_and_upload_pdf(
    job_id: str,
    resume_data: dict,
    user_id: str = None,
    company_name: str = "",
    company_context: str = "",
) -> str | None:
    """
    Full PDF pipeline: Adapt JSON → RenderCV Compile → Upload → URL.
    """
    candidate_name = resume_data.get("cv", {}).get("name", "")
    theme = "sb2nov"

    
    # Fetch user theme preference if user_id is provided
    if user_id:
        try:
            client = get_client()
            res = client.table("user_profiles").select("preferences").eq("id", user_id).execute()
            if res.data and res.data[0].get("preferences"):
                theme = res.data[0]["preferences"].get("resume_template", "sb2nov")
        except Exception as e:
            logger.warning(f"Could not fetch user preferences: {e}")
            
    # Fallback to sb2nov if a date-dependent template is chosen but dates are missing
    if theme in ["classic", "engineeringresumes"]:
        raw_cv = resume_data.get("cv", resume_data)
        if _has_missing_dates(raw_cv):
            logger.warning(f"PDF Factory: '{theme}' requires dates, but some are missing. Falling back to 'sb2nov'.")
            theme = "sb2nov"

    logger.info(f"PDF Factory: generating for job={job_id} theme={theme} candidate='{candidate_name}'")

    loop = asyncio.get_event_loop()
    try:
        pdf_bytes = await loop.run_in_executor(None, _adapt_and_render_sync, resume_data, theme)
    except Exception as e:
        logger.error(f"PDF Factory: RenderCV failed for {job_id}: {e}")
        return None

    if not validate_pdf(pdf_bytes, candidate_name):
        logger.error(f"PDF Factory: validation failed for {job_id}.")
        return None

    filename = f"{job_id}_{int(time.time())}.pdf"
    try:
        url = await loop.run_in_executor(
            None, _upload_to_supabase, pdf_bytes, filename
        )
        return url
    except Exception as e:
        logger.error(f"PDF Factory: Supabase upload failed for {job_id}: {e}")
        return None
