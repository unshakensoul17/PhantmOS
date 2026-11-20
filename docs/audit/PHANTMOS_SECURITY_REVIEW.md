# PhantmOS Security and Architectural Resilience Review

**Audit Date:** October 18, 2026  
**Auditor:** Senior Software Architect & Security Auditor  
**Scope:** Source code, configuration manifests, database policies, API endpoints, encryption mechanisms, and container topology.  
**Compliance Requirement:** Zero secrets, raw keys, tokens, or credential strings are printed in this report.

---

## 1. Executive Security Summary

The PhantmOS codebase demonstrates strong foundational multi-tenant isolation through Supabase Row-Level Security (RLS) policies and encrypted user credential storage (BYOK). However, the audit identified five high-priority security concerns and architectural attack surfaces that require remediation before enterprise or multi-user production deployment:

1. **Weak Key Derivation Fallback in Symmetric Encryption**: Credential encryption falls back to `SUPABASE_KEY` if `ENCRYPTION_KEY` is undefined.
2. **Hardcoded Fallback Secret in Telegram Authentication**: HMAC validation uses a hardcoded string `b"phantmos_secret"` if `TELEGRAM_BOT_TOKEN` is unset.
3. **Unauthenticated Public Resume Exposure**: The FastAPI app mounts `/resumes` serving all PDFs in `data/resumes/` without authorization checks.
4. **Shared Disk State Overwrites in Multi-Tenant Settings**: Endpoint `POST /api/settings` writes the caller's preferences to a single shared file `settings.json` on disk.
5. **Git-Tracked Environment Configuration**: A `.env` file containing local environment variable assignments is present in the repository root.

---

## 2. Vulnerability Findings and Remediation

