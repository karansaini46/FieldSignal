# FieldSignal — Product Requirements Document (PRD)

**Document Version:** 1.0.0 (MVP)  
**Status:** Approved for Implementation  
**Target Delivery:** Solo-Developer MVP (4-Week Build)  
**Author:** Lead Software Architect & Product Engineer  

---

## 1. Executive Summary & Problem Statement

### 1.1 The Reality of Solar Plant O&M
Utility-scale and commercial/industrial (C&I) solar photovoltaic (PV) plants span anywhere from 50 acres to over 10,000 acres. Operation & Maintenance (O&M) field technicians walk or drive miles across harsh, dusty, high-temperature, high-glare environments inspecting string combiner boxes (SMBs/SCBs), central/string inverters, transformers, weather monitoring stations (WMS), tracker motors, and balance-of-plant (BOP) infrastructure.

Today, fault reporting in the field is severely broken:
- **Paper Logbooks & WhatsApp Chats:** Technicians scribble notes on paper or post unstructured voice notes / blurry photos in frantic WhatsApp groups.
- **Language Barriers & Typing Friction:** Most field technicians in India are native Hindi speakers. Typing formal English fault reports on smartphones while wearing protective gloves under direct 45°C sunlight is impractical and rarely done on time.
- **Lost Generation & High MTTR (Mean Time to Resolution):** Unreported or poorly described faults (e.g., "Inverter 4 trip ho gaya") lack critical data (error code, block ID, inverter station, DC/AC side). This leads to delayed dispatch of parts, repeat site visits, and unnecessary generation downtime costing plant owners thousands of dollars daily.
- **Zero Asset History Visibility:** Technicians reporting a fault do not know if the same inverter had an identical insulation fault or IGBT over-temperature trip 48 hours earlier.

### 1.2 The FieldSignal Solution
**FieldSignal** is a voice-first, AI-driven maintenance fault reporting and intelligence platform tailored specifically for solar plant O&M.
- Field technicians press a single button and speak naturally in **Hindi, Hinglish, or English** describing equipment anomalies.
- **Gnani AI speech recognition** converts multi-lingual voice audio to accurate text.
- An **AI extraction engine** parses the transcript into a structured solar maintenance incident (Asset, Hierarchy, Fault Category, Symptoms, Severity, Measurements).
- The system checks the **Plant Asset Registry** to validate the asset, flags **missing critical data** (e.g., error codes, block numbers), cross-references **recent asset history**, and presents a draft card for **technician confirmation** before finalizing the incident.
- Site supervisors and plant managers receive immediate, structured, prioritized tickets on a live web dashboard.

---

## 2. User Roles & Permissions Matrix

FieldSignal enforces a lean, role-based access control (RBAC) model with 3 core roles:

| Capability / Action | Field Technician (`field_tech`) | Site Supervisor (`site_supervisor`) | Plant Manager / Admin (`plant_manager`) |
| :--- | :---: | :---: | :---: |
| **Record Voice Fault Report** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Confirm & Edit Draft Incident** | ✅ Yes (Own Drafts) | ✅ Yes (All Drafts) | ✅ Yes (All Drafts) |
| **View Plant Incidents Dashboard** | ✅ Own & Assigned | ✅ Full Plant Scope | ✅ All Plants / Portfolio |
| **Assign / Reassign Incidents** | ❌ No | ✅ Yes | ✅ Yes |
| **Update Incident Status (In Progress, Resolved)** | ✅ Assigned Only | ✅ Yes | ✅ Yes |
| **Verify & Close Incidents** | ❌ No | ✅ Yes | ✅ Yes |
| **View Asset History & Frequency** | ✅ In confirmation flow | ✅ Full History | ✅ Full History + Analytics |
| **Manage Plant Assets & Hierarchy** | ❌ Read-Only | ❌ Read-Only | ✅ Full CRUD |
| **Manage Users & Permissions** | ❌ No | ❌ No | ✅ Full CRUD |
| **Export Reports (CSV/PDF)** | ❌ No | ✅ Plant Level | ✅ Portfolio Level |

---

## 3. Scope of the MVP

### 3.1 In-Scope (MVP Deliverables)
1. **Voice Input & Processing:**
   - Single-tap audio recorder in browser (PWA-compatible, works with gloves/touch).
   - Audio compression (WebM / Opus) for low-bandwidth cellular environments (2G/3G/4G).
   - Integration with **Gnani AI ASR** supporting Hindi (`hi-IN`), Indian English (`en-IN`), and Hinglish code-switching.
2. **AI Extraction & Structured Mapping:**
   - LLM extraction prompt tuned for solar domain taxonomy (PV modules, inverters, strings, trackers, SMBs, transformers, switchgear, SCADA).
   - Deterministic JSON output matching the strict incident schema.
