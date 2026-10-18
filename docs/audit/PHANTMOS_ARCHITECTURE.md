# PhantmOS System Architecture & Design Specification (v3.0.0)

**Audit Date:** October 18, 2026  
**Auditor:** Senior Software Architect  
**Scope:** Structural blueprints, process lifecycles, data models, and deployment topologies reconstructed from source code.

---

## 1. High-Level System Architecture

PhantmOS is an autonomous, multi-agent AI job discovery and resume synthesis platform. It operates as a dual-runtime container combining a Python 3.12 backend (FastAPI API server and autonomous APScheduler background daemons) with a Node.js v20 frontend (TanStack Start / Nitro server-side and client-side rendering).

```mermaid
graph TD
    subgraph ClientLayer["Client & Delivery Tier"]
        Browser["Modern Web Browser (TanStack Start React 19)"]
        TG["Telegram Client (Interactive Triage Mini App)"]
    end

    subgraph IngressLayer["Ingress & Routing (Hugging Face Spaces Port 7860)"]
        Nitro["Node.js Nitro Server (Port 7860)"]
        VercelProxy["Vercel Telegram Proxy (Reverse Proxy)"]
    end

    subgraph BackendLayer["Backend Application Tier (Internal Port 8080)"]
        FastAPI["FastAPI Dashboard Application (dashboard.py)"]
        Orchestrator["Autonomous Scheduler Daemon (main_orchestrator.py)"]
        HarvesterDaemon["Global Background Harvester (global_harvester.py)"]
    end

    subgraph AgentLayer["Discrete Stateless Multi-Agent Tier (agents/)"]
        DiscoveryAgent["DiscoveryAgent (Stage 1)"]
        RankingAgent["RankingAgent (Stage 2)"]
        ResumeAgent["ResumeAgent (Stage 3)"]
        AppAgent["ApplicationAgent (Stage 5)"]
        AnalyticsAgent["AnalyticsAgent (Digest/Metrics)"]
    end

    subgraph IntelligenceLayer["Local Embedding & Algorithmic Core"]
        FastEmbed["FastEmbed ONNX (bge-small-en-v1.5)"]
        FastBM25["FastBM25 Okapi Engine (Lexical)"]
        FlashRank["FlashRank Cross-Encoder (TinyBERT)"]
        RRF["Reciprocal Rank Fusion (RRF)"]
    end

    subgraph SynthesisLayer["LLM Waterfall & Document Synthesis"]
        Waterfall["LLM Waterfall (Groq -> Gemini -> HF)"]
        Validator["Output & Hallucination Validator"]
        RenderCV["RenderCV v2.8 Engine + Typst Compiler"]
    end

    subgraph PersistenceLayer["Cloud Persistence Tier (Supabase)"]
        Postgres[("PostgreSQL 15 Database (RLS Enforced)")]
        Storage[("Supabase Object Storage ('resumes' bucket)")]
        Auth["Supabase Auth (JWT Bearer Verification)"]
    end

    Browser -->|HTTP / SPA Navigation| Nitro
    Nitro -->|Proxy API Requests| FastAPI
    TG -->|Webhook / Callbacks| FastAPI
    TG -->|Outbound API via Proxy| VercelProxy
    FastAPI -->|JWT Authentication| Auth
    FastAPI -->|PostgreSQL Queries & RPCs| Postgres
    FastAPI -->|On-Demand PDF Generation| RenderCV
    RenderCV -->|Upload Generated PDF| Storage

    Orchestrator -->|Cron / Hourly Triggers| DiscoveryAgent
    Orchestrator -->|Evaluate Scored Leads| RankingAgent
    Orchestrator -->|Queue On-Demand Tailoring| ResumeAgent
    Orchestrator -->|Dispatch Telegram Queue| AppAgent

    DiscoveryAgent -->|Local-First & API Ingestion| HarvesterDaemon
    RankingAgent -->|Dense Embeddings| FastEmbed
    RankingAgent -->|Lexical Scoring| FastBM25
    RankingAgent -->|Precision Rerank| FlashRank
    RankingAgent -->|Fuse Rankings| RRF

    ResumeAgent -->|Prompt Generation| Waterfall
    Waterfall -->|Validate Structure| Validator
```

---

## 2. Backend Component Architecture

The backend implements a separation of concerns across configuration, persistence, agents, intelligence, synthesis, and delivery:

