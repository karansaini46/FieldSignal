# FieldSignal — REST API Specification (`/api/v1`)

FieldSignal exposes a typed REST API under the `/api/v1` namespace. All endpoints return a standardized JSON envelope (except binary audio streams from `/api/v1/speech/synthesize`).

---

## 1. Global Conventions & Standards

### Response Envelope Structure
```typescript
// Standard Success Response
interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: {
    requestId?: string;
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

// Standard Error Response
interface ApiErrorResponse {
  success: false;
  error: {
    code: string;       // e.g. "BAD_REQUEST", "UNAUTHORIZED", "NOT_FOUND"
    message: string;    // Human-readable error description
    details?: unknown;  // Validation issue list or contextual payload
  };
}
```

### Authentication & Authorization
- **Session Cookie**: `fieldsignal_session` (HttpOnly, Secure, SameSite=Lax).
- **Bearer Token**: `Authorization: Bearer <jwt_token>` (for programmatic API requests).
- **Multi-Tenant Scoping**: All site queries automatically verify that the requested `siteId` belongs to the authenticated user's `organizationId`.

---

## 2. Authentication Endpoints

### 2.1 Authenticate User
- **Method / Route**: `POST /api/v1/auth/login`
- **Authentication**: Public
- **Request Body**:
```json
{
  "identifier": "+919876500002",
  "password": "password123"
}
```
- **Success Response (HTTP 200)**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "e8a93ef0-5b56-42bb-85bb-bfb7a747caee",
      "name": "Rajesh Meena",
      "phone": "+919876500002",
      "role": "TECHNICIAN",
      "organizationId": "50c6d66e-21ef-447a-8fbf-4a946ad98579",
      "organizationName": "Sunrise Solar Operations",
      "siteId": "85750035-71ba-43ae-bcae-e727503fa374",
      "siteName": "Bhadla Solar Park - Sector IV"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```
- **Error Responses**:
  - `400 BAD_REQUEST`: Missing identifier or password.
  - `401 UNAUTHORIZED`: Invalid credentials or deactivated account.

### 2.2 Terminate Session
- **Method / Route**: `POST /api/v1/auth/logout`
- **Authentication**: Required
- **Success Response (HTTP 200)**: Clears `fieldsignal_session` cookie.

### 2.3 Get Current Authenticated Session
- **Method / Route**: `GET /api/v1/auth/me`
- **Authentication**: Required
- **Success Response (HTTP 200)**: Returns user profile, active site, and permissions.

---

## 3. Speech & Voice Subsystem

### 3.1 Transcribe Voice Audio
- **Method / Route**: `POST /api/v1/speech/transcribe`
- **Authentication**: Required
- **Content-Type**: `multipart/form-data`
- **Form Fields**:
  - `audio`: File buffer (`audio/webm`, `audio/wav`, `audio/ogg`, max 10MB)
  - `siteId`: (Optional) Target solar park UUID for asset scoping
- **Description**: Validates payload, stores audio in serverless-safe `/tmp/fieldsignal-audio`, calls Gnani AI Vachana ASR v3 (`prisma-v3.0`), and preserves raw audio metadata in database.
- **Success Response (HTTP 200)**:
```json
{
  "success": true,
  "data": {
    "recordingId": "38a3c9a4-ec30-4e58-9441-2a54b3ee42a2",
    "transcript": "Inverter 1 over temperature ki wajah se trip ho gaya hai alarm code 204 hai",
    "isEmptyTranscript": false,
    "detectedLanguage": "hi-IN",
    "confidence": 0.94,
    "processingTimeSeconds": 1.25,
    "latencyMs": 1250,
    "model": "prisma-v3.0",
    "fileSizeBytes": 142850,
    "mimeType": "audio/wav"
  }
}
```

### 3.2 Synthesize Speech (Gnani AI Timbre TTS)
- **Method / Route**: `POST /api/v1/speech/synthesize`
- **Authentication**: Required
- **Request Body**:
```json
{
  "text": "Incident ticket confirmed. Ticket number INC 2026 0005 has been dispatched.",
  "voice": "Shivani",
  "language": "hi-IN",
  "speed": 1.0
}
```
- **Success Response (HTTP 200)**:
  - **Content-Type**: `audio/wav`
  - **Headers**:
    - `X-TTS-Model: timbre-v3.0`
    - `X-TTS-Voice: Shivani`
  - **Body**: Binary WAV audio stream.
- **Error Responses**:
  - `400 BAD_REQUEST`: Empty text or text exceeding 2000 characters.
  - `502 BAD_GATEWAY`: Gnani TTS upstream failure (client falls back to visible text).

---

## 4. AI Extraction & Incident Intelligence

### 4.1 Extract Structured Solar Incident
- **Method / Route**: `POST /api/v1/incidents/extract`
- **Authentication**: Required
- **Request Body**:
```json
{
  "transcript": "Bhai Block-A me Inverter 1 subah se E-14 over-temp error de raha hai. Heat sink garam hai.",
  "siteId": "85750035-71ba-43ae-bcae-e727503fa374"
}
```
- **Success Response (HTTP 200)**:
```json
{
  "success": true,
  "data": {
    "originalTranscript": "Bhai Block-A me Inverter 1 subah se E-14 over-temp error de raha hai. Heat sink garam hai.",
    "identifiedAsset": {
      "assetTag": "INV-01",
      "matchedAssetId": "91238411-b045-4c07-9da0-e2b2cfa3065a",
      "assetType": "INVERTER",
      "confidence": 0.96,
      "requiresManualSelection": false
    },
    "faultCategory": "OVER_TEMPERATURE",
    "suggestedPriority": "HIGH",
    "description": "Inverter 1 experiencing thermal over-temperature alarm E-14 with hot heat sink.",
    "symptoms": "Heat sink overheating, potential cooling fan failure",
    "errorCode": "E-14",
    "missingFields": [],
    "contradictions": []
  }
}
```

### 4.2 Multi-Turn Clarification Engine
- **Method / Route**: `POST /api/v1/incidents/clarify`
- **Authentication**: Required
- **Request Body**:
```json
{
  "siteId": "85750035-71ba-43ae-bcae-e727503fa374",
  "extraction": {
    "faultCategory": "OVER_TEMPERATURE",
    "description": "Equipment is overheating in Block A"
  },
  "clarificationHistory": []
}
```
- **Success Response (HTTP 200)**:
```json
{
  "success": true,
  "data": {
    "needsClarification": true,
    "nextQuestion": {
      "field": "asset",
      "question": "Which specific equipment tag or inverter experienced the fault in Block A?"
    },
    "missingFields": ["asset"],
    "clarificationHistory": []
  }
}
```

### 4.3 Draft-Time Historical Intelligence
- **Method / Route**: `POST /api/v1/incidents/historical-intelligence`
- **Authentication**: Required
- **Request Body**:
```json
{
  "siteId": "85750035-71ba-43ae-bcae-e727503fa374",
  "assetId": "91238411-b045-4c07-9da0-e2b2cfa3065a",
  "symptoms": "Over temperature trip with error code E-14",
  "errorCode": "E-14"
}
```
- **Success Response (HTTP 200)**:
```json
{
  "success": true,
  "data": {
    "assetId": "91238411-b045-4c07-9da0-e2b2cfa3065a",
    "totalIncidents30d": 2,
    "unresolvedCount": 1,
    "isRepeatFault": true,
    "rootCauseDisclaimer": "Notice: Symptom and description similarity does NOT imply identical root causes. Physical electrical testing and isolation are mandatory.",
    "allRelevantIncidents": [
      {
        "id": "c1356891-...",
        "ticketNumber": "INC-2026-0002",
        "createdAt": "2026-11-08T10:00:00.000Z",
        "status": "IN_PROGRESS",
        "labels": ["Same asset", "Similar reported symptom", "Previous incident", "Unresolved incident"],
        "similarityScore": 0.85
      }
    ],
    "repeatedSymptoms": [
      {
        "symptom": "Thermal / Over-Temperature",
        "count": 2,
        "isCurrentMatch": true
      }
    ]
  }
}
```

---

## 5. Incidents Lifecycle & Management

### 5.1 Search & Filter Incidents
- **Method / Route**: `GET /api/v1/incidents`
- **Authentication**: Required
- **Query Parameters**:
  - `siteId`: Filter by solar park
  - `status`: Filter by enum (`SUBMITTED`, `ACKNOWLEDGED`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`)
  - `priority`: Filter by enum (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`)
  - `assetId`: Filter by equipment UUID
  - `search`: Case-insensitive search on ticket number, title, description, or error code
  - `page`: Page number (default: 1)
  - `limit`: Items per page (default: 20)
- **Success Response (HTTP 200)**: Paginated incident summary array.

### 5.2 Confirm & Create Incident (Idempotent)
- **Method / Route**: `POST /api/v1/incidents`
- **Authentication**: Required
- **Request Body**:
```json
{
  "siteId": "85750035-71ba-43ae-bcae-e727503fa374",
  "assetId": "91238411-b045-4c07-9da0-e2b2cfa3065a",
  "title": "INV-01 Over-temperature Trip",
  "description": "Inverter 1 experiencing thermal trip alarm code E-14",
  "symptoms": "Overheating heat sink, fan not spinning",
  "errorCode": "E-14",
  "priority": "HIGH",
  "faultCategory": "OVER_TEMPERATURE",
  "originalTranscript": "Inverter 1 over temperature ki wajah se trip ho gaya hai",
  "isConfirmed": true,
  "actionsAlreadyTaken": "Checked DC isolator switch"
}
```
- **Explicit Confirmation Rule**: If `isConfirmed` is `false` or missing, the API rejects the request with `422 UNPROCESSABLE_ENTITY`.
- **Success Response (HTTP 201 Created)**:
```json
{
  "success": true,
  "data": {
    "id": "e43b18d7-7095-46aa-bbf0-8e7d23a4b600",
    "ticketNumber": "INC-2026-0005",
    "status": "SUBMITTED",
    "priority": "HIGH",
    "confirmedAt": "2026-11-10T21:45:00.000Z",
    "originalTranscript": "Inverter 1 over temperature ki wajah se trip ho gaya hai"
  }
}
```

### 5.3 Retrieve Incident Detail & Audit Timeline
- **Method / Route**: `GET /api/v1/incidents/:id`
- **Authentication**: Required
- **Success Response (HTTP 200)**: Returns full incident object, including `events` (audit log of all transitions) and `clarifications`.

### 5.4 Update Incident Status & Triage
- **Method / Route**: `PATCH /api/v1/incidents/:id`
- **Authentication**: Required (Supervisor or assigned Technician)
- **Request Body**:
```json
{
  "status": "IN_PROGRESS",
  "assignedToUserId": "e8a93ef0-5b56-42bb-85bb-bfb7a747caee",
  "priority": "CRITICAL",
  "note": "Dispatched technician with spare cooling fan."
}
```
- **Success Response (HTTP 200)**: Returns updated incident and records an immutable `IncidentEvent` audit record.

### 5.5 Answer Clarification on Active Incident
- **Method / Route**: `POST /api/v1/incidents/:id/clarifications`
- **Authentication**: Required
- **Request Body**:
```json
{
  "clarificationId": "912fa89b-...",
  "response": "Inverter 1"
}
```
- **Success Response (HTTP 200)**: Updates clarification status to `RESOLVED`, links the asset to the ticket, advances the incident status out of `NEEDS_CLARIFICATION`, and logs an audit event.

---

## 6. System Health & Telemetry

### 6.1 Health & Liveness Probe
- **Method / Route**: `GET /api/v1/health`
- **Authentication**: Public
- **Description**: Actively pings PostgreSQL with `SELECT 1` and returns live telemetry.
- **Success Response (HTTP 200)**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "service": "FieldSignal Monolith API",
    "version": "1.0.0",
    "environment": "production",
    "timestamp": "2026-11-10T21:45:00.000Z",
    "latencyMs": 12,
    "database": {
      "status": "connected",
      "latencyMs": 3
    },
    "modules": {
      "database": "connected",
      "speechASR": "ready",
      "aiExtraction": "ready",
      "rbac": "enforced"
    },
    "system": {
      "uptimeSeconds": 1420,
      "nodeVersion": "v20.18.0",
      "memoryMb": 118
    }
  }
}
```
- **Degraded Response (HTTP 503)**:
```json
{
  "success": false,
  "error": {
    "code": "SERVICE_UNHEALTHY",
    "message": "Critical service dependency failed health check",
    "details": {
      "database": {
        "status": "disconnected",
        "error": "Database unreachable"
      }
    }
  }
}
```
