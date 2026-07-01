"""
synthesis/pdf_validator.py — Ghost Protocol v2.0

Post-generation PDF validation.
Checks file integrity, required sections, and page count.
"""
import io
from core.logger import get_logger

logger = get_logger(__name__)

MIN_SIZE_BYTES = 5_000     # < 5KB = almost certainly broken
MAX_PAGES      = 2         # target 1 page, allow 2 as safety


def validate_pdf(pdf_bytes: bytes, candidate_name: str = "") -> bool:
    """
    Validate a generated PDF.

    Checks:
      1. Non-empty and above minimum size threshold
      2. Starts with the PDF magic bytes (%PDF)
      3. Contains expected name text (if provided)
      4. Page count is within acceptable range

    Returns True if valid, False if it should be retried/rejected.
    """
    if not pdf_bytes:
        logger.error("PDF Validator: pdf_bytes is empty.")
        return False

    # Check 1: Minimum size
    if len(pdf_bytes) < MIN_SIZE_BYTES:
        logger.error(
            f"PDF Validator: file too small ({len(pdf_bytes)} bytes < {MIN_SIZE_BYTES})."
        )
        return False

    # Check 2: PDF magic bytes
    if not pdf_bytes.startswith(b"%PDF"):
        logger.error("PDF Validator: file does not start with %PDF magic bytes.")
        return False

    # Check 3: Name appears in raw bytes (crude text presence check)
    if candidate_name:
        name_bytes = candidate_name.encode("utf-8", errors="ignore")
        # PDFs encode text in streams — do a basic search in the raw bytes
        # This won't catch all encodings but catches most WeasyPrint output
        if name_bytes not in pdf_bytes and name_bytes.lower() not in pdf_bytes.lower():
            logger.warning(
                f"PDF Validator: candidate name '{candidate_name}' "
                "not found in PDF bytes (may be fine for some encodings)."
            )
            # Don't fail — just warn

    # Check 4: Page count via counting /Page objects
    try:
        page_count = _count_pdf_pages(pdf_bytes)
        if page_count > MAX_PAGES:
            logger.warning(
                f"PDF Validator: {page_count} pages found (max {MAX_PAGES}). "
                "Resume may be too long."
            )
            # Don't fail — warn and continue
        else:
            logger.info(f"PDF Validator: {page_count} page(s). OK.")
    except Exception as e:
        logger.warning(f"PDF Validator: could not count pages: {e}")

    logger.info(
        f"PDF Validator: PASS ({len(pdf_bytes):,} bytes)."
    )
    return True


def _count_pdf_pages(pdf_bytes: bytes) -> int:
    """
    Count PDF pages by scanning for /Type /Page objects.
    Lightweight — no external library needed.
    """
    # Each page is represented as /Type /Page (not /Type /Pages)
    count = pdf_bytes.count(b"/Type /Page")
    # Some PDFs use /Type/Page without space
    count += pdf_bytes.count(b"/Type/Page")
    # Subtract the /Pages (plural) container entries
    count -= pdf_bytes.count(b"/Type /Pages")
    count -= pdf_bytes.count(b"/Type/Pages")
    return max(count, 1)   # minimum 1
