# 🔄 Changelog

All notable changes to this project will be documented in this file.

## [3.0.0] - Multi-Agent SaaS Architecture
### Added
- **Multi-Tenant SaaS Foundation**: Full integration with Supabase Auth and Row Level Security (RLS) to enforce data isolation across users.
- **Supabase Triggers**: Added `schema_v5_auth_trigger.sql` to automatically provision `user_profiles` entries and default credits upon user signup.
- **Global Harvester (`global_harvester.py`)**: Introduced a centralized background worker that pools user queries, fetches jobs globally, and deduplicates them into a unified `global_jobs` table to drastically reduce API load.
- **Multi-Agent Orchestration**: Refactored core logic into discrete, stateless agents (`DiscoveryAgent`, `RankingAgent`, `ResumeAgent`, `ApplicationAgent`, `AnalyticsAgent`).
- **Bring Your Own Key (BYOK)**: Added AES-GCM encrypted storage for user-provided LLM API keys (Groq, Gemini, HF).
- **Tanstack React Router Frontend**: Completely redesigned the dashboard using React, Vite, and Tailwind v4.
- **Credit System**: Implemented atomic PostgreSQL RPCs (`decrement_user_credits`) for secure usage tracking.

### Changed
- Replaced legacy `job_leads` table with a normalized schema (`global_jobs` + `user_job_pipelines`) via `schema_v4_global_jobs.sql`.
- Updated `delivery_queue`, `user_feedback`, and `stage_logs` tables to reference the new multi-tenant pipeline table.
- Upgraded PDF generation engine to WeasyPrint (dropping `rendercv` overhead).
- Replaced Google Search APIs with free scrapers (Remotive, Himalayas, HN) to reduce operational costs.
- Shifted all local embeddings to Jina AI API with a `sentence-transformers` CPU fallback.

### Removed
- Legacy single-user `settings.json` (migrated to Supabase `user_profiles.preferences`).
- Legacy YAML configurations (`John_Doe_CV.yaml`).

## [2.0.0] - Pipeline Refactor & Telegram Integration
*(Historical)*
- Introduced the core PhantmOS pipeline phases (Scrape, Score, Tailor, Apply).
- Added Telegram bot integration for real-time Job Cards.
- Implemented Groq + Gemini LLM Waterfall.

## [1.0.0] - Initial Release
*(Historical)*
- Basic local scraping and automated email dispatch script.