### Finding SEC-01: Insecure Symmetric Key Derivation Fallback
- **Severity:** High
- **Category:** Cryptographic Key Management
- **Affected File:** [`core/encryption.py`](file:///mnt/data/siro/core/encryption.py#L15-L18)
- **Vulnerability Description:**
  The Fernet key is derived via:
  ```python
  _raw_key = os.getenv("ENCRYPTION_KEY", SUPABASE_KEY)
  _hasher = hashlib.sha256(_raw_key.encode()).digest()
  _fernet_key = base64.urlsafe_b64encode(_hasher)
  ```
  If `ENCRYPTION_KEY` is omitted, the application uses `SUPABASE_KEY` (which is often the public anon key or shared among developers). Anyone with read access to the project's public Supabase configuration can derive `_fernet_key` and decrypt all user LLM keys stored in `user_profiles.encrypted_keys`.
- **Recommended Remediation:**
  Enforce mandatory provision of `ENCRYPTION_KEY` on startup. If missing, raise an immediate fatal initialization error rather than falling back to `SUPABASE_KEY`:
  ```python
  _raw_key = os.getenv("ENCRYPTION_KEY")
  if not _raw_key:
      raise RuntimeError("CRITICAL: ENCRYPTION_KEY environment variable is mandatory.")
  ```

---

### Finding SEC-02: Hardcoded Secret Fallback for Telegram HMAC Validation
- **Severity:** High
- **Category:** Authentication Bypass / Insecure Defaults
- **Affected File:** [`dashboard.py`](file:///mnt/data/siro/dashboard.py#L124)
- **Vulnerability Description:**
  In `get_current_user_id()`, when validating Telegram Mini App session tokens (`tg_sess_`), the secret is defined as:
  ```python
  secret = TELEGRAM_BOT_TOKEN.encode() if TELEGRAM_BOT_TOKEN else b"phantmos_secret"
  ```
  If `TELEGRAM_BOT_TOKEN` is unset or blank in a staging/testing deployment, an attacker can forge valid authentication tokens by signing arbitrary `user_id` payloads with `b"phantmos_secret"`.
- **Recommended Remediation:**
  Disallow fallback to hardcoded byte strings. Reject the request immediately if `TELEGRAM_BOT_TOKEN` is unconfigured:
  ```python
  if not TELEGRAM_BOT_TOKEN:
      raise HTTPException(status_code=500, detail="Telegram auth misconfigured on server.")
  secret = TELEGRAM_BOT_TOKEN.encode()
  ```

---

### Finding SEC-03: Unauthenticated Static File Exposure of Resumes
- **Severity:** Medium / Privacy Risk
- **Category:** Broken Object-Level Authorization (BOLA)
- **Affected File:** [`dashboard.py`](file:///mnt/data/siro/dashboard.py#L152-L155)
- **Vulnerability Description:**
  FastAPI mounts the local resume storage directory directly:
  ```python
  RESUMES_DIR = os.path.join(os.getcwd(), "data", "resumes")
  os.makedirs(RESUMES_DIR, exist_ok=True)
  app.mount("/resumes", StaticFiles(directory=RESUMES_DIR), name="resumes")
  ```
  Any file generated or uploaded to `data/resumes/` (e.g., `master_<uuid>.pdf` or `<job_id>_<timestamp>.pdf`) is publicly accessible via `GET /resumes/<filename>`. While file names include UUIDs, they are not protected by authentication middleware or user-ownership checks.
- **Recommended Remediation:**
  Remove `StaticFiles` mounting for sensitive user documents. Serve resumes through an authenticated endpoint that verifies the requesting user owns the resume before streaming bytes, or rely exclusively on Supabase Storage with authenticated private URLs.

---

### Finding SEC-04: Cross-Tenant File Overwrite in `POST /api/settings`
- **Severity:** Medium / Tenant Data Integrity
- **Category:** Concurrency / State Isolation
- **Affected File:** [`dashboard.py`](file:///mnt/data/siro/dashboard.py#L1066-L1070)
- **Vulnerability Description:**
  When a user saves settings via `POST /api/settings`, the endpoint correctly updates `user_profiles.preferences` in Supabase, but then executes:
  ```python
  try:
      with open("settings.json", "w") as f:
          json.dump(data, f, indent=2)
  except Exception as e:
      logger.error(f"Warning: failed to sync legacy settings.json: {e}")
  ```
  In a multi-user environment, User B saving their preferences overwrites `settings.json` with their data. If any legacy background task reads `settings.json` (such as `intelligence/scorer.py:212`), it will read the wrong user's scoring thresholds and blacklist rules.
- **Recommended Remediation:**
  Completely eliminate writes to `settings.json`. All modules must read exclusively from the authenticated user's profile row in Supabase.

---

### Finding SEC-05: Presence of Local `.env` File in Repository Working Tree
- **Severity:** Medium / Secret Hygiene
- **Category:** Secret Management
- **Affected File:** `.env` (Working Directory Root)
- **Vulnerability Description:**
  A `.env` file containing local configuration is present on disk. Although `.env` is listed in `.gitignore`, local secret files pose a security risk if accidentally staged, committed, or included in unvetted container builds.
- **Recommended Remediation:**
  Confirm that `.gitignore` strictly excludes `.env` across all branch merges. Utilize encrypted cloud secret managers (e.g., Hugging Face Space Secrets, Infisical, or Doppler) rather than persistent on-disk `.env` files in staging and production environments.

---

## 3. Positive Security Controls Verified in Codebase

1. **Row-Level Security (RLS)**:
   - All 8 tables (`user_profiles`, `user_resumes`, `global_jobs`, `user_job_pipelines`, `delivery_queue`, `user_feedback`, `stage_logs`, `auth_debug_logs`) have RLS explicitly enabled via `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`.
   - Access to user data is strictly bound to `auth.uid() = user_id`.
2. **Credential Masking in API Responses**:
   - `GET /api/byok` and `GET /api/settings` return `***` instead of plaintext keys, preventing client-side credential leakage.
3. **Subprocess Decoupling in PDF Generation**:
   - RenderCV is invoked via `subprocess.run()` inside isolated temporary directories (`tempfile.TemporaryDirectory()`), preventing persistent temporary file accumulation or shell injection (arguments passed as list, `shell=False`).
4. **Rate-Limiting & Telegram Proxying**:
   - Outbound Telegram API requests are throttled to a minimum interval of 1.5 seconds (`_MIN_SEND_INTERVAL`) with `_SEND_LOCK` mutex control, preventing abuse and API bans.