3. **Data Validation & Missing Fields Engine:**
   - Validation against known asset registry (Plant -> Block -> Inverter Station -> Asset).
   - Identification of missing required fields (e.g., missing specific Asset ID, missing error code for inverter trip).
   - Dynamic prompt generation for the technician: *"Aapne Inverter 3 bola, par Block A ya Block B nahi bataya. Kripya block confirm karein."*
4. **Asset History Intelligence:**
   - Instant query of the asset's last 5 incidents / past 30 days history.
   - Recurring fault badge displayed during confirmation (e.g., *"Repeat Fault: 3rd trip this week"*).
5. **Technician Review & Confirmation Card:**
   - Draft incident view showing: original audio player, transcript, extracted fields, detected missing fields, and asset history warnings.
   - Single-click confirmation or quick inline field corrections before ticket submission.
6. **Supervisor & Plant Operations Dashboard:**
   - Filterable incident list (by Severity, Status, Plant, Block, Asset Type, Date).
   - Detailed incident page with audio replay, transcript, fault parameters, status timeline, and assignment.
   - Basic status transitions: `OPEN` → `ASSIGNED` → `IN_PROGRESS` → `RESOLVED` → `CLOSED`.
7. **Single Plant Asset Registry:**
   - Pre-seeded or CSV-uploadable hierarchical asset tree for at least one pilot solar plant (e.g., 50 MW plant with 25 inverter stations, 100 SMBs).

### 3.2 Out-of-Scope (Deferred to Post-MVP)
- Native mobile apps on iOS / Android App Stores (MVP will be a responsive Web PWA).
- Automated SCADA / IoT webhook fault ingestion (focus is human field reporting).
- Complex offline SQLite-to-server sync engine (MVP provides client-side offline audio recording queue that auto-uploads on network reconnect).
- Predictive maintenance ML models (MVP focuses on operational asset history lookup).
- Multi-tenant enterprise SSO / SAML (MVP uses standard JWT / secure cookie sessions).

---

## 4. Detailed Feature Specifications

### Feature 1: Voice Recording & Audio Ingestion
- **Description:** Technicians can record voice notes on their phone with a single tap.
- **User Flow:**
  1. Technician opens FieldSignal mobile web view.
  2. Taps microphone floating action button (FAB).
  3. Speaks fault in Hindi/Hinglish/English (max 60 seconds).
  4. Taps stop or auto-stops after silence detection (or manual stop).
  5. Audio is buffered as `audio/webm` and streamed/uploaded to backend API.
- **Solar Field Considerations:** High ambient noise from inverter fans and wind. The UI must show a live visualizer (volume bar) indicating clear voice pickup.

### Feature 2: Gnani AI Speech-to-Text Pipeline
- **Description:** Converts field audio into high-fidelity transcripts with solar technical vocabulary.
- **Integration:**
  - Backend sends audio buffer to Gnani AI ASR endpoint.
  - Configured for multi-lingual Indian accents with model code-switching support (Hindi + English vocabulary).
  - Custom vocabulary boost provided to Gnani ASR: `SMB`, `SCB`, `Inverter`, `IGBT`, `Transformer`, `String`, `Megger`, `VOC`, `ISC`, `Earth fault`, `Isolator`, `Tracker`, `Pyranometer`, `HT Panel`, `Breaker`.
- **Output:** Raw transcript text + confidence score + detected primary language.

### Feature 3: AI Incident Extraction Layer
- **Description:** Transforms colloquial transcripts into normalized, machine-readable maintenance incidents.
- **Example:**
  - *Transcript:* "Bhai Block 2 me Inverter 5 subah se E-14 over-temp error de raha hai. Heat sink bahut garam hai, fan nahi ghum raha."
  - *Extracted JSON:*
    ```json
    {
      "asset_type": "INVERTER",
      "identified_asset_identifier": "INV-05",
      "block_identifier": "Block 2",
      "fault_category": "OVER_TEMPERATURE",
      "symptom": "Heat sink overheating, cooling fan not rotating",
      "error_code": "E-14",
      "severity": "HIGH",
      "immediate_action_taken": "None reported",
      "suggested_parts": ["Cooling fan", "Thermal paste"]
    }
    ```

### Feature 4: Validation Engine & Missing Field Prompts
- **Description:** Evaluates the extracted payload against the solar plant asset database and business rules.
- **Rule Set:**
  1. **Asset Exists:** Is the extracted asset tag (`INV-05` in `Block 2`) found in the database?
     - If multiple matches: Flag ambiguity (e.g., "Found INV-05 in Block 2A and Block 2B").
     - If not found: Flag as unrecognized asset tag.
  2. **Required Fields Check:**
     - Must have: Asset or Location, Fault Category, Symptom/Observation.
     - Inverter trips must request error code if omitted.
     - Module/String issues should check for string/row numbers.
  3. **Technician Prompt Generation:**
     - System builds a human-friendly Hindi/English prompt requesting missing info before finalization.