```mermaid
graph LR
    subgraph CoreModule["core/"]
        Config["config.py (Env & Constants)"]
        DBManager["database_manager.py (Supabase Client & RPCs)"]
        Encrypt["encryption.py (Fernet Symmetric BYOK)"]
        Logger["logger.py (Logging Setup)"]
    end

    subgraph IngestionModule["harvesting/"]
        ATSSource["source_ats.py (Greenhouse, Lever, Ashby)"]
        Aggregators["source_remotive / remoteok / himalayas / arbeitnow"]
        HNSource["source_hn.py (Hacker News Algolia)"]
        SecretSource["source_secret.py (Blogger Feed)"]
        Cleaner["text_cleaner.py & currency_cleaner.py"]
    end

    subgraph IntelligenceModule["intelligence/"]
        Scorer["scorer.py (Multi-Signal Composite Score)"]
        Retriever["hybrid_retriever.py (FastBM25 + FlashRank)"]
        EmbedEngine["embedding_engine.py (FastEmbed ONNX)"]
        Dedup["deduplicator.py (SHA-256 Hasher)"]
    end

    subgraph SynthesisModule["synthesis/"]
        LLMWaterfall["llm_waterfall.py (Fallback Chain)"]
        PDFFactory["pdf_factory.py (RenderCV Typst Subprocess)"]
        Evaluator["evaluator.py (ATS Score & Interview Prep)"]
        OutputVal["output_validator.py (Hallucination Defense)"]
    end

    subgraph DeliveryModule["delivery/ & interface/"]
        Telegram["interface/telegram_delivery.py (Bot & Triage)"]
        Email["interface/email_dispatcher.py (SMTP Dispatcher)"]
        Queue["delivery/queue_manager.py (FIFO Retry Dispatcher)"]
    end

    Config --> DBManager
    Config --> Scorer
    Config --> LLMWaterfall
    DBManager --> Scorer
    DBManager --> Queue
    Cleaner --> ATSSource
    Cleaner --> Aggregators
    EmbedEngine --> Scorer
    Retriever --> Scorer
    OutputVal --> LLMWaterfall
    LLMWaterfall --> PDFFactory
    Queue --> Telegram
```

---

## 3. Frontend-to-Backend Request Flow

The diagram below traces an authenticated user request from the browser through Nitro, FastAPI, and Supabase:

```mermaid
sequenceDiagram
    autonumber
    actor User as User Browser
    participant Nitro as Nitro Server (Port 7860)
    participant Auth as Supabase Auth
    participant API as FastAPI (dashboard.py : 8080)
    participant DB as PostgreSQL (Supabase)
    participant AI as FastEmbed / LLM Engine

    User->>Nitro: Navigate to /radar (Job Radar Triage)
    Nitro-->>User: Serve React Component Bundle + SSR Shell
    User->>Auth: supabase.auth.getSession()
    Auth-->>User: JWT Bearer Access Token
    User->>API: GET /api/leads?status=Found (Authorization: Bearer <token>)
    API->>API: get_current_user_id() (Check _TOKEN_CACHE / Verify JWT)
    API->>DB: SELECT * FROM user_job_pipelines JOIN global_jobs WHERE user_id = <uid>
    DB-->>API: Active Candidate Leads
    API-->>User: JSON Lead Cards with Match Breakdown
    User->>API: POST /api/leads/{job_id}/resume (Trigger On-Demand Tailoring)
    API->>DB: Check & Deduct User Credit (decrement_user_credits RPC)
    API->>AI: Execute LLM Waterfall (Groq -> Gemini -> HF)
    AI-->>API: Tailored JSON Resume + Cold Email
    API->>API: pdf_factory: Compile Typst via RenderCV Subprocess
    API->>DB: Upload PDF to Supabase Storage ('resumes' bucket)
    API->>DB: Update pipeline status="Tailored", resume_url=<public_url>
    API-->>User: 200 OK {"status": "ok", "resume_url": "<url>"}
```

---

## 4. Database Entity-Relationship Diagram (ERD)

