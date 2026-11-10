# FieldSignal — Developer & Operator Setup Guide

This guide provides step-by-step instructions for installing, configuring, running, and verifying FieldSignal on a local development workstation or staging environment.

---

## 1. System Prerequisites

Before starting, ensure your host environment meets the following specifications:

| Requirement | Minimum Version | Recommended Version | Verification Command |
| :--- | :---: | :---: | :--- |
| **Node.js** | `v20.0.0` | `v20.18.0` LTS | `node -v` |
| **npm** | `v10.0.0` | `v10.8.0`+ | `npm -v` |
| **PostgreSQL** | `v15.0` | `v16.0`+ | `psql --version` |
| **Operating System**| Linux / macOS / Windows WSL2 | Linux (Ubuntu 22.04+) | `uname -a` |
| **ffmpeg** (Optional) | `v4.4`+ | `v6.0`+ | `ffmpeg -version` |

> [!NOTE]
> `ffmpeg` is used by the server-side audio transcoder (`src/modules/speech/audio-transcoder.ts`) when converting complex audio containers to standard 16kHz mono WAV format. If `ffmpeg` is not installed on the system, FieldSignal automatically falls back to raw WAV/PCM ingestion.

---

## 2. Repository Cloning & Dependency Installation

```bash
# 1. Clone repository
git clone https://github.com/karansaini46/FieldSignal.git
cd FieldSignal

# 2. Install Node dependencies
npm install
```

---

## 3. Environment Configuration

Copy the example environment configuration template:
```bash
cp .env.example .env
```

### Environment Variables Reference

Open `.env` in your editor and configure the following parameters:

```ini
# ==============================================================================
# FieldSignal — Environment Variables Configuration (Local Development)
# ==============================================================================

# Application Runtime
NODE_ENV="development"
PORT=3000
APP_URL="http://localhost:3000"

# Database (PostgreSQL)
# DATABASE_URL: Connection-pooled URL for runtime queries
DATABASE_URL="postgresql://postgres:password@localhost:5432/fieldsignal?schema=public"
# DIRECT_URL: Direct database connection URL for migrations (bypasses transaction pooler)
DIRECT_URL="postgresql://postgres:password@localhost:5432/fieldsignal?schema=public"

# Authentication & Session Security (Min 32 characters)
JWT_SECRET="fieldsignal-super-secret-jwt-key-min-32-chars-long"
JWT_EXPIRES_IN="7d"

# Gnani AI Speech Recognition Service (Vachana REST API v3)
# Endpoint: https://api.vachana.ai/stt/v3
# Auth: Sent via 'X-API-Key-ID' header
GNANI_AI_API_KEY="your_gnani_api_key_here"
GNANI_AI_ACCESS_KEY="your_gnani_access_key_here"
GNANI_AI_ENDPOINT="https://api.vachana.ai/stt/v3"
GNANI_AI_MODEL="prisma-v3.0"
GNANI_AI_LANGUAGE_CODE="hi-IN,en-IN"
GNANI_AI_TIMEOUT_MS=8000
GNANI_AI_MAX_RETRIES=2
# Enable simulated mock transcription fallback in local dev when key is placeholder
GNANI_AI_MOCK_FALLBACK=true

# Gnani AI Text-to-Speech Service (Timbre REST API v3.0)
# Endpoint: https://api.vachana.ai/api/v1/tts/inference
GNANI_TTS_ENDPOINT="https://api.vachana.ai/api/v1/tts/inference"
GNANI_TTS_MODEL="timbre-v3.0"
GNANI_TTS_VOICE="Shivani"
GNANI_TTS_LANGUAGE="hi-IN"
GNANI_TTS_SPEED=1.0

# AI Extraction Layer (Google Gemini 1.5 Flash)
AI_PROVIDER="gemini"
AI_API_KEY="your_google_ai_studio_api_key_here"
AI_MODEL_NAME="gemini-1.5-flash"

# Local Media Storage
AUDIO_STORAGE_DIR="./uploads/audio"
MAX_AUDIO_FILE_SIZE_MB=10
```

---

## 4. Database Setup & Seeding

### A. Create Local Database
If using local PostgreSQL:
```bash
# Using PostgreSQL CLI
createdb -U postgres fieldsignal
```

### B. Apply Migrations
Apply the production migration schema to PostgreSQL:
```bash
npm run db:migrate:prod
# Output: Datasource "db": PostgreSQL database "fieldsignal" ... No pending migrations to apply.
```

