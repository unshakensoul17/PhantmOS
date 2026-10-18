# PhantmOS Verified Fact Sheet for Academic Submission

**Project Title:** PhantmOS: Autonomous Multi-Agent AI Job Discovery and Resume Synthesis Platform  
**Repository Version:** 3.0.0  
**Audit Completion Date:** October 18, 2026  
**Institution:** Government Holkar Science College, Indore (M.P.), India  
**Key Contributors (Verified via Git Shortlog):**
- **Akash Yaduwanshi** (`unshakensoul17` / `UnshakenSoul17`) — Core Architecture, Pipeline, Embedding & Telegram Integration
- **Ali** (`ali071205`) — Frontend Engineering & Route Implementation
- **Uwesh Khan** (`uweshkhan0000`) — Component Design & UI Styling

---

## 1. Verified Architecture & Technology Facts

| Category | Verified Fact from Codebase |
|---|---|
| **Primary Architecture** | Monolithic container housing a dual-runtime system: Python 3.12 (FastAPI API server + autonomous APScheduler worker) and Node.js v20 (TanStack Start / Nitro SSR & SPA engine). |
| **Backend Framework** | FastAPI 0.141+ with Uvicorn ASGI server running on internal port `8080`. |
| **Frontend Framework** | TanStack Start (React 19, TypeScript 5.8, Vite 8, Nitro, Tailwind CSS v4, Radix UI primitives) running on external port `7860`. |
| **Database & Auth** | Supabase managed PostgreSQL 15+ with Row-Level Security (RLS) enabled across all tables and built-in Supabase Auth JWT verification. |
| **Local Embedding Engine** | FastEmbed 0.8.1 running INT8 ONNX quantized `BAAI/bge-small-en-v1.5` (384-dimensional dense vectors, 33 million parameters) bound to 2 CPU threads. $0 external API operational cost. |
| **Lexical Engine** | Pure Python implementation of BM25Okapi (`FastBM25`) with $k_1=1.5, b=0.75$, and Lucene-style IDF smoothing. |
| **Precision Reranker** | FlashRank 0.2.0 running `ms-marco-TinyBERT-L-2-v2` (~4MB model footprint, <20MB RAM usage). |
| **LLM Orchestration** | Direct HTTP waterfall via `httpx` (no vendor SDK bloat): Groq (`openai/gpt-oss-120b`) → Google Gemini (`gemini-2.5-flash`) → Hugging Face (`Mistral-7B-Instruct-v0.3`). |
| **PDF Generation Engine** | RenderCV v2.8 invoking Typst compiler in isolated temporary subdirectories, managed with an asynchronous concurrency semaphore (`_RENDERCV_SEM`). |
| **Job Sources (Harvesting)** | Direct public JSON APIs for Greenhouse, Lever, and Ashby (targeting 36 tier-1 AI & tech companies) + Remotive, RemoteOK, Arbeitnow, Himalayas, Blogger Secret Feed, and monthly Hacker News hiring threads. |
| **User Notifications** | Telegram Bot API with interactive triage deck (in-place card editing, Web App digests, inline callbacks) with reverse proxying via Vercel for egress firewall bypass. |

---

## 2. Mathematical Formulas & Tuning Constants (Empirically Verified)

### 2.1 Multi-Signal Composite Matching Score
In [`intelligence/scorer.py`](file:///mnt/data/siro/intelligence/scorer.py#L86-L87):
$$\text{Score} = \text{round}\Big(\big(0.45 \times S_{\text{semantic}} + 0.35 \times S_{\text{keyword}} + 0.20 \times S_{\text{title}}\big) \times 100,\; 2\Big)$$

- **$S_{\text{semantic}}$**: Cosine similarity between candidate master resume vector and job description vector:
  $$\cos(\mathbf{u}, \mathbf{v}) = \frac{\mathbf{u} \cdot \mathbf{v}}{\|\mathbf{u}\|_2 \|\mathbf{v}\|_2}$$
- **$S_{\text{keyword}}$**: Blend of exact skill overlap and normalized BM25 score:
  $$S_{\text{keyword}} = 0.6 \times S_{\text{direct}} + 0.4 \times \min\left(\frac{S_{\text{BM25}}}{10.0}, 1.0\right)$$
- **$S_{\text{title}}$**: Exact match with target job titles = $1.0$; non-match default = $0.3$.

### 2.2 Dynamic Classification Band Thresholds
In [`intelligence/scorer.py`](file:///mnt/data/siro/intelligence/scorer.py#L90-L104):
- $\text{Threshold}_{\text{telegram}}$: User-configured cutoff (default: $60.0$).
- $\text{Threshold}_{\text{HOT}} = \text{Threshold}_{\text{telegram}} + \frac{100.0 - \text{Threshold}_{\text{telegram}}}{2.0}$ (default: $80.0$).
- Classification Rules:
  - $\text{Score} \ge \text{Threshold}_{\text{HOT}} \implies \mathbf{HOT}$ (Priority notification + full tailoring)
  - $\text{Threshold}_{\text{telegram}} \le \text{Score} < \text{Threshold}_{\text{HOT}} \implies \mathbf{WARM}$ (Digest notification + light tailoring)
  - $40.0 \le \text{Score} < \text{Threshold}_{\text{telegram}} \implies \mathbf{COLD}$ (Stored in pipeline pool)
  - $\text{Score} < 40.0 \implies \mathbf{REJECT}$ (Status set to `Dismissed`)

### 2.3 Reciprocal Rank Fusion (RRF)
In [`intelligence/hybrid_retriever.py`](file:///mnt/data/siro/intelligence/hybrid_retriever.py#L91-L110):
$$\text{RRF}(d) = \sum_{m \in M} \frac{1}{60 + r_m(d)}$$
Where $r_m(d)$ is the 1-based ordinal rank of document $d$ in ranking system $m$.

---

## 3. Verified Database Schema Architecture

The PostgreSQL schema defined in [`init_database_v5.sql`](file:///mnt/data/siro/init_database_v5.sql) consists of 8 tables with foreign keys and cascade rules:

1. `user_profiles`: Extends `auth.users(id)`; stores full name, credit balance (default: 10), Telegram chat ID, preferences JSONB, encrypted BYOK keys JSONB.
2. `user_resumes`: Partitioned store linked to `user_profiles(id)`; stores structured JSON resume schema.
3. `global_jobs`: Global deduplicated job pool (`job_id`, `company`, `title`, `description`, `location`, `url`, `source`, `dedup_hash` UNIQUE).
4. `user_job_pipelines`: Multi-tenant bridge table linking `auth.users(id)` and `global_jobs(job_id)` with `UNIQUE(user_id, job_id)`. Tracks `status` (`Found`, `Tailored`, `Applied`, `Dismissed`), `match_score`, `score_band`, `notes`.
5. `delivery_queue`: FIFO queue for outgoing notifications; foreign key `(user_id, job_id)` referencing `user_job_pipelines`.
6. `user_feedback`: User interaction audit trail (`action`, `skip_reason`, `feedback`).
7. `stage_logs`: Granular pipeline stage telemetry (`stage`, `status`, `message`).
8. `auth_debug_logs`: Exception capture for authentication triggers.
