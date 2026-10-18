# PhantmOS Component Inventory (v3.0.0)

**Date of Audit:** October 18, 2026  
**Auditor:** Senior Software Architect & Code Auditor  
**Repository Working Directory:** `/mnt/data/siro`  
**Git Branch / Commit:** `main` @ `fd151b1`  

---

## 1. System Component Mapping

The following inventory maps every major module in the repository to its responsibilities, dependencies, and verified source evidence.

| Subsystem | File / Directory Path | Architectural Responsibility | Key Dependencies / Libraries | Source Evidence & Function Reference |
|---|---|---|---|---|
| **Backend Entry Point & API** | [`dashboard.py`](file:///mnt/data/siro/dashboard.py) | Exposes FastAPI endpoints for stats, leads, auth, resume generation, company research, and serving TanStack SPA | `fastapi`, `uvicorn`, `supabase`, `pypdf`, `pydantic` | Lines 166–1107: `@app.get("/api/stats")`, `@app.post("/api/leads/{job_id}/resume")`, `@app.post("/api/applications/phantm-writer")` |
| **Orchestration Core** | [`main_orchestrator.py`](file:///mnt/data/siro/main_orchestrator.py) | Coordinates agent execution across hourly, 4-hour, and daily cron schedules; controls credit deduction and stage isolation | `apscheduler`, `asyncio`, `agents.*` | Lines 53–226: `process_pipeline()`, lines 275–318: `main()` APScheduler definitions |
| **Global Background Harvester** | [`global_harvester.py`](file:///mnt/data/siro/global_harvester.py) | Centralized worker pooling distinct search queries across all users and populating `global_jobs` pool | `asyncio`, `agents.discovery_agent` | Lines 13–71: `run_global_harvest()` |
| **Configuration & Constants** | [`core/config.py`](file:///mnt/data/siro/core/config.py) | Centralized environment variable retrieval, band thresholds, score weights, and scheduler intervals | `python-dotenv`, `os` | Lines 16–105: `SUPABASE_URL`, `SCORE_WEIGHTS`, `BAND_THRESHOLDS`, `RETRY_WAITS` |
| **Persistence Layer** | [`core/database_manager.py`](file:///mnt/data/siro/core/database_manager.py) | Database operations across PostgreSQL via Supabase Python SDK, credit management, deduplication queries | `supabase`, `postgrest` | Lines 25–740: `get_client()`, `get_profile()`, `bulk_upsert_job_leads()`, `deduct_credit()` |
| **Cryptographic Utilities** | [`core/encryption.py`](file:///mnt/data/siro/core/encryption.py) | Fernet symmetric credential encryption for user BYOK LLM keys | `cryptography.fernet`, `hashlib`, `base64` | Lines 15–35: `encrypt_key()`, `decrypt_key()`, key derivation from `ENCRYPTION_KEY` |
| **Structured Logging** | [`core/logger.py`](file:///mnt/data/siro/core/logger.py) | Standardized console and file logging configuration | `logging` | Lines 10–25: `get_logger()` |
| **Discovery Agent** | [`agents/discovery_agent.py`](file:///mnt/data/siro/agents/discovery_agent.py) | Stage 1 discovery coordinator; executes local-first search against `global_jobs` and external API harvesting | `harvesting.*`, `intelligence.*` | Lines 35–92: `run()`, `run_for_user()`, `save_leads()` |
| **Ranking Agent** | [`agents/ranking_agent.py`](file:///mnt/data/siro/agents/ranking_agent.py) | Stage 2 evaluation wrapper; drives multi-signal matching and assigns HOT/WARM/COLD/REJECT | `intelligence.scorer` | Lines 38–52: `run(profile, manual_query)` |
| **Resume Agent** | [`agents/resume_agent.py`](file:///mnt/data/siro/agents/resume_agent.py) | Stage 3 coordinator; in v3.0 queues leads for Telegram delivery and on-demand synthesis | `synthesis.resume_tailor` | Lines 15–30: delegates to `run_tailoring()` |
| **Application Agent** | [`agents/application_agent.py`](file:///mnt/data/siro/agents/application_agent.py) | Stage 5 delivery processor; processes pending delivery queue entries | `delivery.queue_manager` | Lines 15–35: `process_deliveries()` |
| **Analytics Agent** | [`agents/analytics_agent.py`](file:///mnt/data/siro/agents/analytics_agent.py) | Compiles pipeline summaries, execution metrics, and triggers daily digest | `delivery.daily_digest` | Lines 18–45: `record()`, `send_digest()` |
| **Direct ATS Ingestion** | [`harvesting/source_ats.py`](file:///mnt/data/siro/harvesting/source_ats.py) | Direct public JSON API connectors for Greenhouse, Lever, and Ashby across 36 tech companies | `httpx`, `currency_cleaner`, `text_cleaner` | Lines 21–160: `fetch_greenhouse_board()`, `fetch_lever_board()`, `fetch_ashby_board()` |
| **Remote Job Ingestion** | [`harvesting/source_remotive.py`](file:///mnt/data/siro/harvesting/source_remotive.py) | Public REST API adapter for Remotive.com | `httpx` | Lines 20–65: `fetch_remotive()` |
| **RemoteOK Ingestion** | [`harvesting/source_remoteok.py`](file:///mnt/data/siro/harvesting/source_remoteok.py) | Public REST API adapter for RemoteOK.com | `httpx` | Lines 20–60: `fetch_remoteok()` |
| **Arbeitnow Ingestion** | [`harvesting/source_arbeitnow.py`](file:///mnt/data/siro/harvesting/source_arbeitnow.py) | Public REST API adapter for Arbeitnow (EU/Remote) | `httpx` | Lines 20–65: `fetch_arbeitnow()` |
| **Himalayas Ingestion** | [`harvesting/source_himalayas.py`](file:///mnt/data/siro/harvesting/source_himalayas.py) | Public REST API adapter for Himalayas.app | `httpx` | Lines 18–55: `fetch_himalayas()` |
| **Hacker News Scraper** | [`harvesting/source_hn.py`](file:///mnt/data/siro/harvesting/source_hn.py) | Algolia & Firebase API scraper for monthly "Who is Hiring?" thread | `httpx`, `re` | Lines 25–95: `fetch_hn_hiring()` |
| **Secret Feed Ingestion** | [`harvesting/source_secret.py`](file:///mnt/data/siro/harvesting/source_secret.py) | XML/JSON feed parser for private job feeds | `httpx`, `bs4`, `re` | Lines 32–140: `fetch_secret()`, `_extract_apply_link()` |
| **Harvest Coordinator** | [`harvesting/harvest_orchestrator.py`](file:///mnt/data/siro/harvesting/harvest_orchestrator.py) | Parallel harvesting pipeline using `asyncio.gather()`, text cleaning, and lead formatting | `asyncio`, `uuid` | Lines 29–84: `run_harvest()`, lines 109–146: `build_lead()` |
| **Compensation Parser** | [`harvesting/currency_cleaner.py`](file:///mnt/data/siro/harvesting/currency_cleaner.py) | Multi-currency ($/€/£/₹/CAD/AUD) salary normalizer and regex extractor | `re` | Lines 50–133: `normalize_salary()`, lines 135–152: `extract_salary_from_text()` |
| **Job Description Sanitizer** | [`harvesting/text_cleaner.py`](file:///mnt/data/siro/harvesting/text_cleaner.py) | HTML stripper, legal boilerplate remover, and whitespace normalizer | `bs4`, `re` | Lines 15–70: `clean_job_description()` |
| **Scoring Engine** | [`intelligence/scorer.py`](file:///mnt/data/siro/intelligence/scorer.py) | Multi-signal job scoring combining semantic embeddings, lexical BM25/keyword overlap, and title match | `numpy`, `FastBM25`, `embedding_engine` | Lines 42–105: `_keyword_score()`, `_title_score()`, `_compute_final_score()`, `_assign_band()` |
| **Hybrid Retrieval & Reranker**| [`intelligence/hybrid_retriever.py`](file:///mnt/data/siro/intelligence/hybrid_retriever.py) | BM25Okapi lexical retrieval, Reciprocal Rank Fusion (RRF), compact representation builder, FlashRank reranking | `math`, `re`, `collections.Counter`, `flashrank` | Lines 25–85: `FastBM25`, lines 91–110: `reciprocal_rank_fusion()`, lines 265–314: `rerank_candidates()` |
| **Embedding Engine** | [`intelligence/embedding_engine.py`](file:///mnt/data/siro/intelligence/embedding_engine.py) | Local CPU-bound INT8 ONNX embedding model (BAAI/bge-small-en-v1.5) with LRU in-memory and Supabase caches | `fastembed`, `onnxruntime`, `numpy` | Lines 28–45: `_get_local_model()`, lines 77–100: `embed_text_async()`, lines 123–132: `cosine_similarity()` |
| **Keyword Pre-filter** | [`intelligence/keyword_filter.py`](file:///mnt/data/siro/intelligence/keyword_filter.py) | Lexical relevancy pre-filter rejecting non-technical or completely mismatched postings | `re` | Lines 15–65: `filter_jobs_by_relevance()` |
| **Deduplication Engine** | [`intelligence/deduplicator.py`](file:///mnt/data/siro/intelligence/deduplicator.py) | SHA-256 hash generator over company, title, and location; checks existing hashes in DB | `hashlib` | Lines 20–85: `make_dedup_hash()`, `filter_new_jobs()` |
| **LLM Waterfall** | [`synthesis/llm_waterfall.py`](file:///mnt/data/siro/synthesis/llm_waterfall.py) | Multi-provider fallback chain (Groq → Gemini → Hugging Face) with exponential backoff and schema validation | `httpx`, `asyncio` | Lines 23–128: `run_waterfall()` |
| **Gemini Adapter** | [`synthesis/llm_gemini.py`](file:///mnt/data/siro/synthesis/llm_gemini.py) | Direct REST client for Google Gemini 2.5 Flash via `generativelanguage.googleapis.com` | `httpx` | Lines 20–85: `call_gemini()` |
| **Groq Adapter** | [`synthesis/llm_groq.py`](file:///mnt/data/siro/synthesis/llm_groq.py) | Direct REST client for Groq API (openai/gpt-oss-120b or llama-3.1-8b-instant) | `httpx` | Lines 20–80: `call_groq()` |
| **Hugging Face Adapter** | [`synthesis/llm_hf.py`](file:///mnt/data/siro/synthesis/llm_hf.py) | Direct REST client for Hugging Face Inference API (Mistral-7B-Instruct-v0.3) | `httpx` | Lines 20–75: `call_hf()` |
| **Prompt Engineering** | [`synthesis/prompt_builder.py`](file:///mnt/data/siro/synthesis/prompt_builder.py) | Constructs structured JSON prompts enforcing strict RenderCV schema, cold email constraints, and ATS alignment | `json` | Lines 15–120: `SYSTEM_PROMPT`, `build_hot_prompt()`, `build_warm_prompt()` |
| **Output Validator** | [`synthesis/output_validator.py`](file:///mnt/data/siro/synthesis/output_validator.py) | Validates LLM responses, checks hallucinated skills, limits bullet points, and cleans RenderCV artifacts | `re` | Lines 16–85: `validate_output()`, lines 107–136: `_find_injected_skills()` |
| **PDF Generation Engine** | [`synthesis/pdf_factory.py`](file:///mnt/data/siro/synthesis/pdf_factory.py) | Subprocess execution of RenderCV v2.8 with Typst compiler; validates PDF and uploads to Supabase Storage | `rendercv`, `typst`, `subprocess`, `tempfile` | Lines 98–270: `_sanitize_cv_data()`, lines 273–322: `_adapt_and_render_sync()`, lines 373–431: `generate_and_upload_pdf()` |
| **PDF Quality Validator** | [`synthesis/pdf_validator.py`](file:///mnt/data/siro/synthesis/pdf_validator.py) | Validates PDF magic bytes (`%PDF`), size thresholds, and basic candidate name presence via pypdf | `pypdf` | Lines 15–50: `validate_pdf()` |
| **Company Research** | [`synthesis/context_researcher.py`](file:///mnt/data/siro/synthesis/context_researcher.py) | Searches DuckDuckGo for company tech stack, recent funding, and business goals | `ddgs` | Lines 15–65: `get_cached_company_context()` |
| **ATS Evaluator** | [`synthesis/evaluator.py`](file:///mnt/data/siro/synthesis/evaluator.py) | LLM-based evaluation generating an ATS match score (0-100), key gaps, and interview prep questions | `httpx` | Lines 15–80: `evaluate_lead()` |
| **Telegram Delivery Core** | [`interface/telegram_delivery.py`](file:///mnt/data/siro/interface/telegram_delivery.py) | Interactive Telegram bot, inline keyboard callbacks, triage deck pagination, and on-demand resume generation | `python-telegram-bot`, `fastapi` | Lines 64–100: `button_callback()`, lines 710–810: `_on_triage_tailor()` |
| **Email Dispatcher** | [`interface/email_dispatcher.py`](file:///mnt/data/siro/interface/email_dispatcher.py) | SMTP client for automated follow-up dispatch with resume attachments via Gmail SMTP | `smtplib`, `email` | Lines 15–70: `send_email()` |
| **Delivery Queue Manager** | [`delivery/queue_manager.py`](file:///mnt/data/siro/delivery/queue_manager.py) | Polls `delivery_queue` table, manages retry counters, and dispatches to Telegram | `core.database_manager` | Lines 15–75: `dispatch_queue()` |
| **Card Formatter** | [`delivery/card_formatter.py`](file:///mnt/data/siro/delivery/card_formatter.py) | Renders MarkdownV2 cards for Telegram with salary, band badges, tech stacks, and match rationale | `html`, `re` | Lines 15–90: `format_job_card()` |
| **Feedback Processor** | [`delivery/feedback_processor.py`](file:///mnt/data/siro/delivery/feedback_processor.py) | Records user actions (Apply, Review, Skip), updates skip reasons, and tunes scoring preferences | `core.database_manager` | Lines 15–65: `handle_apply()`, `handle_skip()` |
| **Telegram Reverse Proxy** | [`telegram-proxy-vercel/vercel.json`](file:///mnt/data/siro/telegram-proxy-vercel/vercel.json) | Vercel rewrite configuration proxying `api.telegram.org` to bypass platform egress filters | JSON rewrite | Lines 1–9: `rewrites: [{"source": "/(.*)", "destination": "https://api.telegram.org/$1"}]` |
| **Database Migration Script** | [`init_database_v5.sql`](file:///mnt/data/siro/init_database_v5.sql) | Master SQL migration: creates 8 tables, RLS policies, trigger `handle_new_user`, and RPC functions | PostgreSQL 15+ PL/pgSQL | Lines 22–109: table definitions, lines 115–151: RLS policies, lines 158–268: triggers & RPCs |
| **Frontend Framework** | [`frontend/package.json`](file:///mnt/data/siro/frontend/package.json) | TanStack Start (React 19, Nitro, Vite, Tailwind CSS v4, Lucide React, Radix UI) | Node.js, Vite 8, Nitro | Lines 1–97: dependencies & scripts (`dev`, `build`, `typecheck`, `lint`) |
| **Frontend Routing Tree** | [`frontend/src/routes/`](file:///mnt/data/siro/frontend/src/routes/) | File-based routes for landing, auth, dashboard, radar triage, job discovery, resume studio, research, applications, settings | `@tanstack/react-router` | 11 route files (`__root.tsx`, `index.tsx`, `auth.tsx`, `dashboard.tsx`, `radar.tsx`, etc.) |
| **Frontend API Client** | [`frontend/src/lib/api.ts`](file:///mnt/data/siro/frontend/src/lib/api.ts) | Fetch wrapper injecting Supabase JWT access tokens into request headers | Native Fetch API | Lines 9–33: `apiFetch()` with Bearer authorization |
| **Containerization** | [`Dockerfile`](file:///mnt/data/siro/Dockerfile) | Debian-based Python 3.12-slim multi-process container definition with system fonts and libraries | Docker | Lines 1–53: builds frontend via npm, installs Python dependencies, exposes port 7860 |
| **Process Entry Point** | [`entrypoint.sh`](file:///mnt/data/siro/entrypoint.sh) | Initializes `main_orchestrator.py` background process, `uvicorn dashboard:app` on 8080, and `node index.mjs` on 7860 | Bash | Lines 1–13: multi-process orchestration |
| **CI Workflow** | [`.github/workflows/ci.yml`](file:///mnt/data/siro/.github/workflows/ci.yml) | Continuous integration pipeline executing Ruff lint/format checks and frontend typecheck/lint | GitHub Actions | Lines 1–56: `python-quality` and `frontend-quality` jobs |

---

## 2. Directory Structure Tree

```
/mnt/data/siro
├── agents/                      # Multi-agent orchestrators
│   ├── analytics_agent.py
│   ├── application_agent.py
│   ├── ats_agent.py
│   ├── discovery_agent.py
│   ├── feedback_agent.py
│   ├── ranking_agent.py
│   ├── research_agent.py
│   └── resume_agent.py
├── core/                        # Shared runtime, db, logging, config
│   ├── config.py
│   ├── database_manager.py
│   ├── encryption.py
│   ├── logger.py
│   └── schema.sql               # Legacy v1 single-user schema
├── data/                        # Local file storage (resumes, debug dumps)
│   ├── debug_dumps/
│   ├── resumes/                 # Generated and uploaded master PDFs
│   ├── searches/
│   └── tailored_resumes/
├── delivery/                    # Queue management and card formatting
│   ├── card_formatter.py
│   ├── daily_digest.py
│   ├── feedback_processor.py
│   ├── queue_manager.py
│   └── whatsapp_fallback.py
├── docs/                        # Project technical documentation
│   ├── API.md
│   ├── ARCHITECTURE.md
│   ├── DEPLOYMENT.md
│   ├── DEVELOPMENT_GUIDE.md
│   ├── ENVIRONMENT.md
│   ├── PROJECT_STRUCTURE.md
│   └── SETUP.md
├── frontend/                    # TanStack Start / Nitro Web Application
│   ├── public/
│   ├── src/
│   │   ├── components/ui/       # Radix UI and Shadcn components
│   │   ├── hooks/               # useAuth, use-mobile
│   │   ├── lib/                 # api.ts, supabase.ts, utils.ts
│   │   ├── routes/              # TanStack file-based routes
│   │   ├── router.tsx
│   │   └── server.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── harvesting/                  # Stage 1 job ingestion adapters
│   ├── currency_cleaner.py
│   ├── harvest_orchestrator.py
│   ├── source_arbeitnow.py
│   ├── source_ats.py           # Greenhouse, Lever, Ashby
│   ├── source_himalayas.py
│   ├── source_hn.py            # Hacker News
│   ├── source_remoteok.py
│   ├── source_remotive.py
│   ├── source_secret.py
│   └── text_cleaner.py
├── intelligence/                # Stage 2 ranking and scoring
│   ├── deduplicator.py
│   ├── email_hunter.py
│   ├── embedding_engine.py      # FastEmbed INT8 ONNX
│   ├── hybrid_retriever.py      # FastBM25 + FlashRank reranker
│   ├── keyword_filter.py
│   └── scorer.py                # Multi-signal composite scoring
├── interface/                   # Delivery endpoints and bot integrations
│   ├── email_dispatcher.py
│   └── telegram_delivery.py     # Interactive Telegram bot and webhooks
├── synthesis/                   # Stage 3 LLM tailoring and PDF generation
│   ├── company_research.py
│   ├── context_researcher.py
│   ├── evaluator.py             # ATS scoring
│   ├── llm_gemini.py
│   ├── llm_groq.py
│   ├── llm_hf.py
│   ├── llm_waterfall.py
│   ├── output_validator.py
│   ├── pdf_factory.py           # RenderCV / Typst compilation
│   ├── pdf_validator.py
│   ├── prompt_builder.py
│   ├── resume_tailor_impl.py
│   └── resume_tailor.py
├── telegram-proxy-vercel/       # Vercel proxy for Telegram API
│   └── vercel.json
├── dashboard.py                 # FastAPI backend application
├── global_harvester.py          # Centralized job scraping background worker
├── main_orchestrator.py         # Autonomous agent execution scheduler
├── init_database_v5.sql         # Supabase PostgreSQL master schema
├── Dockerfile                   # Production container definition
├── entrypoint.sh                # Container multi-process launch script
└── pyproject.toml               # Python build and tool configuration
```
