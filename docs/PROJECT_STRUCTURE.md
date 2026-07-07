# 📂 Project Structure

PhantmOS v3.0 enforces a strict modular design. Business logic is isolated from API handlers, and discrete AI operations are compartmentalized into "Agents" or "Synthesizers".

## Root Directory

- **`dashboard.py`**: The FastAPI application entry point. Handles all REST API routes, JWT authentication, and serves the static frontend build.
- **`main_orchestrator.py`**: The background pipeline scheduler. Coordinates the agents using `APScheduler`. Contains strictly coordination logic, no business logic.
- **`global_harvester.py`**: A standalone script/job that aggregates all unique user queries and deduplicates job fetching across the SaaS.
- **`Dockerfile`**: Defines the production Linux environment, notably installing system-level dependencies for WeasyPrint.

## `/agents` (The Brains)
Agents own discrete stages of the pipeline. They maintain no state themselves.
- `discovery_agent.py`: Interfaces with the harvester to find and store new leads.
- `ranking_agent.py`: Uses the intelligence modules to score jobs and assign bands (HOT/WARM/COLD).
- `resume_agent.py`: Coordinates the LLM synthesis to dynamically tailor resumes.
- `application_agent.py`: Manages outbound artifacts (PDF generation, Telegram cards, Email dispatch).
- `analytics_agent.py`: Compiles stats and sends daily digests.

## `/core` (Infrastructure)
- `database_manager.py`: The single source of truth for Supabase client initialization, RPC calls, and query logic.
- `config.py`: Centralized environment variables, scoring weights, and band thresholds.
- `encryption.py`: AES-GCM symmetric encryption for securely storing user BYOK API keys.
- `logger.py`: Centralized standard logging.

## `/frontend` (The Client)
The React SPA built with Vite and Tanstack Router.
- `src/components`: UI primitives (Radix) and composed dashboard widgets.
- `src/routes`: File-based routing (Tanstack Router).
- `src/lib`: Utility functions and Supabase JS client configuration.

## `/harvesting` (Data Acquisition)
- `harvest_orchestrator.py`: Concurrently manages execution of different source scrapers.
- `source_*.py`: Adapters for specific job boards (HackerNews, Remotive, Himalayas, etc.). Normalizes their varying JSON schemas into a standard internal format.

## `/intelligence` (Matching & Analysis)
- `embedding_engine.py`: Manages semantic vector embeddings (Jina API or local `sentence-transformers`).
- `scorer.py`: Calculates mathematical match scores using Semantic Similarity, Keyword TF-IDF, and Title matching.
- `deduplicator.py`: Uses cryptographic hashing to prevent inserting duplicate jobs into the database.

## `/synthesis` (Generative AI)
- `llm_waterfall.py`: A highly resilient chain that attempts to process LLM prompts through Gemini, falling back to Groq, then HF, mitigating rate limits.
- `resume_tailor.py`: Uses the LLMs to safely mutate the user's Resume JSON structure based on the job description.
- `pdf_factory.py`: Uses Jinja2 templating and WeasyPrint to convert JSON resumes into beautiful PDFs.
- `company_research.py`: Performs OSINT risk assessments and generates interview playbooks.

## `/interface` (Delivery)
- `telegram_delivery.py`: Handles Telegram bot webhook registration and sending interactive Job Cards.
- `email_dispatcher.py`: Connects to Gmail SMTP to fire off applications and cold follow-ups.

## `/migrations` (Database State)
Contains SQL files that define the Supabase schema, triggers, and Row Level Security policies. Must be executed in order when setting up a new environment.
