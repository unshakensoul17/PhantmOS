"""
synthesis/pdf_factory.py — Ghost Protocol v2.0

Async PDF generation pipeline:
  1. Select template via template_router
  2. Render HTML with Jinja2
  3. Convert to PDF bytes with WeasyPrint (in thread executor)
  4. Validate the PDF
  5. Upload to Supabase Storage (1GB free)
  6. Return permanent public URL

If WeasyPrint is not installed, falls back gracefully.
"""
import asyncio
import io
import os
import time
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape
from core.config import SUPABASE_URL, SUPABASE_KEY
from core.database_manager import get_client
from core.logger import get_logger
from synthesis.template_router import select_template
from synthesis.pdf_validator import validate_pdf

logger = get_logger(__name__)

# Absolute path to the templates directory
TEMPLATES_DIR = Path(__file__).parent.parent / "pdf" / "templates"

# Supabase Storage bucket name
STORAGE_BUCKET = "resumes"


# ── Jinja2 environment (loaded once) ─────────────────────────────────────────

def _get_jinja_env() -> Environment:
    return Environment(
        loader=FileSystemLoader(str(TEMPLATES_DIR)),
        autoescape=select_autoescape(["html"]),
        trim_blocks=True,
        lstrip_blocks=True,
    )


# ── WeasyPrint PDF generation (synchronous — must run in executor) ────────────

def _render_html(resume_data: dict, template_name: str) -> str:
    """Render the Jinja2 template with resume data. Returns HTML string."""
    env  = _get_jinja_env()
    tmpl = env.get_template(f"{template_name}.html")

    cv = resume_data.get("cv", {})
    return tmpl.render(cv=cv)


def _html_to_pdf_sync(html: str) -> bytes:
    """Convert HTML string to PDF bytes using WeasyPrint."""
    try:
        from weasyprint import HTML
        pdf_bytes = HTML(string=html).write_pdf()
        return pdf_bytes
    except ImportError:
        raise RuntimeError(
            "WeasyPrint is not installed. "
            "Run: pip install weasyprint"
        )


# ── Supabase Storage upload ────────────────────────────────────────────────────

def _upload_to_supabase(pdf_bytes: bytes, filename: str) -> str:
    """
    Upload PDF bytes to Supabase Storage.
    Returns the public URL of the uploaded file.
    """
    client = get_client()

    # Ensure bucket exists (create if not — idempotent)
    try:
        client.storage.create_bucket(
            STORAGE_BUCKET,
            options={"public": True},
        )
    except Exception:
        pass   # Bucket likely already exists

    # Upload (upsert — overwrite if same filename exists)
    client.storage.from_(STORAGE_BUCKET).upload(
        path=filename,
        file=pdf_bytes,
        file_options={
            "content-type": "application/pdf",
            "upsert": "true",
        },
    )

    # Build the public URL
    # Format: {SUPABASE_URL}/storage/v1/object/public/{bucket}/{filename}
    public_url = (
        f"{SUPABASE_URL.rstrip('/')}"
        f"/storage/v1/object/public/{STORAGE_BUCKET}/{filename}"
    )
    logger.info(f"PDF uploaded: {public_url}")
    return public_url


# ── Public async interface ────────────────────────────────────────────────────

async def generate_and_upload_pdf(
    job_id: str,
    resume_data: dict,
    company_name: str = "",
    company_context: str = "",
) -> str | None:
    """
    Full PDF pipeline for one job lead:
      Select template → Render HTML → Generate PDF → Validate → Upload → URL

    Args:
        job_id:          UUID of the job lead (used in filename).
        resume_data:     Full tailored resume JSON dict.
        company_name:    Used for template selection.
        company_context: Research context for template selection.

    Returns:
        Supabase Storage public URL, or None on failure.
    """
    template_name = select_template(company_name, company_context)
    candidate_name = resume_data.get("cv", {}).get("name", "")

    logger.info(
        f"PDF Factory: generating for job={job_id} "
        f"template={template_name} candidate='{candidate_name}'"
    )

    # ── 1. Render HTML ────────────────────────────────────────────────────────
    try:
        html = _render_html(resume_data, template_name)
    except Exception as e:
        logger.error(f"PDF Factory: Jinja2 render failed for {job_id}: {e}")
        return None

    # ── 2. Generate PDF bytes (blocking → thread executor) ────────────────────
    loop = asyncio.get_event_loop()
    try:
        pdf_bytes = await loop.run_in_executor(None, _html_to_pdf_sync, html)
    except RuntimeError as e:
        logger.error(f"PDF Factory: WeasyPrint error for {job_id}: {e}")
        return None
    except Exception as e:
        logger.error(f"PDF Factory: unexpected PDF error for {job_id}: {e}")
        return None

    # ── 3. Validate ────────────────────────────────────────────────────────────
    if not validate_pdf(pdf_bytes, candidate_name):
        logger.error(f"PDF Factory: validation failed for {job_id}.")
        return None

    # ── 4. Upload to Supabase Storage ─────────────────────────────────────────
    filename = f"{job_id}_{int(time.time())}.pdf"
    try:
        url = await loop.run_in_executor(
            None, _upload_to_supabase, pdf_bytes, filename
        )
        return url
    except Exception as e:
        logger.error(f"PDF Factory: Supabase upload failed for {job_id}: {e}")
        # Fallback: save locally so we can still attach the file
        return _save_local_fallback(pdf_bytes, job_id)


# ── Local fallback (used if Supabase upload fails) ────────────────────────────

def _save_local_fallback(pdf_bytes: bytes, job_id: str) -> str | None:
    """Save PDF locally as a last resort. Returns local path or None."""
    try:
        local_dir = Path(os.getcwd()) / "data" / "resumes"
        local_dir.mkdir(parents=True, exist_ok=True)
        local_path = local_dir / f"{job_id}.pdf"
        local_path.write_bytes(pdf_bytes)
        logger.warning(f"PDF saved locally (Supabase failed): {local_path}")
        return str(local_path)
    except Exception as e:
        logger.error(f"PDF Factory: local fallback also failed: {e}")
        return None


# ── Compatibility shim for old callers (v1 orchestrator) ─────────────────────

def generate_pdf(updated_resume_json: dict, output_path: str) -> str | None:
    """
    Synchronous shim kept for backward compatibility with v1 orchestrator.
    Will be removed in the final Phase 7 orchestrator rebuild.
    """
    try:
        html  = _render_html(updated_resume_json, "tech_company")
        pdf_bytes = _html_to_pdf_sync(html)
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(pdf_bytes)
        return str(path)
    except Exception as e:
        logger.error(f"generate_pdf (compat shim) failed: {e}")
        return None
