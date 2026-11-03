# FieldSignal ☀️⚡

> **Voice-first maintenance fault reporting and intelligence platform for solar plant O&M teams.**

FieldSignal empowers on-site solar plant technicians to report equipment faults naturally in **Hindi, Hinglish, and English**. Using Gnani AI speech recognition and an AI extraction layer, colloquial voice audio is transformed into structured, actionable maintenance tickets with asset validation, repeat-fault warnings, and human-in-the-loop confirmation.

---

## 🏗️ Architecture & Philosophy

FieldSignal is engineered as a **modular monolith** optimized for single-developer velocity, zero microservice complexity, and harsh remote solar plant conditions (high ambient noise, glare, spotty cellular networks).

- **Full-Stack:** Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui
- **Database:** PostgreSQL 16 + Prisma ORM
- **Audio Capture:** HTML5 `MediaRecorder` encoding WebM/Opus (16 kbps)
- **Speech Engine:** Gnani AI multi-lingual ASR (`hi-IN`, `en-IN`, Hinglish)
- **AI Extraction:** LLM structured JSON output with solar taxonomy validation
- **Integrity:** Strict Foreign Key relations, full audit logging, deterministic 7-state lifecycle

Comprehensive documentation:

- 📄 [Product Requirements Document (PRD)](./docs/PRD.md)
- 📐 [System Architecture Document](./docs/ARCHITECTURE.md)

---

## 🚀 Getting Started

### 1. Prerequisites

- Node.js 20+ (LTS)
- npm 10+
- PostgreSQL 16+

### 2. Installation

```bash
# Clone the repository
git clone https://github.com/karansaini46/FieldSignal.git
cd FieldSignal

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env

# Generate Prisma Client
npm run db:generate
```

### 3. Development

```bash
# Start Turbopack dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application foundation.

---

## 🛠️ Available Scripts

| Command                | Description                                          |
| :--------------------- | :--------------------------------------------------- |
| `npm run dev`          | Starts local Next.js Turbopack development server    |
| `npm run build`        | Builds optimized production bundle                   |
| `npm run start`        | Runs production server                               |
| `npm run typecheck`    | Validates TypeScript in strict mode (`tsc --noEmit`) |
| `npm run lint`         | Runs ESLint across the codebase                      |
| `npm run format`       | Formats codebase using Prettier                      |
| `npm run format:check` | Verifies code formatting style                       |
| `npm run db:generate`  | Generates typed Prisma Client                        |
| `npm run db:push`      | Pushes schema directly to database                   |
| `npm run db:migrate`   | Runs Prisma database migrations                      |
| `npm run db:studio`    | Opens Prisma Studio GUI                              |

---

## 📂 Modular Structure

```
src/
├── app/                  # Next.js App Router (UI routes & API endpoints)
│   ├── api/v1/health/    # Health check endpoint
│   ├── layout.tsx        # Responsive application shell
│   └── page.tsx          # System foundation overview
├── components/           # UI Layer
│   ├── common/           # Header, Footer, Status indicators
│   └── ui/               # shadcn/ui components (card, badge, button, alert)
├── lib/                  # Shared Infrastructure
│   ├── db.ts             # Prisma client singleton
│   ├── env.ts            # Zod environment variable validation
│   ├── errors.ts         # Centralized AppError & exception mapper
│   └── api-response.ts   # Standardized ApiResponse builders
├── modules/              # Modular Monolith Business Domains
│   ├── auth/             # RBAC matrix & permissions
│   ├── assets/           # Solar equipment hierarchy & search
│   ├── speech/           # Gnani AI ASR integration contracts
│   ├── extraction/       # AI structured incident extractor
│   └── incidents/        # 7-state lifecycle finite state machine
└── types/                # System-wide API contracts & response types
```

---

## 📄 License

Private & Proprietary — FieldSignal Solar O&M Platform
