# PhantmOS Feature Verification Matrix (v3.0.0)

**Audit Date:** October 18, 2026  
**Auditor:** Senior Software Architect  
**Classification Categories:**
- **Verified / Implemented**: Code exists, logic is complete, verified via static or runtime inspection.
- **Partially Verified / Defective**: Code exists, but has syntax/import/type issues or requires prerequisites.
- **Planned / Documented Only**: Claimed in documentation, README, or CHANGELOG but absent or contradictory in code.
- **Deprecated / Replaced**: Legacy code retained in the repository but superseded by newer versions.
- **Unverified / External**: Dependent on live external cloud infrastructure (e.g., Hugging Face Spaces production runtime).

---

## 1. Comprehensive Feature Breakdown

| Feature / Capability | Classification Status | Source Code Path | Architectural Analysis & Observed Evidence |
|---|---|---|---|
| **Multi-Tenant Data Isolation (RLS)** | **Verified / Implemented** | [`init_database_v5.sql`](file:///mnt/data/siro/init_database_v5.sql#L115-L151) | Row-Level Security enabled on all 8 tables; user isolation enforced via `auth.uid() = user_id`. |
| **Direct Public ATS Job Harvesting** | **Verified / Implemented** | [`harvesting/source_ats.py`](file:///mnt/data/siro/harvesting/source_ats.py#L21-L160) | Functional connectors for Greenhouse, Lever, and Ashby across 36 companies. Resolved prior git merge duplicates and missing logger import. Verified via `tests/test_harvesting_adapters.py`. |
| **Aggregator Harvesting (Remotive, RemoteOK, Arbeitnow, Himalayas)** | **Verified / Implemented** | [`harvesting/`](file:///mnt/data/siro/harvesting/) | Clean REST API adapters using `httpx` with timeout limits and text cleaning. |
| **Monthly Hacker News Ingestion** | **Verified / Implemented** | [`harvesting/source_hn.py`](file:///mnt/data/siro/harvesting/source_hn.py) | Algolia search API + Firebase item retrieval executed on the 1st of each month. |
| **Global Centralized Harvester** | **Verified / Implemented** | [`global_harvester.py`](file:///mnt/data/siro/global_harvester.py) | Pools search roles across user preferences, fetches once, and populates `global_jobs`. |
| **Multi-Currency Salary Normalizer** | **Verified / Implemented** | [`harvesting/currency_cleaner.py`](file:///mnt/data/siro/harvesting/currency_cleaner.py) | Normalizes $, €, £, ₹, CAD, AUD, hourly, and yearly rates into unified strings. Verified in unit tests. |
| **100% Local FastEmbed Vector Embeddings** | **Verified / Implemented** | [`intelligence/embedding_engine.py`](file:///mnt/data/siro/intelligence/embedding_engine.py) | Uses `fastembed` with INT8 quantized `BAAI/bge-small-en-v1.5` (384 dimensions, 33M parameters) bound to 2 CPU threads. $0 external API cost. |
| **BM25 Lexical Retrieval (`FastBM25`)** | **Verified / Implemented** | [`intelligence/hybrid_retriever.py`](file:///mnt/data/siro/intelligence/hybrid_retriever.py#L25-L85) | High-speed, zero-dependency BM25Okapi with Lucene IDF smoothing ($k_1=1.5, b=0.75$). Verified in unit tests. |
| **Reciprocal Rank Fusion (RRF)** | **Verified / Implemented** | [`intelligence/hybrid_retriever.py`](file:///mnt/data/siro/intelligence/hybrid_retriever.py#L91-L110) | Multi-list rank fusion formula $\sum \frac{1}{k + r_i}$ with $k=60$. Verified in unit tests. |
| **FlashRank Precision Cross-Encoder** | **Verified / Implemented** | [`intelligence/hybrid_retriever.py`](file:///mnt/data/siro/intelligence/hybrid_retriever.py#L218-L314) | Reranks top 40 candidates down to 20 using `ms-marco-TinyBERT-L-2-v2` (~4MB ONNX model). |
| **Multi-Signal Composite Scoring Formula** | **Verified / Implemented** | [`intelligence/scorer.py`](file:///mnt/data/siro/intelligence/scorer.py#L77-L88) | Formula: $0.45 \times \text{semantic} + 0.35 \times \text{keyword} + 0.20 \times \text{title}$. Note discrepancy with `core/config.py` which lists 50/30/20. Verified in unit tests. |
| **HOT / WARM / COLD Banding** | **Verified / Implemented** | [`intelligence/scorer.py`](file:///mnt/data/siro/intelligence/scorer.py#L90-L104) | Dynamic hot threshold based on `telegram_threshold + (100 - threshold)/2`. Verified in unit tests. |
| **On-Demand Resume Tailoring** | **Verified / Implemented** | [`synthesis/resume_tailor_impl.py`](file:///mnt/data/siro/synthesis/resume_tailor_impl.py) | Tailoring deferred until user triggers it via Telegram or Dashboard, avoiding batch LLM overhead. |
| **Multi-Provider LLM Waterfall** | **Verified / Implemented** | [`synthesis/llm_waterfall.py`](file:///mnt/data/siro/synthesis/llm_waterfall.py) | Groq (`openai/gpt-oss-120b`) → Gemini (`gemini-2.5-flash`) → Hugging Face (`Mistral-7B-Instruct-v0.3`). Direct HTTP via `httpx` without heavy vendor SDKs. |
| **Hallucination & Schema Validator** | **Verified / Implemented** | [`synthesis/output_validator.py`](file:///mnt/data/siro/synthesis/output_validator.py) | Checks injected skills against master resume, enforces 2–5 sentence cold emails, limits bullets to 6. Verified in unit tests. |
| **RenderCV + Typst PDF Compilation** | **Verified / Implemented** | [`synthesis/pdf_factory.py`](file:///mnt/data/siro/synthesis/pdf_factory.py) | Executes RenderCV 2.8 with Typst backend; concurrency serialized via `_RENDERCV_SEM` semaphore. |
| **WeasyPrint PDF Engine Upgrade** | **Planned / Documented Only** | [`CHANGELOG.md`](file:///mnt/data/siro/CHANGELOG.md#L18) | CHANGELOG claims: "Upgraded PDF generation engine to WeasyPrint (dropping rendercv overhead)". In reality, codebase still uses RenderCV + Typst. WeasyPrint dependencies are only installed in Dockerfile. |
| **Jina AI Embeddings** | **Deprecated / Replaced** | [`CHANGELOG.md`](file:///mnt/data/siro/CHANGELOG.md#L20) | Replaced in commit `fd151b1` by 100% local FastEmbed. Code no longer calls Jina APIs. |
| **BYOK Symmetric Key Encryption** | **Verified / Implemented** | [`core/encryption.py`](file:///mnt/data/siro/core/encryption.py) | Fernet encryption. Key derived via SHA-256 from `ENCRYPTION_KEY` (or `SUPABASE_KEY` fallback). Verified in unit tests. CHANGELOG erroneously claims AES-GCM; Fernet is AES-128-CBC + HMAC-SHA256. |
| **Credit System & Monthly Refill** | **Verified / Implemented** | [`core/database_manager.py`](file:///mnt/data/siro/core/database_manager.py#L63-L86) | 10 credits on signup (`handle_new_user`), atomic deduction via `decrement_user_credits` RPC, and 30 credit lazy monthly refill. |
| **Interactive Telegram Triage Deck** | **Verified / Implemented** | [`interface/telegram_delivery.py`](file:///mnt/data/siro/interface/telegram_delivery.py) | Implements single-bubble in-place editing, callbacks (`triage_nav_`, `triage_tailor_`, `triage_pdf_`, `triage_skip_`). Error handling safeguarded. |
| **Vercel Reverse Proxy for Telegram** | **Verified / Implemented** | [`telegram-proxy-vercel/vercel.json`](file:///mnt/data/siro/telegram-proxy-vercel/vercel.json) | URL rewrite rule forwarding all requests to `https://api.telegram.org/$1`. |
| **WhatsApp Fallback Delivery** | **Partially Verified / Defective** | [`delivery/whatsapp_fallback.py`](file:///mnt/data/siro/delivery/whatsapp_fallback.py) | Basic placeholder stub; lacks active provider credentials and webhook handling. |
| **TanStack Start Frontend Build** | **Verified / Implemented** | [`frontend/`](file:///mnt/data/siro/frontend/) | React 19 + Nitro + Vite 8. Builds successfully (`npm run build`) to `.output/public` and `.output/server`. |
| **Frontend TypeScript Typecheck** | **Verified / Implemented** | [`frontend/src/routes/auth.tsx`](file:///mnt/data/siro/frontend/src/routes/auth.tsx#L31) | `npm run typecheck` passes with 0 errors after adding `guestLogin` to `useAuth.tsx`. |
| **Frontend ESLint / Prettier** | **Verified / Implemented** | [`frontend/`](file:///mnt/data/siro/frontend/) | `npm run lint` passes with 0 errors (107 non-blocking accessibility/any warnings) after Prettier formatting. |
| **Automated Python Tests (`tests/`)** | **Verified / Implemented** | [`tests/`](file:///mnt/data/siro/tests/) | Created 26 unit tests across 8 test suites. 100% pass rate in 1.32s (`pytest`). |
| **Live Hugging Face Deployment** | **Unverified / External** | `hf_deployment_plan.md` | Deployment plan and configuration exist, but active cloud container availability cannot be independently verified from local filesystem without external live checks. |
| **Live Hugging Face Deployment** | **Unverified / External** | `hf_deployment_plan.md` | Deployment plan and configuration exist, but active cloud container availability cannot be independently verified from local filesystem without external live checks. |

---

## 2. Technical Contradictions & Discrepancies Summary

1. **Scoring Weights Contradiction**:
   - `core/config.py`: Semantic: 0.50, Keyword: 0.30, Title: 0.20
   - `intelligence/scorer.py`: Semantic: 0.45, Keyword: 0.35, Title: 0.20
2. **PDF Engine Contradiction**:
   - `CHANGELOG.md`: Claims upgrade to WeasyPrint.
   - Actual code (`synthesis/pdf_factory.py`): Uses `rendercv` CLI and `typst`.
3. **Encryption Algorithm Discrepancy**:
   - `CHANGELOG.md`: Claims "AES-GCM encrypted storage".
   - `core/encryption.py`: Uses `cryptography.fernet.Fernet` (AES-128-CBC with HMAC-SHA256 authentication).
4. **Embedding Infrastructure Discrepancy**:
   - `CHANGELOG.md`: Claims Jina AI API with CPU fallback.
   - Latest commit `fd151b1`: 100% local FastEmbed ONNX model (`BAAI/bge-small-en-v1.5`), zero Jina API dependencies.
