# 🌍 Environment Variables

PhantmOS relies on several environment variables for infrastructure and third-party integrations. All variables should be placed in a `.env` file at the root of the project.

## Core Infrastructure

| Variable | Required | Default / Example | Purpose |
|----------|:--------:|-------------------|---------|
| `SUPABASE_URL` | Yes | `https://xyz.supabase.co` | Endpoint for the Supabase project. |
| `SUPABASE_KEY` | Yes | `eyJhbGci...` | The anon/public key for Supabase client. |
| `SERVICE_ROLE_KEY` | Optional | `eyJhbGci...` | Supabase service key (bypasses RLS). Needed for admin/background tasks if anon key lacks permissions. |
| `DEFAULT_TIMEZONE` | No | `Asia/Kolkata` | Used by APScheduler for the orchestrator loops. |

## LLM Providers (BYOK allows overriding per-user)

| Variable | Required | Default / Example | Purpose |
|----------|:--------:|-------------------|---------|
| `GROQ_API_KEY` | No* | `gsk_...` | Extremely fast inference (Llama-3.1). Used for quick resume parsing and waterfall execution. |
| `GEMINI_API_KEY` | No* | `AIza...` | Google Gemini API key. Primary engine for deep JSON resume tailoring. |
| `HF_API_KEY` | No* | `hf_...` | Hugging Face API key. Used as a fallback LLM. |

*\*At least one LLM key is required globally OR must be provided by the user via the frontend BYOK interface.*

## Embeddings

| Variable | Required | Default / Example | Purpose |
|----------|:--------:|-------------------|---------|
| `JINA_API_KEY` | No | `jina_...` | API key for Jina AI embeddings (highly accurate semantic search). If missing, the system falls back to a local `sentence-transformers` CPU model. |

## Notifications & Delivery

| Variable | Required | Default / Example | Purpose |
|----------|:--------:|-------------------|---------|
| `TELEGRAM_BOT_TOKEN` | No | `1234:ABC...` | Token from BotFather for instant job card notifications. |
| `TELEGRAM_ALLOWED_CHAT_ID` | No | `12345678` | (Legacy/Admin) Limits global bot messages to a specific ID. |
| `GMAIL_USER` | No | `email@gmail.com` | SMTP username for sending cold emails and daily digests. |
| `GMAIL_APP_PASSWORD` | No | `abcd efgh ijkl mnop` | 16-character Google App Password (2FA required). |

---

## 🔒 Security Notes

- **Never commit the `.env` file.** Ensure it remains in `.gitignore`.
- Users' personal API keys (BYOK) submitted via the UI are **NOT** stored as plain text. They are symmetrically encrypted via `core/encryption.py` before being stored in Supabase.
- The `SERVICE_ROLE_KEY` provides god-mode access to the database. It should only be used securely within the backend environment and never leaked to the frontend.
