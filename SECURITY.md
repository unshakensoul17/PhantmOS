# 🔒 Security Posture & Considerations

PhantmOS v3.0 is designed as a Multi-Tenant SaaS. Protecting user data, resumes, and API keys is the highest priority.

## 1. Authentication & Authorization

All user authentication is managed by **Supabase Auth**.
- The backend relies exclusively on JWT validation via the `get_current_user_id()` dependency in `dashboard.py`.
- **Never** pass user IDs as raw parameters in API requests to infer identity. The identity is always extracted from the JWT token.
- JWT tokens are cached in-memory for 5 minutes (`_TOKEN_CACHE`) to reduce latency to the Supabase Auth server, while maintaining a short expiration window.

## 2. Row Level Security (RLS)

PostgreSQL Row Level Security is enforced on all sensitive tables:
- `user_profiles`: Users can only `SELECT` and `UPDATE` their own row.
- `user_job_pipelines`: Users can only access leads where `user_id = auth.uid()`.
- `global_jobs`: This table is **Read-Only** for authenticated users (`SELECT` allowed for deduplication and global harvesting). `INSERT` operations are restricted.

*See `/migrations/schema_v4_global_jobs.sql` and `schema_v5_auth_trigger.sql` for the exact policy definitions.*

## 3. Secret Management & BYOK (Bring Your Own Key)

The system allows users to provide their own LLM API keys (Groq, Gemini, Hugging Face).
- **Encryption at Rest:** Keys are never stored as plain text. The `POST /api/byok` route encrypts them using AES-GCM (via `core/encryption.py`) before writing to the database.
- **Decryption:** Keys are decrypted on-the-fly inside the orchestrator using a master server secret (`SUPABASE_KEY` or a dedicated symmetric key).
- **Masking:** The `GET /api/byok` route only returns `"***"` to the frontend to confirm existence, preventing client-side interception.

## 4. Input Validation & LLM Injection

- All user-supplied configuration data (Settings, Resumes) is sanitized implicitly by Pydantic models in the FastAPI routes.
- **Prompt Injection:** When passing job descriptions (which are arbitrary web text) to LLMs via `synthesis/resume_tailor.py`, the prompts strictly delineate system instructions from user inputs using structural barriers to prevent malicious job descriptions from altering the agent's behavior.

## 5. Rate Limiting & DoS Protection

- **Payload Constraints:** PDF uploads are truncated (e.g., limited to `<10,000` characters in `dashboard.py`) to prevent payload exhaustion on LLM providers (specifically Groq).
- **Credit System:** A built-in credit ledger limits pipeline runs per user. The `decrement_user_credits` RPC ensures atomic deductions, preventing race conditions where users spam the harvest API to bypass limits.

## 6. Dependency Security

- The Dockerfile uses `python:3.12-slim` to minimize the attack surface.
- Dependencies in `requirements.txt` should be audited regularly using standard SCA tools.
- `package-lock.json` in the frontend should be audited via `npm audit`.
