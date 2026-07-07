"""
intelligence/keyword_filter.py — PhantmOS v2.0 (BM25 Edition)

Uses BM25 search scoring to pre-filter harvested jobs based on relevance,
dropping completely unrelated jobs before they hit the database.
"""
from rank_bm25 import BM25Okapi
from core.logger import get_logger
import re

# Hardcoded fallback lists (formerly in config.py)
EXCLUDE_KEYWORDS = ["clearance", "polygraph", "ts/sci", "secret clearance", "us citizen only"]
REQUIRED_KEYWORDS = []

logger = get_logger(__name__)

def tokenize(text: str) -> list[str]:
    """Simple lowercasing and alphanumeric tokenization."""
    if not text: return []
    return re.findall(r'\b\w+\b', text.lower())

def filter_jobs_by_relevance(jobs: list[dict], search_query: str = None) -> list[dict]:
    """
    Applies BM25 scoring across the corpus of fetched jobs.
    Returns only jobs that score > 0 (meaning they have at least some relevance).
    """
    if not jobs:
        return []
        
    # If no search query is provided, fallback to basic blacklist filtering
    if not search_query:
        return [j for j in jobs if _passes_blacklist(j)]

    # 1. Build the corpus
    tokenized_corpus = []
    for job in jobs:
        # Title is heavily weighted in typical search, so we duplicate it in the corpus text
        title = job.get("title", "")
        desc = job.get("raw_description", "") or job.get("description", "")
        combined = f"{title} {title} {title} {desc}"
        tokenized_corpus.append(tokenize(combined))
        
    # 2. Initialize BM25
    bm25 = BM25Okapi(tokenized_corpus)
    
    # 3. Score the query
    tokenized_query = tokenize(search_query)
    scores = bm25.get_scores(tokenized_query)
    
    # 4. Filter jobs based on score and blacklist
    filtered_jobs = []
    # If it's exactly 0, it means NONE of the query words appeared.
    threshold = 0.0 
    
    for i, job in enumerate(jobs):
        score = scores[i]
        if score > threshold:
            if _passes_blacklist(job):
                filtered_jobs.append(job)
        else:
            pass # Silently drop, it's irrelevant
            
    return filtered_jobs

def _passes_blacklist(job: dict) -> bool:
    """Hard exclusions — reject immediately if blacklist words are found."""
    title = job.get("title", "")
    desc = job.get("raw_description", "") or job.get("description", "")
    combined = f"{title} {desc}".lower()
    
    for kw in EXCLUDE_KEYWORDS:
        if kw.lower() in combined:
            return False
    return True
