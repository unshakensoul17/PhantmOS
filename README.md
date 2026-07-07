---
title: PhantmOS Engine
emoji: 👻
colorFrom: blue
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

<div align="center">

<h1>👻 PhantmOS v3.0</h1>
<p><strong>Autonomous Multi-Agent Job Application Engine</strong></p>
<p>Discovers remote opportunities, scores them against your résumé with semantic AI, tailors them with an LLM waterfall, generates polished PDFs, and fires off cold emails — completely on autopilot.</p>

[![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_+_Auth-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## What It Does

PhantmOS is a fully automated SaaS platform that runs an end-to-end job search pipeline on a schedule. Once your résumé JSON is uploaded, the system works in the background without any manual input:

1. **Scrapes** remote job boards (Remotive, Himalayas, Arbeitnow, HN *Who's Hiring*) simultaneously
2. **Pre-filters** results with BM25 ranking against your target role query
3. **Scores** every job with a three-signal composite (semantic similarity, keyword overlap, title match)
4. **Tailors** your résumé for every HOT and WARM lead using an LLM waterfall (Groq → Gemini → HuggingFace)
5. **Evaluates** ATS compatibility and generates interview prep cheat sheets per company
6. **Generates** a formatted PDF résumé per job via RenderCV + Typst, uploaded to Supabase Storage
7. **Delivers** job cards to your Telegram and sends cold follow-up emails via Gmail SMTP
8. **Resets** 30 free credits every calendar month per user; supports BYOK for unlimited usage

---

## Architecture in One Diagram

```
┌─────────────────────────────────────────────────────┐
│              PHANTMOS v3.0                    │
│                                                     │
│  global_harvester.py  ──► global_jobs (Supabase)    │
│         ↑ runs independently, once per N hours      │
│                                                     │
│  main_orchestrator.py — per-user pipeline loop      │
│  │                                                  │
│  ├─ Stage 1: DiscoveryAgent                         │
│  │   └─ Queries global_jobs pool first              │
│  │   └─ Falls back to external APIs if < 5 local    │
│  │   └─ BM25 filter → dedup hash → bulk upsert      │
│  │                                                  │
│  ├─ Stage 2: RankingAgent                           │
│  │   └─ Jina AI embeddings (local MiniLM fallback)  │
│  │   └─ Score = 50% semantic + 30% keyword + 20%    │
│  │      title match → HOT / WARM / COLD / REJECT    │
│  │                                                  │
│  ├─ Stage 3: ResumeAgent                            │
│  │   └─ LLM Waterfall: Groq → Gemini → HF           │
│  │   └─ HOT = full tailor, WARM = light tailor       │
│  │   └─ Output validated + stored in notes JSON      │
│  │                                                  │
│  ├─ Stage 4: ApplicationAgent (PDFs)                │
│  │   └─ RenderCV (Typst backend) compiles JSON→PDF  │
│  │   └─ Uploads to Supabase Storage (public URL)    │
│  │                                                  │
│  └─ Stage 5: ApplicationAgent (Delivery)            │
│      └─ delivery_queue → Telegram job cards         │
│      └─ Cold email via Gmail SMTP (with PDF attach)  │
│                                                     │
│  dashboard.py — FastAPI + React SPA (port 7860)     │
└─────────────────────────────────────────────────────┘
```

---

## Features

### 🤖 8-Agent Architecture

| Agent | Stage | Responsibility |
|---|---|---|
| `DiscoveryAgent` | 1 | Multi-source harvesting, BM25 filter, deduplication |
| `RankingAgent` | 2 | Semantic + keyword + title scoring, band classification |
| `ResearchAgent` | — | OSINT company intel via DuckDuckGo + Groq |
| `ResumeAgent` | 3 | LLM waterfall résumé tailoring (HOT/WARM strategies) |
| `ATSAgent` | — | ATS score (0-100), keyword gap detection, interview prep |
| `ApplicationAgent` | 4+5 | PDF generation (RenderCV/Typst), Telegram + email delivery |
| `FeedbackAgent` | — | User dismissal signals → adjusts scoring weights |
| `AnalyticsAgent` | — | Pipeline stats, daily digest, dashboard data |

### 📊 Scoring Engine (verified from `intelligence/scorer.py`)

```
Final Score (0–100) = Σ of:
  Semantic Similarity × 50%   (Jina AI cosine distance)
  Keyword Overlap     × 30%   (résumé skills vs. JD)
  Title Match         × 20%   (target role list lookup)

Bands:
  HOT  — above (threshold + (100 - threshold) / 2)  → full LLM tailor
  WARM — above user's telegram_threshold (default 60) → light tailor
  COLD — ≥ 40                                        → store, no tailor
  REJECT — < 40                                      → auto-dismissed
```

The résumé embedding is computed once, cached to Supabase `embedding_cache`, and reused across every pipeline run. Job description embeddings are also cached by MD5 hash (global across all users).

### 🔄 LLM Waterfall (from `synthesis/llm_waterfall.py`)

The user configures a primary and secondary engine in the dashboard settings. The waterfall tries each in sequence with 3 retries and exponential backoff (5s → 15s → 30s):

```
Primary engine  (user-configured, default: Groq/Llama-3.1-8b-instant)
  → Secondary engine (user-configured, default: Gemini Flash)
    → HuggingFace Mistral-7B (if HF_API_KEY set)
      → Original résumé used as-is (silent fallback)
```

All LLM outputs pass a structured validator before being accepted — no hallucinated résumé sections are saved.

### 🏢 Company Intelligence (from `synthesis/company_research.py`)

Per company, PhantmOS uses DuckDuckGo to fetch real-time news headlines (overcoming the LLM's knowledge cutoff), then calls Groq to produce:
- Tech stack (5–8 keywords)
- Stability risk score (0–100) + trend label
- 3 recent news/funding events
- Interview playbook: cultural values, historical technical questions by stage, recent product launches

### 🔐 Multi-Tenant Security

- **Auth**: Supabase Auth issues JWTs. FastAPI validates via `client.auth.get_user(token)` with a 5-minute local cache.
- **RLS**: `user_profiles`, `user_job_pipelines`, `delivery_queue`, `stage_logs`, and `user_feedback` all enforce `auth.uid() = user_id`.
- **BYOK encryption**: User API keys are encrypted with Fernet (AES-128-CBC) using a SHA-256 digest of `SUPABASE_KEY` as the symmetric key. Only `"***"` is returned to the frontend.
- **Credits**: Atomic deduction via `decrement_user_credits` PostgreSQL RPC; 30 credits refilled monthly via a lazy trigger inside `get_profile()`.

---

## Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Framework | FastAPI + Uvicorn |
| Scheduling | APScheduler (AsyncIO) |
| Database ORM | Supabase Python client |
| Database | PostgreSQL (Supabase) + pgvector |
| Embeddings | Jina AI `jina-embeddings-v3` → fallback: `paraphrase-MiniLM-L3-v2` |
| LLM Layer | Groq (Llama-3.1-8b-instant), Gemini Flash, HuggingFace (Mistral-7B) |
| Pre-filter | BM25 (`rank_bm25`) |
| PDF Engine | RenderCV + Typst (subprocess) |
| PDF Parsing | pypdf (for résumé upload) |
| Encryption | `cryptography.fernet` |
| Notifications | `python-telegram-bot`, smtplib (Gmail) |

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 19 + Vite 8 |
| Router | TanStack Router (file-based) |
| Styling | TailwindCSS v4 |
| UI Primitives | Radix UI (full suite) |
| Server State | TanStack Query |
| Auth Client | `@supabase/supabase-js` |
| Charts | Recharts |
| Animations | Motion (Framer) |

### Infrastructure
| Component | Technology |
|---|---|
| Container | Docker (`python:3.12-slim`) |
| Primary Hosting | Hugging Face Spaces (Docker runtime, port 7860) |
| Storage | Supabase Storage (PDF résumés, 1 GB free) |
| Process Model | Dual-process via `entrypoint.sh`: orchestrator + Uvicorn |

---

## Project Structure

```
siro/
├── dashboard.py              # FastAPI app — all REST routes + SPA fallback
├── main_orchestrator.py      # APScheduler loop — coordinates agents per user
├── global_harvester.py       # One-shot global job harvester (runs as cron)
├── entrypoint.sh             # Docker entrypoint: starts orchestrator + uvicorn
│
├── agents/                   # 8 stateless agents, one responsibility each
│   ├── discovery_agent.py
│   ├── ranking_agent.py
│   ├── research_agent.py
│   ├── resume_agent.py
│   ├── ats_agent.py
│   ├── application_agent.py
│   ├── feedback_agent.py
│   └── analytics_agent.py
│
├── core/
│   ├── config.py             # All env vars, scoring weights, band thresholds
│   ├── database_manager.py   # Supabase client + all DB operations
│   ├── encryption.py         # Fernet BYOK encryption/decryption
│   └── logger.py
│
├── harvesting/
│   ├── harvest_orchestrator.py  # asyncio.gather() across all sources
│   ├── source_remotive.py
│   ├── source_himalayas.py
│   ├── source_secret.py         # Arbeitnow / secondary aggregator
│   └── source_hn.py             # HN Who's Hiring (runs on 1st of month)
│
├── intelligence/
│   ├── embedding_engine.py   # Jina AI + MiniLM fallback + Supabase cache
│   ├── scorer.py             # 3-signal composite scorer + band assignment
│   ├── keyword_filter.py     # BM25 pre-filter (rank_bm25)
│   └── deduplicator.py       # MD5 hash dedup against Supabase
│
├── synthesis/
│   ├── llm_waterfall.py      # Groq → Gemini → HF retry chain
│   ├── resume_tailor.py      # HOT/WARM resume JSON mutation logic
│   ├── prompt_builder.py     # Structured prompt construction
│   ├── output_validator.py   # JSON structure + hallucination checks
│   ├── pdf_factory.py        # RenderCV subprocess + Supabase Storage upload
│   ├── pdf_validator.py      # Validates generated PDF bytes
│   ├── company_research.py   # OSINT intel + interview playbooks
│   ├── evaluator.py          # ATS scoring logic
│   ├── context_researcher.py
│   ├── llm_groq.py
│   ├── llm_gemini.py
│   └── llm_hf.py
│
├── interface/
│   ├── telegram_delivery.py  # Bot webhook + job card sender
│   └── email_dispatcher.py   # Gmail SMTP cold email
│
├── delivery/
│   └── daily_digest.py       # Daily summary to Telegram
│
├── frontend/                 # React + Vite SPA (built → served by FastAPI)
│   ├── src/routes/           # TanStack file-based routes
│   ├── src/components/       # Radix UI primitives + dashboard widgets
│   └── src/lib/              # Supabase JS client + utilities
│
├── schema_v3_multiuser.sql   # RLS + multi-tenant migration
├── schema_v4_global_jobs.sql # global_jobs + user_job_pipelines tables
└── schema_v5_auth_trigger.sql# Auto-provision user_profiles on signup
```

---

## Database Schema

```
auth.users  ──────────────────────────────────────────
    │  (Supabase Auth — trigger on INSERT)
    ▼
user_profiles         (credits, encrypted_keys, preferences, telegram_chat_id)
    │
    ├──► user_resumes  (partitioned: resume_data JSONB)
    │
    └──► user_job_pipelines  ◄── global_jobs (job_id PK, dedup_hash UNIQUE)
              │ (user_id, job_id, status, match_score, score_band,
              │  notes JSONB, resume_url)
              │
              ├──► delivery_queue   (status, attempts, last_attempt)
              ├──► user_feedback    (action, skip_reason)
              └──► stage_logs       (stage, status, message)

embedding_cache   (key, embedding vector)
company_context   (company_name, context, age_days)
```

**Key tables:**
- `global_jobs` — deduplicated job pool shared across all users. Only READ by users (RLS); written by the global harvester.
- `user_job_pipelines` — junction table. One row per (user, job) pair. Holds everything user-specific: score, band, tailored résumé JSON, PDF URL.
- `embedding_cache` — résumé and job-description embeddings stored by key. Prevents redundant API calls globally.

---

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 20+
- Supabase project with at least one user
- System libraries for WeasyPrint PDF engine:
  ```bash
  # Ubuntu / Debian
  sudo apt-get install libpango-1.0-0 libpangoft2-1.0-0 libpangocairo-1.0-0 \
    libcairo2 libgdk-pixbuf2.0-0 libffi-dev libglib2.0-0
  ```

### 1. Clone & install

```bash
git clone https://github.com/youruser/siro.git && cd siro

python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cd frontend && npm install && npm run build && cd ..
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in SUPABASE_URL, SUPABASE_KEY, and at least one LLM key
```

See [ENVIRONMENT.md](ENVIRONMENT.md) for the full variable reference.

### 3. Run Supabase migrations

In the Supabase Dashboard → SQL Editor, execute in order:

```
schema_v3_multiuser.sql
schema_v4_global_jobs.sql
schema_v5_auth_trigger.sql
```

### 4. Run locally

```bash
# Unified (backend serves pre-built frontend)
python dashboard.py

# Split (HMR for frontend dev)
python dashboard.py &          # Terminal 1 — API on :8080
cd frontend && npm run dev     # Terminal 2 — Vite on :5173
```

### 5. Docker

```bash
cd frontend && npm run build && cd ..
docker build -t ghost-protocol .
docker run -p 7860:7860 --env-file .env ghost-protocol
```

> **Hugging Face Spaces**: `entrypoint.sh` starts `main_orchestrator.py` in the background, then binds Uvicorn to `0.0.0.0:7860` in the foreground.

---

## API Quick Reference

All endpoints require `Authorization: Bearer <supabase_jwt>` unless noted.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/stats` | Pipeline stats: HOT/WARM/COLD counts, credits, score histogram |
| `GET` | `/api/leads` | Paginated leads (filter by `band`, `status`, `cursor`) |
| `POST` | `/api/leads/{job_id}/status` | Move a lead to a new status |
| `POST` | `/api/harvest` | Trigger full pipeline for authenticated user |
| `POST` | `/api/digest` | Trigger daily digest manually |
| `GET/POST` | `/api/profile` | Get or update résumé JSON |
| `POST` | `/api/profile/upload` | Parse a PDF résumé via Groq → JSON |
| `GET/POST` | `/api/byok` | Fetch masked / save BYOK API keys |
| `GET/POST` | `/api/settings` | User preferences (LLM engine, scoring, notifications) |
| `GET` | `/api/companies/research` | OSINT company intel + stability score |
| `GET` | `/api/companies/playbook` | Interview cheat sheet for company + role |
| `POST` | `/api/applications/ghost-writer` | Generate personalized follow-up email |
| `POST` | `/api/applications/send-email` | Send cold email via Gmail SMTP |
| `GET` | `/api/health` | Liveness probe: `{"status":"ok","version":"3.0"}` |
| `GET` | `/api/admin/users` | *(admin)* List all user profiles |
| `POST` | `/api/admin/users/{id}/credits` | *(admin)* Set credit balance |

Full request/response schemas are in [API.md](API.md).

---

## Configuration Reference

The scoring engine and scheduler are tunable via `core/config.py`:

```python
# Scoring weights
SCORE_WEIGHTS = {"semantic": 0.50, "keyword": 0.30, "title": 0.20}

# Band thresholds (overridden dynamically by per-user telegram_threshold)
BAND_THRESHOLDS = {"HOT": 85.0, "WARM": 60.0, "COLD": 40.0}

# Scheduler — runs every hour; skips users whose frequency_hours hasn't elapsed
HARVEST_HOURS   = [10, 14]   # IST
DIGEST_HOUR     = 9          # IST daily

# Retry backoff (seconds)
RETRY_WAITS = [5, 15, 30]
```

Per-user overrides (set in dashboard Settings) are stored in `user_profiles.preferences` as JSONB.

---

## Environment Variables

| Variable | Required | Purpose |
|---|:---:|---|
| `SUPABASE_URL` | ✅ | Supabase project endpoint |
| `SUPABASE_KEY` | ✅ | Anon/public key (also used as Fernet seed) |
| `SERVICE_ROLE_KEY` | — | Bypasses RLS for backend workers |
| `GROQ_API_KEY` | ⚠️ | LLM inference (at least one LLM key required) |
| `GEMINI_API_KEY` | ⚠️ | Gemini Flash — résumé tailoring fallback |
| `HF_API_KEY` | — | HuggingFace Mistral-7B — third-tier fallback |
| `JINA_API_KEY` | — | Jina embeddings (falls back to local MiniLM if unset) |
| `TELEGRAM_BOT_TOKEN` | — | Bot token for job card delivery |
| `TELEGRAM_ALLOWED_CHAT_ID` | — | Admin/legacy single-user chat ID |
| `GMAIL_USER` | — | Gmail address for cold email dispatch |
| `GMAIL_APP_PASSWORD` | — | 16-char Google App Password |
| `DEFAULT_TIMEZONE` | — | APScheduler timezone (default: `Asia/Kolkata`) |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for branching strategy, commit conventions, and PR checklist.

See [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md) for the rules on stateless agents, adding job sources, and database migration conventions.

---

## Security

User API keys (BYOK) are encrypted with `cryptography.fernet` before storage and never returned to the client in plaintext. Full security posture documented in [SECURITY.md](SECURITY.md).

---

## License

MIT — see [LICENSE](LICENSE).
