"""
intelligence/deduplicator.py — PhantmOS v3.0

Canonical Fuzzy Job Deduplication:
  - Canonicalizes title synonyms ("Senior" -> "sr", "Machine Learning" -> "ml", "Software Engineer" -> "swe")
  - Normalizes company names (strips legal suffixes: Inc, LLC, Corp, Technologies, Labs)
  - Standardizes remote/regional locations
  - Produces stable SHA-256 canonical hash across all cross-posted platforms.
"""

import hashlib
import re

from core.database_manager import get_existing_dedup_hashes
from core.logger import get_logger

logger = get_logger(__name__)

TITLE_SYNONYMS = [
    (r"\bsenior\b|\bsr\b|\bsr\.\b", "sr"),
    (r"\bprincipal\b|\bstaff\b|\blead\b|\bhead\b|\bdirector\b", "lead"),
    (r"\bjunior\b|\bjr\b|\bjr\.\b|\bentry\s*level\b|\bassociate\b", "jr"),
    (r"\bintern\b|\binternship\b", "intern"),
    (r"\bmachine\s+learning\b|\bdeep\s+learning\b|\bnlp\b|\bcomputer\s+vision\b|\bmlops\b", "ml"),
    (r"\bartificial\s+intelligence\b|\bgenerative\s+ai\b|\bgenai\b", "ai"),
    (r"\bsoftware\s+engineer\b|\bsoftware\s+developer\b|\bprogrammer\b|\bswe\b|\bsde\b", "swe"),
    (r"\bfull\s*stack\b", "fullstack"),
    (r"\bfront\s*end\b", "frontend"),
    (r"\bback\s*end\b", "backend"),
    (r"\bdata\s+engineer\b|\bdata\s+engineering\b", "de"),
    (r"\bdata\s+scientist\b|\bdata\s+science\b", "ds"),
    (r"\bdevops\b|\bsite\s+reliability\b|\bsre\b|\binfrastructure\b|\bplatform\b", "infra"),
    (r"\bproduct\s+manager\b|\bpm\b", "pm"),
    (r"\bengineer\b|\bdeveloper\b", "eng"),
]

COMPANY_SUFFIXES = r"\b(inc|ltd|limited|llc|corp|corporation|gmbh|technologies|technology|tech|labs|ai|io|co|company|systems|software|holdings|ventures|solutions)\b"


def normalize_title(title: str) -> str:
    """Normalize common title variations and synonyms into canonical token forms."""
    t = (title or "").lower().strip()
    # Normalize punctuation and dashes to spaces
    t = re.sub(r"[^\w\s]", " ", t)
    for pattern, replacement in TITLE_SYNONYMS:
        t = re.sub(pattern, replacement, t)
    # Sort distinct tokens to handle "Backend SWE" vs "SWE Backend" identically
    tokens = sorted(set(t.split()))
    return " ".join(tokens)


def normalize_company(company: str) -> str:
    """Strip corporate suffixes and legal boilerplate from company names."""
    c = (company or "").lower().strip()
    c = re.sub(COMPANY_SUFFIXES, "", c)
    c = re.sub(r"[^\w\s]", "", c)
    return "".join(c.split())


def normalize_location(location: str) -> str:
    """Collapse all remote location variations to 'remote'."""
    loc = (location or "").lower().strip()
    if any(k in loc for k in ["remote", "anywhere", "worldwide", "global", "wfh", "telecommute", "work from home", "virtual"]):
        return "remote"
    return re.sub(r"[^\w\s]", "", loc).strip()


def make_dedup_hash(company: str, title: str, location: str = "") -> str:
    """
    Generate a canonical hash stable across multiple job boards.
    Collapses cross-posted variations into a single unified record.
    """
    c_comp = normalize_company(company)
    c_title = normalize_title(title)
    c_loc = normalize_location(location)

    key = f"{c_comp}:{c_title}:{c_loc}".encode("utf-8")
    return hashlib.sha256(key).hexdigest()


def jaccard_similarity(str1: str, str2: str) -> float:
    """Compute token-level Jaccard similarity for fuzzy string matching."""
    set1 = set(normalize_title(str1).split())
    set2 = set(normalize_title(str2).split())
    if not set1 or not set2:
        return 0.0
    intersection = set1.intersection(set2)
    union = set1.union(set2)
    return len(intersection) / len(union)


def filter_new_jobs(jobs: list[dict], user_id: str | None = None) -> list[dict]:
    """
    Filter out duplicate or already-seen jobs using canonical deduplication.
    Attaches 'dedup_hash' to each job dictionary.
    """
    if not jobs:
        return []

    # Attach canonical hashes
    for job in jobs:
        job["dedup_hash"] = make_dedup_hash(
            job.get("company", ""),
            job.get("title", ""),
            job.get("location", "")
        )

    all_hashes = [j["dedup_hash"] for j in jobs]
    existing = get_existing_dedup_hashes(all_hashes, user_id)

    new_jobs = [j for j in jobs if j["dedup_hash"] not in existing]

    # In-batch deduplication (in case duplicate rows exist within the same harvest batch)
    seen_in_batch = set()
    unique_batch_jobs = []
    for j in new_jobs:
        h = j["dedup_hash"]
        if h not in seen_in_batch:
            seen_in_batch.add(h)
            unique_batch_jobs.append(j)

    skipped = len(jobs) - len(unique_batch_jobs)
    if skipped:
        logger.info(f"Deduplicator: filtered {skipped} duplicate listings, retaining {len(unique_batch_jobs)} canonical jobs.")

    return unique_batch_jobs
