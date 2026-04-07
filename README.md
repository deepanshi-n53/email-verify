# MailProbe — Email Verification SaaS

> Production-ready email verification tool. 7-layer verification engine, bulk CSV processing,
> confidence scoring, REST API. Deploys to Vercel in ~3 minutes.

---

## Project Structure

```
mailprobe/
├── vercel.json              ← Monorepo config: routes /api/* to functions, /* to React
├── package.json             ← Root scripts
├── .env.example             ← All environment variables documented
│
├── api/                     ← Vercel Serverless Functions (Node.js 20)
│   ├── verify.js            ← GET/POST /api/verify
│   ├── bulk-verify.js       ← POST /api/bulk-verify
│   ├── health.js            ← GET /api/health
│   └── _lib/
│       ├── verifier.js      ← 7-layer verification engine
│       ├── rateLimit.js     ← Sliding window rate limiter
│       ├── cors.js          ← CORS middleware
│       └── SMTP_WORKER.md   ← Railway SMTP worker for real RCPT probing
│
└── frontend/                ← React 18 + Vite
    ├── index.html
    ├── vite.config.js
    ├── package.json
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── styles.css
        ├── lib/
        │   ├── api.js       ← All API calls
        │   └── export.js    ← CSV/XLSX export + file parsing
        ├── components/
        │   ├── Nav.jsx
        │   ├── StatsBar.jsx
        │   ├── StatusBadge.jsx
        │   ├── CheckGrid.jsx
        │   ├── VerificationSteps.jsx
        │   ├── ResultCard.jsx
        │   └── BulkResultsTable.jsx
        └── pages/
            ├── SingleVerify.jsx
            ├── BulkVerify.jsx
            └── ApiDocs.jsx
```

---

## ⚡ Deploy to Vercel (3 minutes)

### Option A — Vercel CLI (recommended)

```bash
# 1. Clone / download this project
cd mailprobe

# 2. Install Vercel CLI
npm install -g vercel

# 3. Install frontend deps
cd frontend && npm install && cd ..

# 4. Deploy (first time — follow prompts)
vercel

# 5. Set environment variables (optional but recommended)
vercel env add RATE_LIMIT_FREE       # e.g. 100
vercel env add FREE_BULK_LIMIT       # e.g. 50
vercel env add ALLOWED_ORIGINS       # e.g. *

# 6. Deploy to production
vercel --prod
```

**That's it.** Vercel auto-detects `vercel.json`, builds the frontend, and deploys
the API functions. You get:
- `https://your-project.vercel.app/`            → React app
- `https://your-project.vercel.app/api/verify`  → API endpoint

---

### Option B — GitHub + Vercel Dashboard (zero CLI)