Constructed directly from [`init_database_v5.sql`](file:///mnt/data/siro/init_database_v5.sql):

```mermaid
erDiagram
    auth_users ||--o| user_profiles : "extends (id)"
    user_profiles ||--o| user_resumes : "partitions (user_id)"
    auth_users ||--o{ user_job_pipelines : "owns"
    global_jobs ||--o{ user_job_pipelines : "references"
    user_job_pipelines ||--o{ delivery_queue : "triggers"
    user_job_pipelines ||--o{ user_feedback : "records"
    user_job_pipelines ||--o{ stage_logs : "logs"

    auth_users {
        uuid id PK
        string email
    }

    user_profiles {
        uuid id PK,FK "references auth.users(id) ON DELETE CASCADE"
        string email
        string full_name
        integer credits "DEFAULT 10"
        jsonb encrypted_keys "DEFAULT '{}'"
        jsonb preferences "DEFAULT '{}'"
        string telegram_chat_id
        boolean has_gemini_key
        boolean has_groq_key
        boolean has_hf_key
        timestamp created_at
    }

    user_resumes {
        uuid user_id PK,FK "references user_profiles(id) ON DELETE CASCADE"
        jsonb resume_data "NOT NULL DEFAULT '{}'"
        timestamp updated_at
    }

    global_jobs {
        string job_id PK
        string company "NOT NULL"
        string title "NOT NULL"
        text description
        string location
        string url
        string source
        string dedup_hash UK "UNIQUE"
        timestamp scraped_at
    }

    user_job_pipelines {
        uuid id PK "DEFAULT gen_random_uuid()"
        uuid user_id FK "references auth.users(id) ON DELETE CASCADE"
        string job_id FK "references global_jobs(job_id) ON DELETE CASCADE"
        string status "DEFAULT 'Found'"
        numeric match_score "DEFAULT 0"
        string score_band
        text notes
        string resume_url
        jsonb resume_tailored
        timestamp created_at
    }

    delivery_queue {
        serial id PK
        uuid user_id FK "references auth.users(id)"
        string job_id FK
        string status "DEFAULT 'pending'"
        integer attempts "DEFAULT 0"
        timestamp last_attempt
        timestamp created_at
    }

    user_feedback {
        serial id PK
        uuid user_id FK
        string job_id FK
        string action
        string skip_reason
        text feedback
        timestamp created_at
    }

    stage_logs {
        serial id PK
        uuid user_id FK
        string job_id FK
        string stage
        string status
        text message
        timestamp created_at
    }
```

---

## 5. Autonomous Multi-Agent Processing Pipeline

Execution order and stage transitions enforced by [`main_orchestrator.py`](file:///mnt/data/siro/main_orchestrator.py):

```mermaid
flowchart TD
    Start([Pipeline Invocation: Hourly Scheduler / Dashboard Trigger]) --> FetchProfiles[Fetch Active User Profiles]
    FetchProfiles --> SchedCheck{Check Frequency & Weekend Pause}
    SchedCheck -- Interval not elapsed --> SkipUser[Skip User]
    SchedCheck -- Proceed --> CreditCheck{Check Credits > 0 OR BYOK Key}
    CreditCheck -- Insufficient --> AlertUser[Send Telegram Credit Alert] --> SkipUser
    CreditCheck -- Valid --> DeductCredit[Atomic Credit Deduction RPC]

    DeductCredit --> Stage1[Stage 1: DiscoveryAgent.run_for_user]
    Stage1 --> LocalSearch{Query global_jobs for matches >= 5}
    LocalSearch -- Found >= 5 --> UseLocal[Return Local Global Jobs]
    LocalSearch -- Found < 5 --> ExternalHarvest[Execute Parallel API Harvest: Greenhouse, Lever, Ashby, Remotive, etc.]
    ExternalHarvest --> SaveLeads[Deduplicate via SHA-256 and Bulk Upsert to DB]
    UseLocal --> Stage2

    SaveLeads --> Stage2[Stage 2: RankingAgent.run]
    Stage2 --> EmbedMaster[Compute/Load User Master Resume Embedding]
    Stage2 --> BM25Index[Index Job Descriptions with FastBM25]
    Stage2 --> ParallelScore[Async Concurrent Scoring across Leads]
    ParallelScore --> DenseCosine[Compute Dense Cosine Distance 45%]
    ParallelScore --> LexicalScore[Compute BM25 & Keyword Overlap 35%]
    ParallelScore --> TitleScore[Compute Target Role Title Match 20%]
    DenseCosine & LexicalScore & TitleScore --> CalcScore[Composite Score = 0.45*S_sem + 0.35*S_kw + 0.20*S_title]
    CalcScore --> AssignBand{Score >= Hot Threshold?}
    AssignBand -- Yes --> SetHOT[Band = HOT, Status = Found]
    AssignBand -- No: Score >= Telegram Threshold --> SetWARM[Band = WARM, Status = Found]
    AssignBand -- No: Score >= 40.0 --> SetCOLD[Band = COLD, Status = Found]
    AssignBand -- No: Score < 40.0 --> SetREJECT[Band = REJECT, Status = Dismissed]

    SetHOT & SetWARM & SetCOLD --> Stage3[Stage 3: ResumeAgent.run]
    Stage3 --> QueueDelivery[Mark Lead & Queue in delivery_queue Table]
    
    QueueDelivery --> Stage5[Stage 5: ApplicationAgent.process_deliveries]
    Stage5 --> DispatchTG[Format MarkdownV2 Cards & Send to Telegram User]
    DispatchTG --> Complete([Pipeline Run Complete & Metrics Recorded])

    subgraph OnDemandTailoring["On-Demand Tailoring Flow (Triggered by User Action)"]
        UserAction[User clicks 'Create Resume' in Telegram or Dashboard] --> FetchLead[Retrieve Job & Resume JSON]
        FetchLead --> FetchContext[DuckDuckGo Company Research]
        FetchContext --> BuildPrompt[Construct Strict RenderCV Prompt]
        BuildPrompt --> ExecWaterfall[LLM Waterfall: Groq -> Gemini -> HF]
        ExecWaterfall --> ValidateOutput[OutputValidator: Defend Against Hallucinated Skills]
        ValidateOutput --> EvalATS[Evaluate ATS Score 0-100 & Gaps]
        ValidateOutput --> RenderPDF[RenderCV v2.8 Subprocess + Typst Compilation]
        RenderPDF --> ValidatePDF[Verify PDF Magic Bytes & Candidate Name]
        ValidatePDF --> UploadSupabase[Upload to Supabase Storage]
        UploadSupabase --> ReturnURL[Return Public Resume URL to User]
    end
```

---

## 6. Deployment Topology

The physical runtime topology based on `Dockerfile`, `entrypoint.sh`, and `hf_deployment_plan.md`:

```mermaid
graph TD
    subgraph Internet["Public Internet / End Users"]
        WebUser["Web Browser Users"]
        TGServer["Telegram Core Servers"]
    end

    subgraph HFSpace["Hugging Face Spaces Container (Linux x86_64 Debian Slim)"]
        subgraph ProcessManager["entrypoint.sh Process Supervisor"]
            NodeProc["Process 3: Node.js Server (node /app/frontend/.output/server/index.mjs)<br/>Listens on Public Port 7860"]
            UvicornProc["Process 2: Uvicorn ASGI Server (uvicorn dashboard:app)<br/>Listens on 127.0.0.1:8080"]
            PythonDaemon["Process 1: Background Orchestrator (python main_orchestrator.py)<br/>AsyncIO APScheduler Loop"]
        end
        LocalStorage["Local Filesystem: /app/data/resumes (Fallback store)"]
    end

    subgraph CloudVercel["Vercel Cloud"]
        VercelRewrite["telegram-proxy-vercel (Reverse Proxy)"]
    end

    subgraph CloudSupabase["Supabase Cloud Managed Infrastructure"]
        SupaDB["PostgreSQL 15 Database (Port 5432 / Transaction Pooler 6543)"]
        SupaAuth["Supabase GoTrue Auth Service"]
        SupaStorage["Supabase Storage Service ('resumes' S3-compatible bucket)"]
    end

    WebUser -->|HTTPS Port 7860| NodeProc
    TGServer -->|Webhook POST /telegram| NodeProc
    NodeProc -->|Internal HTTP Proxy /api/*| UvicornProc
    UvicornProc -->|Database SDK Queries| SupaDB
    UvicornProc -->|Token Verification| SupaAuth
    UvicornProc -->|Direct S3 Upload| SupaStorage
    UvicornProc -->|Fallback Disk Write| LocalStorage

    PythonDaemon -->|Database Polling & Updates| SupaDB
    PythonDaemon -->|Telegram Outbound via Proxy| VercelRewrite
    VercelRewrite -->|Forward Request| TGServer
```
