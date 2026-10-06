"""
intelligence/keyword_filter.py — PhantmOS v3.0

Relevance pre-filter for job harvest results using Taxonomy Expansion and Boolean Density.
Ensures we retain jobs that match the core domain (e.g. "Software Engineering Intern" 
for a "python intern" search) without requiring strict title matches.
"""
from core.logger import get_logger
import re

logger = get_logger(__name__)

EXCLUDE_KEYWORDS = ["clearance", "polygraph", "ts/sci", "secret clearance", "us citizen only"]

import os
import json

TAXONOMY_FILE = os.path.join(os.path.dirname(__file__), "..", "taxonomy.json")

try:
    with open(TAXONOMY_FILE, "r") as f:
        JOB_TAXONOMY = json.load(f)
except FileNotFoundError:
    logger.warning("taxonomy.json not found! Falling back to default taxonomy.")
    JOB_TAXONOMY = {
        "frontend": ["frontend", "front-end", "react", "vue", "javascript", "typescript", "ui/ux", "web developer", "ui developer", "html", "css", "angular"],
        "backend": ["backend", "back-end", "python", "java", "node", "golang", "ruby", "django", "spring", "c++", "c#", ".net", "php", "laravel"],
        "fullstack": ["fullstack", "full-stack", "full stack", "react", "node", "javascript", "python", "java", "ruby", "django"],
        "data science": ["data scientist", "machine learning", "ai", "python", "pandas", "pytorch", "tensorflow", "data analysis", "sql", "r", "nlp"],
        "game": ["game", "unity", "unreal", "c#", "c++", "3d", "gameplay", "graphics", "opengl", "directx", "vulkan", "shader"],
        "devops": ["devops", "aws", "docker", "kubernetes", "ci/cd", "infrastructure", "terraform", "sre", "azure", "gcp", "linux", "sysadmin"],
        "mobile": ["mobile", "ios", "android", "swift", "kotlin", "react native", "flutter", "objective-c", "java"],
        "cloud": ["cloud", "aws", "azure", "gcp", "google cloud", "devops", "infrastructure"],
        "qa": ["qa", "quality assurance", "testing", "automation", "selenium", "cypress", "jest", "pytest", "sdet"],
        "security": ["security", "cybersecurity", "infosec", "penetration", "soc", "incident response", "cryptography", "network security"]
    }

# Words too generic to be "domain" words
_GENERIC_TOKENS = {
    "engineer", "developer", "manager", "remote", "senior", "junior",
    "specialist", "analyst", "intern", "lead", "staff", "head",
    "associate", "principal", "architect", "freelance", "contract",
    "part-time", "full-time", "programmer", "expert", "consultant"
}


def tokenize(text: str) -> list[str]:
    """Lowercase alphanumeric tokenization."""
    if not text:
        return []
    return re.findall(r'\b\w+\b', text.lower())


def get_taxonomy_keywords(query: str) -> list[str]:
    """Check if any taxonomy key is in the query, return its keywords."""
    query_lower = query.lower()
    for category, keywords in JOB_TAXONOMY.items():
        if category in query_lower:
            return keywords
    return []


def filter_jobs_by_relevance(jobs: list[dict], search_query: str = None) -> list[dict]:
    """
    Taxonomy Expansion + Boolean Density pre-filter:
      1. Parse Query: Check taxonomy or extract core tokens.
      2. Density Check: Pass if core/taxonomy words are in title.
         If only in description, require multiple occurrences.
    """
    if not jobs:
        return []

    if not search_query:
        return [j for j in jobs if _passes_blacklist(j)]

    query_lower = search_query.lower()
    taxonomy_keywords = get_taxonomy_keywords(query_lower)
    
    tokenized_query = tokenize(query_lower)
    core_words = [t for t in tokenized_query if t not in _GENERIC_TOKENS]
    if not core_words and not taxonomy_keywords:
        # If the query was entirely generic (e.g. "intern engineer"), keep everything that passes blacklist
        return [j for j in jobs if _passes_blacklist(j)]

    filtered_jobs = []
    
    for job in jobs:
        if not _passes_blacklist(job):
            continue
            
        title = job.get("title", "").lower()
        desc = (job.get("raw_description", "") or job.get("description", "")).lower()
        
        passed = False
        
        # Rule A: Taxonomy Match
        if taxonomy_keywords:
            # 1. If any taxonomy word is explicitly in the title, it passes
            if any(kw in title for kw in taxonomy_keywords):
                passed = True
            else:
                # 2. Density Check: Must have at least 2 hits of taxonomy keywords in description
                hits = sum(1 for kw in taxonomy_keywords if kw in desc)
                if hits >= 2:
                    passed = True
                    
        # Rule B: Core Word Match (Fallback)
        elif core_words:
            # 1. If any core word is in the title, it passes
            if any(cw in title for cw in core_words):
                passed = True
            else:
                # 2. Density Check: A core word must appear >= 2 times in the description
                if any(desc.count(cw) >= 2 for cw in core_words):
                    passed = True
                    
        if passed:
            filtered_jobs.append(job)

    logger.info(f"Retrieval Filter: {len(jobs) - len(filtered_jobs)} rejected, {len(filtered_jobs)} passed.")
    return filtered_jobs


def _passes_blacklist(job: dict) -> bool:
    """Hard exclusions — reject if any blacklist keyword appears in title or description."""
    title = job.get("title", "")
    desc = job.get("raw_description", "") or job.get("description", "")
    combined = f"{title} {desc}".lower()
    return not any(kw.lower() in combined for kw in EXCLUDE_KEYWORDS)