1. Push this repo to GitHub
2. Go to [vercel.com/new](https://vercel.com/new) → Import your repo
3. Vercel auto-detects the config — click **Deploy**
4. Add env vars under **Settings → Environment Variables**

---

## 🖥 Local Development

```bash
# Install Vercel CLI + deps
npm install -g vercel
cd frontend && npm install && cd ..

# Copy env file
cp .env.example .env.local

# Start local dev server (runs API functions + React with hot reload)
vercel dev
# → Frontend: http://localhost:3000
# → API:      http://localhost:3000/api/*
```

`vercel dev` starts a local server that emulates the production environment exactly —
serverless functions run locally with the same routing as production.

---

## 🔧 Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `""` | API base URL. Leave empty on Vercel (uses same-origin `/api/*`) |
| `RATE_LIMIT_FREE` | `100` | Max single verifications per day per IP |
| `FREE_BULK_LIMIT` | `50` | Max emails per bulk request (free tier) |
| `PRO_BULK_LIMIT` | `500` | Max emails per bulk request (pro API key) |
| `BULK_CONCURRENCY` | `10` | Parallel workers for bulk processing |
| `SMTP_WORKER_URL` | `""` | Optional Railway worker URL for real RCPT probing |
| `SMTP_WORKER_SECRET` | `""` | Shared secret for SMTP worker authentication |
| `ALLOWED_ORIGINS` | `*` | CORS allowed origins (comma-separated) |
| `KV_REST_API_URL` | `""` | Vercel KV for persistent rate limiting |
| `POSTGRES_URL` | `""` | Vercel Postgres for result storage |

---

## 🏗 Architecture

```
Browser (React/Vite)
      │
      ├─ GET  /api/verify?email=...     ─→  api/verify.js
      │                                       └─ verifier.js (7 layers)
      │                                           ├─ L1: Syntax (RFC 5321)
      │                                           ├─ L2: DNS/MX lookup
      │                                           ├─ L3: Disposable check
      │                                           ├─ L4: Role-based check
      │                                           ├─ L5: SMTP heuristic / worker
      │                                           ├─ L6: Catch-all probe
      │                                           └─ L7: Gibberish entropy
      │
      └─ POST /api/bulk-verify          ─→  api/bulk-verify.js
                                             └─ Batched parallel processing
                                                 └─ verifier.js (same engine)
```

---

## 🚀 Scaling Beyond Vercel Free Tier

### Add persistent rate limiting (Vercel KV)
```bash
vercel storage create kv mailprobe-kv
# Auto-adds KV_REST_API_URL + KV_REST_API_TOKEN to env
```

Then swap `rateLimit.js` to use `@vercel/kv`:
```js
import { kv } from '@vercel/kv';
// Use kv.incr() + kv.expire() for distributed sliding window
```

### Add real SMTP probing (Railway worker)
See `api/_lib/SMTP_WORKER.md` for the full Express server code.
Deploy to Railway, set `SMTP_WORKER_URL` in Vercel env.

### Add result storage (Vercel Postgres)
```bash
vercel storage create postgres mailprobe-db
```
Then in `api/verify.js`:
```js
import { sql } from '@vercel/postgres';
await sql`INSERT INTO results (email, status, confidence) VALUES (${email}, ${status}, ${confidence})`;
```

### Handle 10k+ bulk emails
For files over 500 emails, implement a job queue:
1. `POST /api/jobs` → create job ID, store emails in KV, return `{ job_id }`
2. Background: process in batches using Vercel Cron or external queue
3. `GET /api/jobs/:id` → poll status
4. Frontend: poll every 2s, update progress bar

---

## 🔑 API Key System (production)

Currently API keys starting with `mp_live_` get pro limits.
For a real key system:

```sql
-- Vercel Postgres schema
CREATE TABLE api_keys (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash   TEXT UNIQUE NOT NULL,  -- SHA-256 of the actual key
  tier       TEXT DEFAULT 'free',
  user_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used  TIMESTAMPTZ,
  requests_today INT DEFAULT 0
);
```

```js
// In rateLimit.js — replace validateApiKey()
const crypto = require('crypto');
const { sql } = require('@vercel/postgres');

async function validateApiKey(key) {
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  const { rows } = await sql`SELECT * FROM api_keys WHERE key_hash = ${hash}`;
  return rows[0] || null;
}
```

---

## 📊 Confidence Score Reference

| Score | Status | Description |
|---|---|---|
| 80–100 | ✅ Valid | MX + SMTP verified, no flags |
| 60–79 | ✅ Valid | MX verified, trusted provider |
| 45–59 | ⚠️ Risky | Catch-all / role-based / disposable |
| 10–44 | ❌ Invalid | No mailbox or bad SMTP |
| 0–9 | ❌ Invalid | No MX records or syntax error |

---

## 📦 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, CSS-in-JS |
| API functions | Node.js 20, Vercel Serverless |
| DNS | Node.js `dns.promises` (built-in) |
| File parsing | papaparse (CSV), xlsx (XLSX) |
| Export | Native Blob/FileReader API |
| Rate limiting | In-memory (→ Vercel KV for prod) |
| Hosting | Vercel (frontend + API, single deploy) |
| SMTP (optional) | Railway microservice |
| Storage (optional) | Vercel Postgres + KV |

---

## 🧪 Testing the API

```bash
# After deploy — replace with your actual URL
BASE=https://your-project.vercel.app

# Single verify
curl "$BASE/api/verify?email=test@gmail.com" | jq .

# Bulk verify
curl -X POST "$BASE/api/bulk-verify" \
  -H "Content-Type: application/json" \
  -d '{"emails":["valid@gmail.com","fake@mailinator.com","admin@company.com"]}' | jq .

# Health check
curl "$BASE/api/health" | jq .
```

---

## License

MIT — use freely, star if useful ⭐