### Feature 5: Asset History & Repeat Fault Detection
- **Description:** Queries historical incidents for the identified asset over the last 30 days.
- **Logic:**
  - `SELECT * FROM incidents WHERE asset_id = :id AND created_at >= NOW() - INTERVAL '30 days'`
  - If count > 0:
    - Attach past incident summaries to the draft card.
    - If identical fault category within 7 days, elevate severity suggestion to `CRITICAL` or `HIGH` with a label: *"Repeat Fault: 2nd occurrence in 48 hours"*.

### Feature 6: Human-in-the-Loop Confirmation Screen
- **Description:** Crucial step ensuring AI never writes unverified hallucinations to the maintenance log.
- **Screen Components:**
  1. Audio playback widget (to verify what was spoken).
  2. Original transcript.
  3. Editable structured form (Asset dropdown pre-selected, Severity pill selector, Fault Category, Error Code text input, Description).
  4. Warning banner if missing fields or repeat fault detected.
  5. Action buttons: **"Confirm & Log Incident"** (Green) or **"Cancel / Re-record"** (Red).

### Feature 7: Operations Dashboard & Incident Lifecycle
- **Description:** Central hub for supervisors to manage tickets.
- **Capabilities:**
  - KPI Cards: Open Incidents, Critical/High Severity, Inverters Offline, Unassigned Tickets.
  - Live Table / Kanban Board: Filter by Block, Inverter, Severity, Status.
  - Assignment drawer: Assign incident to specific technician with target SLA.
  - Activity log: Full audit trail of voice transcript, edits, status transitions, supervisor notes, and closure timestamp.

---

## 5. Non-Functional Requirements (NFRs)

| Metric | Target | Rationale |
| :--- | :--- | :--- |
| **End-to-End Voice Processing Latency** | ≤ 4.5 seconds (Audio upload → Gnani ASR → LLM extraction → Draft UI) | Technicians standing in the sun will abandon the app if it hangs longer than 5 seconds. |
| **Audio File Size** | ≤ 300 KB for 30s audio (Opus 16-24 kbps) | Remote solar sites in Rajasthan/Gujarat/MP frequently operate on degraded 2G/3G networks. |
| **Offline Resilience** | Client-side local recording cache | If network drops mid-recording, audio is saved in browser IndexedDB/LocalStorage and queued for upload. |
| **Mobile UI Performance** | Lighthouse Mobile score ≥ 90; High contrast colors (WCAG AAA) | Must be legible under direct outdoor sunlight with glare. |
| **Data Integrity** | Strict Foreign Keys; Audit log of all state transitions | Maintenance records are audited during solar plant warranties and insurance claims. |
| **Security** | HTTPS/TLS 1.3, HttpOnly secure cookies, role authorization on every API endpoint | Prevent unauthorized tampering with plant equipment logs. |

---

## 6. Acceptance Criteria (Given-When-Then)

### AC-1: Voice Recording & Upload
- **Given** a technician is logged in and on the mobile interface,
- **When** they tap the microphone button and speak for 15 seconds, then tap stop,
- **Then** the browser records compressed audio, uploads it to `/api/v1/voice/process`, and displays a loading skeleton with "Analyzing speech...".

### AC-2: Multi-lingual Speech Recognition (Hinglish/Hindi)
- **Given** an audio file containing Hindi speech *"Inverter chaar over-temperature ki wajah se band pad gaya hai"*,
- **When** processed by Gnani AI,
- **Then** the transcript accurately outputs the text and feeds it to the AI extraction layer.

### AC-3: Structured Extraction & Asset Mapping
- **Given** a valid transcript mentioning an existing asset,
- **When** the LLM extraction runs,
- **Then** it returns structured JSON with `asset_id`, `fault_category`, `severity`, and `symptom` mapped according to predefined enums.

### AC-4: Missing Fields Warning
- **Given** a technician reports *"Tracker chal nahi raha hai"* without specifying the block or tracker motor ID,
- **When** the validation engine evaluates the draft,
- **Then** the confirmation screen highlights `asset_id` in amber and displays: *"Please specify the Tracker ID or Block number"*.

### AC-5: Asset Repeat Fault Warning
- **Given** `INV-02` had a fault logged 2 days ago with status `RESOLVED`,
- **When** a new fault is drafted for `INV-02`,
- **Then** the draft confirmation screen displays a prominent alert: *"Warning: INV-02 has 1 recent incident in the past 30 days"* with a link to view past incident notes.

### AC-6: Technician Confirmation & Ticket Creation
- **Given** a draft incident screen with pre-filled fields,
- **When** the technician reviews, adjusts the severity from `MEDIUM` to `HIGH`, and clicks "Confirm & Log Incident",
- **Then** the incident is persisted in the database with status `OPEN`, an audit record is created, and the technician is redirected to a success screen with the Ticket ID.

### AC-7: Supervisor Status Lifecycle Management
- **Given** an incident in status `OPEN`,
- **When** the supervisor assigns it to Technician "Rahul" and sets status to `ASSIGNED`,
- **Then** the incident status updates in the DB, timestamp is recorded, and the technician's view reflects the new assignment.
