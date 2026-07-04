"""
core/config.py — Ghost Protocol v2.0
Centralised environment variables, constants, and tuning parameters.
All modules import from here — never from os.getenv directly.
"""
import os
from dotenv import load_dotenv

load_dotenv()

# ─────────────────────────────────────────────────────────
#  SUPABASE
# ─────────────────────────────────────────────────────────
SUPABASE_URL: str = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "").strip()

# ─────────────────────────────────────────────────────────
#  LLM PROVIDERS
# ─────────────────────────────────────────────────────────
GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "").strip()
GROQ_MODEL: str = "llama-3.1-8b-instant"

GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL: str = "gemini-1.5-flash"

HF_API_KEY: str = os.getenv("HF_API_KEY", "").strip()
HF_MODEL: str = "mistralai/Mistral-7B-Instruct-v0.3"

# ─────────────────────────────────────────────────────────
#  EMBEDDINGS
# ─────────────────────────────────────────────────────────
JINA_API_KEY: str = os.getenv("JINA_API_KEY", "").strip()
JINA_EMBED_URL: str = "https://api.jina.ai/v1/embeddings"
JINA_MODEL: str = "jina-embeddings-v3"

# Local fallback model (50MB, no GPU required)
LOCAL_EMBED_MODEL: str = "paraphrase-MiniLM-L3-v2"

# ─────────────────────────────────────────────────────────
#  TELEGRAM
# ─────────────────────────────────────────────────────────
TELEGRAM_BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
TELEGRAM_CHAT_ID: str = os.getenv("TELEGRAM_ALLOWED_CHAT_ID", "").strip()


# ─────────────────────────────────────────────────────────
#  EMAIL (Gmail SMTP)
# ─────────────────────────────────────────────────────────
GMAIL_USER: str = os.getenv("GMAIL_USER", "").strip()
GMAIL_APP_PASSWORD: str = os.getenv("GMAIL_APP_PASSWORD", "").strip()

# ─────────────────────────────────────────────────────────
#  SCHEDULER
# ─────────────────────────────────────────────────────────
DEFAULT_TIMEZONE: str = os.getenv("DEFAULT_TIMEZONE", "Asia/Kolkata")
# Two daily harvest runs (24h clock, IST)
HARVEST_HOURS: list[int] = [10, 14]
HARVEST_MINUTES: list[int] = [0, 30]
# Daily digest time
DIGEST_HOUR: int = 9
DIGEST_MINUTE: int = 0

# ─────────────────────────────────────────────────────────
#  SCORING & BAND THRESHOLDS
# ─────────────────────────────────────────────────────────
SCORE_WEIGHTS = {
    "semantic": 0.50,
    "keyword": 0.30,
    "title": 0.20,
}

BAND_THRESHOLDS = {
    "HOT":  85.0,   # HOT  >= 85%  → full tailoring
    "WARM": 60.0,   # WARM >= 60%  → light tailoring
    "COLD": 40.0,   # COLD >= 40%  → store only
    # REJECT        # < 40%        → discard
}

TARGET_TITLES: list[str] = [
    "ml engineer", "ai engineer", "data scientist",
    "research intern", "software engineer", "nlp engineer",
    "machine learning engineer", "deep learning engineer",
    "computer vision engineer", "ai researcher",
]

# Dynamic default search terms for harvesting engines
_env_target_roles = os.getenv("TARGET_ROLES", "").strip()
if _env_target_roles:
    DEFAULT_SEARCH_TERMS = [r.strip() for r in _env_target_roles.split(",") if r.strip()]
else:
    DEFAULT_SEARCH_TERMS = [
        "machine learning",
        "ai engineer",
        "data scientist",
        "nlp",
        "python developer",
    ]

# ─────────────────────────────────────────────────────────
#  KEYWORD PRE-FILTER (Stage 1 cheap filter — no AI needed)
# ─────────────────────────────────────────────────────────
REQUIRED_KEYWORDS: dict[str, list[str]] = {
    "tech_stack": [
        "python", "pytorch", "tensorflow", "llm", "ml",
        "machine learning", "deep learning", "nlp", "ai",
        "transformer", "neural", "data science",
    ],
    "role_type": [
        "intern", "engineer", "researcher", "developer",
        "scientist", "analyst",
    ],
}

EXCLUDE_KEYWORDS: list[str] = [
    "10+ years", "15 years", "senior director",
    "vice president", "c-level", "chief",
]

# ─────────────────────────────────────────────────────────
#  RETRY CONFIG
# ─────────────────────────────────────────────────────────
RETRY_WAITS: list[int] = [5, 15, 30]   # seconds, exponential-ish backoff

# ─────────────────────────────────────────────────────────
#  COMPANY CONTEXT CACHE TTL
# ─────────────────────────────────────────────────────────
COMPANY_CONTEXT_MAX_AGE_DAYS: int = 7

# ─────────────────────────────────────────────────────────
#  DELIVERY QUEUE
# ─────────────────────────────────────────────────────────
DELIVERY_MAX_ATTEMPTS: int = 3

# ─────────────────────────────────────────────────────────
#  FEEDBACK WEIGHT ADJUSTMENTS
# ─────────────────────────────────────────────────────────
SKIP_REASON_WEIGHTS: dict[str, dict] = {
    "too_junior":      {"seniority_penalty": 0.1},
    "wrong_stack":     {"keyword_weight_boost": 0.05},
    "bad_company":     {"blacklist": True},
    "wrong_location":  {"location_filter": True},
    "not_interested":  {"title_penalty": 0.05},
}
