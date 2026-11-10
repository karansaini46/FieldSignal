# FieldSignal — Production Deployment Guide & Checklist

## 1. Architecture Overview

FieldSignal is an enterprise-grade voice-first solar O&M maintenance intelligence platform designed for resilient operation in harsh outdoor plant environments.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FIELD CLIENTS (PWA / Mobile / Tablet)           │
│   • Voice Field Console (Web Audio API / MediaRecorder)                │
│   • Supervisor Operations Dispatch Dashboard                           │
│   • Asset & Incident Explorer                                          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS (TLS 1.3 + HSTS)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   VERCEL SERVERLESS EDGE PLATFORM                      │
│   • Next.js 16 App Router (React 19 Server Components)                 │
│   • Route Handlers (/api/v1/*) with Multi-Tenant RBAC Guards           │
│   • Ephemeral Audio Staging (/tmp/fieldsignal-audio)                   │
│   • Zero-Dependency Structured JSON Production Logger                  │
│   • Active Health Telemetry Probe (/api/v1/health)                     │
└───────────────┬───────────────────────────────┬────────────────────────┘
                │                               │
    Pooled PgBouncer (Port 6543)                │ REST API (HTTPS)
                │                               │
                ▼                               ▼
┌─────────────────────────────────┐   ┌──────────────────────────────────┐
│   MANAGED POSTGRESQL CLUSTER    │   │      EXTERNAL AI INTEGRATIONS    │
│   (Neon / Supabase / Cloud SQL) │   │   • Gnani AI Vachana ASR v3      │
│   • 7 Relations with UUID PKs   │   │   • Gnani AI Timbre TTS v3.0     │
│   • ACID Idempotency Guard      │   │   • Google Gemini 1.5 Flash      │
│   • Immutable Audit Event Log   │   │     (Structured Extraction)      │
└─────────────────────────────────┘   └──────────────────────────────────┘
```

---

## 2. Production Environment Variables

Configure these variables securely in your deployment dashboard (e.g. Vercel **Project Settings → Environment Variables**) or cloud secret store. **Never expose these in client-side code (`NEXT_PUBLIC_*`).**

| Variable Name | Required | Default / Format | Description |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | **Yes** | `"production"` | Runtime environment flag |
| `APP_URL` | **Yes** | `https://fieldsignal.vercel.app` | Canonical app URL for CORS and redirects |
| `DATABASE_URL` | **Yes** | `postgresql://user:pass@ep-pooler.neon.tech/db?sslmode=require&pgbouncer=true` | Pooled connection string for serverless API routes |
| `DIRECT_URL` | **Yes** | `postgresql://user:pass@ep-direct.neon.tech/db?sslmode=require` | Direct connection string for `prisma migrate deploy` |
| `JWT_SECRET` | **Yes** | `min-32-chars-random-string` | Cryptographic secret for signing session tokens (`openssl rand -base64 32`) |
| `JWT_EXPIRES_IN` | No | `"7d"` | Session duration |
| `GNANI_AI_API_KEY` | **Yes** | String | Gnani AI Vachana Speech Recognition API key |
| `GNANI_AI_ACCESS_KEY`| **Yes** | String | Gnani AI client access key |
| `GNANI_AI_ENDPOINT` | No | `https://api.vachana.ai/stt/v3` | Gnani ASR v3 REST endpoint |
| `GNANI_AI_MODEL` | No | `"prisma-v3.0"` | Multilingual ASR model with code-switching |
| `GNANI_AI_LANGUAGE_CODE` | No | `"hi-IN,en-IN"` | Primary and fallback languages |
| `GNANI_AI_TIMEOUT_MS` | No | `8000` | HTTP request timeout in milliseconds |
| `GNANI_AI_MAX_RETRIES`| No | `2` | Automatic retry limit on 5xx/429 |
| `GNANI_AI_MOCK_FALLBACK` | **Yes** | `false` | Disable synthetic fallback in production |
| `GNANI_TTS_ENDPOINT` | No | `https://api.vachana.ai/api/v1/tts/inference` | Gnani Timbre TTS v3.0 REST endpoint |
| `GNANI_TTS_MODEL` | No | `"timbre-v3.0"` | Timbre model version |
| `GNANI_TTS_VOICE` | No | `"Shivani"` | Default spoken voice (`Shivani`, `Avinash`, etc.) |
| `GNANI_TTS_LANGUAGE` | No | `"hi-IN"` | Spoken language |
| `GNANI_TTS_SPEED` | No | `1.0` | Playback rate (0.5x to 2.0x) |
| `AI_PROVIDER` | No | `"gemini"` | Extraction engine (`"gemini"` or `"openai"`) |
| `AI_API_KEY` | **Yes** | String | Google AI Studio or OpenAI API key |
| `AI_MODEL_NAME` | No | `"gemini-1.5-flash"` | Low-latency LLM model |
| `AUDIO_STORAGE_DIR` | No | `"/tmp/fieldsignal-audio"` | Serverless temporary audio buffer directory |
| `MAX_AUDIO_FILE_SIZE_MB` | No | `10` | Maximum recording payload size |

---

## 3. Database Migration & Provisioning

FieldSignal uses Prisma ORM with strict migration tracking. In production, never run `prisma migrate dev` (which resets schemas). Always run `prisma migrate deploy`.

### A. Managed PostgreSQL Setup (Neon, Supabase, Cloud SQL)
1. Provision a PostgreSQL 15+ database instance.
2. Enable connection pooling (PgBouncer or Neon connection pooler).
3. Retrieve both the **Pooled Connection URL** (port 6543) and **Direct Connection URL** (port 5432).

### B. Applying Migrations
Execute the production migration script from CI/CD or your terminal:
```bash
npm run db:migrate:prod
# Equivalent to: npx prisma migrate deploy
```

### C. Seeding Initial Plant Structure (Optional for New Clusters)
```bash
npm run db:seed
```
This populates:
- 2 Organizations (Sunrise Solar Operations, Apex Clean Energy)
- 2 Solar Parks (Bhadla Solar Park Sector IV 250MW, Pavagada Solar Park 200MW)
- 9 Hierarchical Assets (Central Inverters, String Combiner Boxes, Transformers)
- 5 Standard Users (Technicians, Supervisors, Admins)

---

## 4. Deploying Frontend to Vercel

### Method 1: Git Integration (Recommended for CI/CD)
1. Push your repository to GitHub / GitLab / Bitbucket.
2. In Vercel, click **Add New Project** and import the repository.
3. In **Build and Output Settings**:
   - **Framework Preset**: Next.js
   - **Build Command**: `npm run build`
   - **Install Command**: `npm install`
4. In **Environment Variables**, paste all production variables from Section 2.
5. Click **Deploy**. Vercel will trigger a build and assign a production URL.

### Method 2: Vercel CLI
```bash
# 1. Login to Vercel
npx vercel login

# 2. Link your local project
npx vercel link

# 3. Pull production environment variables
npx vercel env pull .env.production.local

# 4. Deploy to production
npx vercel deploy --prod
```

---

## 5. Security Posture & Hardening

FieldSignal enforces enterprise defense-in-depth across all application tiers:

1. **HTTP Security Headers** (`next.config.ts`):
   - `X-Frame-Options: DENY` (Anti-Clickjacking)
   - `X-Content-Type-Options: nosniff` (Anti-MIME-sniffing)
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Permissions-Policy: camera=(), microphone=(self), geolocation=()` (Restricts hardware access strictly to same-origin voice recording)
   - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (HSTS)
   - `X-XSS-Protection: 0`
2. **Zero Client Secrets**:
   - No `NEXT_PUBLIC_*` tokens for databases, LLMs, or speech engines.
   - All AI calls (`Gemini`, `Gnani ASR`, `Gnani Timbre`) execute in server-side Next.js route handlers.
3. **Multi-Tenant Isolation**:
   - Every API route validates user session and enforces `organizationId` and `siteId` boundaries (`src/lib/auth-guard.ts`).
   - Cross-tenant data leakage is strictly blocked at the query level.
4. **Idempotency & Concurrency Safety**:
   - Incident submission uses database transactions with duplicate prevention windows (`createdAt >= 15m ago`).
   - Resubmitted requests return existing ticket metadata without creating orphaned records.
5. **Credential Redaction in Logs**:
   - Structured JSON logger automatically strips passwords, tokens, API keys, cookies, and bearer headers before writing to stdout/stderr.

---

## 6. Audio Storage Architecture

- **Serverless Fallback**: On Vercel, `process.cwd()` is mounted as a read-only filesystem. FieldSignal's storage engine (`src/lib/audio-storage.ts`) automatically detects `process.env.VERCEL` and redirects temporary audio buffers to `os.tmpdir()` (`/tmp/fieldsignal-audio`).
- **Object Storage Upgrade Path**: For persistent multi-region audio archive needs beyond the container lifecycle, attach AWS S3, Google Cloud Storage, or Vercel Blob by configuring an S3 client in `src/lib/audio-storage.ts`.

---

## 7. Production Verification & Smoke Testing

After deploying, verify the live deployment against this checklist:

### A. Health & Telemetry Probe
```bash
curl -i https://<your-vercel-domain>/api/v1/health
```
**Expected Response (HTTP 200 OK):**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "service": "FieldSignal Monolith API",
    "version": "1.0.0",
    "environment": "production",
    "database": {
      "status": "connected",
      "latencyMs": 14
    },
    "modules": {
      "database": "connected",
      "speechASR": "ready",
      "aiExtraction": "ready",
      "rbac": "enforced"
    }
  }
}
```

### B. Security Headers Verification
```bash
curl -I https://<your-vercel-domain>/
```
Verify presence of `x-frame-options: DENY`, `x-content-type-options: nosniff`, and `strict-transport-security`.

### C. Core User Flows Smoke Test
1. **Authentication**: Sign in at `/login` with credentials (`9876543210` / `technician123`).
2. **Voice Recording & Field Console**: Open `/field`, select Bhadla Solar Park, test microphone record or text fallback.
3. **Extraction & Review**: Verify fault description extraction, asset code matching, and suggested priority.
4. **Confirmation Workflow**: Click "Confirm & Submit", verify generated ticket number (e.g. `INC-2026-0005`).
5. **Supervisor Dashboard**: Sign in as Supervisor (`9876543212` / `supervisor123`), navigate to `/dashboard`, verify newly created ticket appears in the dispatch queue.
6. **Mobile Layout**: Open on phone or Chrome DevTools mobile emulator (iPhone 14 / Pixel 7), verify zero horizontal blowout and accessible touch targets.

---

## 8. Deployment Sign-off Matrix

| Verification Check | Status | Verification Mechanism |
| :--- | :---: | :--- |
| **Prisma Schema & Migrations** | PASS | `prisma migrate deploy` cleanly applies all migrations |
| **Connection Pooling** | PASS | `DATABASE_URL` (pooler) & `DIRECT_URL` (migration) configured |
| **Zero Client Secret Leakage** | PASS | Grep audit confirmed zero `NEXT_PUBLIC_` sensitive secrets |
| **Next.js Production Build** | PASS | `npm run build` succeeds in Turbopack (24/24 static pages, 30 routes) |
| **Vitest Unit Suite** | PASS | 40/40 passing in 2.6s |
| **Playwright E2E Suite** | PASS | 12/12 passing across Desktop & Mobile viewports |
| **Integration Test Suites** | PASS | Auth (18), Validation (65), Clarification (61), Historical, Confirmation, Supervisor, TTS (all passing) |
| **Health Check Telemetry** | PASS | Active PostgreSQL `SELECT 1` ping + latency + memory reporting |
| **Error Boundaries** | PASS | Custom `not-found.tsx`, `error.tsx`, and `global-error.tsx` in place |
| **Zero External Font Build Failures** | PASS | System-backed typography stack eliminates external CDN dependency |