### C. Populate Synthetic Solar Plant Data
Seed the database with synthetic solar park structures, hierarchical assets, and demonstration accounts:
```bash
npm run db:seed
```

This populates:
1. **Organizations**:
   - `Sunrise Solar Operations` (`SUNRISE-SOLAR`)
   - `Apex Clean Energy` (`APEX-CLEAN`)
2. **Solar Parks**:
   - `Bhadla Solar Park - Sector IV (50 MW)` in Phalodi District, Rajasthan
   - `Pavagada Solar Park (25 MW)` in Tumakuru, Karnataka
3. **Hierarchical Assets**:
   - Central Inverter Station 01 (`INV-STN-01`)
     - Central Inverter 1 (`INV-01`, SMA 2.5MW)
     - Central Inverter 3 (`INV-03`, SMA 2.5MW)
     - String Combiner Box 01-A (`SCB-01-A`)
     - Step-Up Transformer 01 (`TR-01`, 33kV)
   - Central Inverter Station 02 (`INV-STN-02`)
     - Central Inverter 2 (`INV-02`, ABB 2.0MW)
4. **Demonstration Incident History**:
   - Historical thermal over-temperature trips, insulation faults, and tracker alarms on `INV-01` to demonstrate repeat fault detection and symptom matching.

---

## 5. Running the Application

### Development Mode (Turbopack Hot Reload)
```bash
npm run dev
```
Navigate to [http://localhost:3000](http://localhost:3000).

### Production Build & Local Emulation
```bash
# Create optimized production build
npm run build

# Start production server
npm run start
```

---

## 6. Demo User Accounts & Roles

All synthetic test accounts share the password: `password123`

| Name | Role | Phone Identifier | Primary Site Assignment |
| :--- | :--- | :--- | :--- |
| **Rajesh Meena** | `TECHNICIAN` | `+919876500002` | Bhadla Solar Park (Sector IV) |
| **Vikramaditya Rathore** | `SUPERVISOR` | `+919876500001` | Bhadla Solar Park (Sector IV) |
| **Pooja Sharma** | `ADMIN` | `+919876500000` | Enterprise Portfolio (Sunrise Solar) |
| **Amit Patel** | `TECHNICIAN` | `+919876599999` | Pavagada Solar Park (Apex Clean Energy) |

> [!TIP]
> The sign-in page at `/login` provides 1-click **Quick-Login Demo Accounts** that bypass manual credential entry during live competition demonstrations.

---

## 7. Running Automated Tests

FieldSignal comes with a full verification suite:

```bash
# 1. Run Vitest Unit Tests (40/40 Passing)
npm run test:unit

# 2. Run Playwright End-to-End Tests (12/12 Passing)
npm run test:e2e

# 3. Run Individual Integration Suites:
npm run test:auth          # Multi-tenant RBAC & authentication
npm run test:validation    # Deterministic asset matching & incident validation
npm run test:clarification # Multi-turn conversational clarification
npm run test:historical   # Historical incident intelligence & symptom similarity
npm run test:confirmation # Review parameters, confirmation & idempotency
npm run test:supervisor   # Supervisor operations dashboard queries
npm run test:tts          # Gnani AI Timbre TTS server integration
```

---

## 8. Common Troubleshooting Steps

### 1. Database Connection Failure (`P1001: Can't reach database server`)
- Verify PostgreSQL is running: `sudo systemctl status postgresql` (Linux) or check your local service.
- Verify credentials in `.env`: Ensure user, password, port, and database name match your PostgreSQL instance.

### 2. Microphone Access Denied in Browser
- When navigating to `/field`, allow browser permissions for microphone recording.
- If using Chrome/Edge on an IP or non-localhost address, ensure HTTPS is enabled or add the domain to `chrome://flags/#unsafely-treat-insecure-origin-as-secure`.
- For silent testing without a physical microphone, use the **Quick Audio Simulation Chips** on the Field Console.

### 3. Missing or Invalid Gnani API Keys
- If `GNANI_AI_API_KEY` is not provided or set to a placeholder, FieldSignal uses its built-in fallback engine (`GNANI_AI_MOCK_FALLBACK=true`) to enable seamless local development and UI testing.
- For live speech recognition with Indian accents, supply a genuine Gnani AI key from [api.vachana.ai](https://api.vachana.ai).
