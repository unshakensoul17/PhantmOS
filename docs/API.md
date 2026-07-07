# 🔌 API Documentation

The FastAPI backend exposes several REST endpoints consumed by the React Command Center and internal workers.

All authenticated routes require a Supabase JWT in the Authorization header:
`Authorization: Bearer <token>`

---

## 📊 Analytics & Stats

### `GET /api/stats`
Retrieves pipeline statistics and score distributions for the authenticated user.
- **Auth Required:** Yes
- **Response Schema:**
```json
{
  "hot": 5,
  "warm": 12,
  "cold": 20,
  "discovered": 37,
  "tailored": 17,
  "applied": 3,
  "dismissed": 5,
  "total": 45,
  "interviews": 0,
  "sources": { "himalayas": 10, "remotive": 27 },
  "scores": [0, 0, ...],
  "approved": 2,
  "credits": 870,
  "max_credits": 1000
}
```

---

## 💼 Job Leads

### `GET /api/leads`
Fetch paginated job leads.
- **Auth Required:** Yes
- **Query Params:**
  - `band` (optional): `HOT`, `WARM`, `COLD`
  - `status` (optional): `Found`, `Tailored`, `Applied`, etc.
  - `limit` (default 50)
  - `cursor` (optional, ISO timestamp for pagination)
- **Returns:** List of flattened job leads merging `global_jobs` and `user_job_pipelines`.

### `POST /api/leads/{job_id}/status`
Update the status of a specific job lead.
- **Auth Required:** Yes
- **Body:** `{ "status": "Applied" }`
- **Valid Statuses:** `Found`, `Tailored`, `Approved`, `Applied`, `Dismissed`, `Interviewing`, `Offer`, `Rejected`

---

## 🚀 Orchestration

### `POST /api/harvest`
Triggers an asynchronous, isolated pipeline run for the user.
- **Auth Required:** Yes
- **Body:** `{ "query": "Optional specific role to search" }`
- **Returns:** `{ "status": "ok", "message": "PhantmOS v3.0 pipeline triggered." }`

### `POST /api/digest`
Manually triggers the daily digest email/Telegram notification.
- **Auth Required:** Yes

---

## 👤 User Profile

### `GET /api/profile`
Fetch the user's master resume data.
- **Auth Required:** Yes

### `POST /api/profile`
Update the user's master resume JSON data.
- **Auth Required:** Yes
- **Body:** `{ "resume_data": { ... } }`

---

## 🔑 Security & Settings

### `GET /api/byok`
Fetch masked Bring-Your-Own-Key credentials.
- **Returns:** Masked keys (e.g., `{"GEMINI_API_KEY": "***", ...}`)

### `POST /api/byok`
Securely encrypt and update the user's custom BYOK keys.
- **Body:** `{ "GEMINI_API_KEY": "...", "GROQ_API_KEY": "...", "HF_API_KEY": "..." }`

### `GET /api/settings`
Retrieve user preferences (LLM choices, scoring thresholds).

### `POST /api/settings`
Update user preferences.

---

## 📧 Automated Outreach

### `POST /api/applications/phantm-writer`
Uses an LLM to draft a highly personalized, professional follow-up email for a specific job application.
- **Auth Required:** Yes
- **Body:**
```json
{
  "job_id": "job_123",
  "company": "OpenAI",
  "role": "Research Scientist"
}
```

### `POST /api/applications/send-email`
Dispatches an email via the user's configured Gmail SMTP.
- **Auth Required:** Yes
- **Body:**
```json
{
  "job_id": "job_123",
  "target_email": "hr@openai.com",
  "email_text": "Subject: Following up...\n\nHello..."
}
```

---

## 🛠 Admin Routes (Requires Special Config)

- `POST /api/admin/harvest`: Triggers the global pipeline for all users.
- `GET /api/admin/logs`: Fetches recent system-wide stage logs.
- `POST /api/profile/upload`: Parses a master PDF resume using Groq LLM to convert to JSON.
