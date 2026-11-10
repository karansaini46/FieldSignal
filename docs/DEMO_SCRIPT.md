# FieldSignal — Competition Demonstration Script

**Document Version:** 1.0.0 (Public Competition Demo)  
**Target Duration:** 3-Minute Lightning Pitch or 5-Minute Comprehensive Walkthrough  
**Site Setting:** Bhadla Solar Park - Sector IV (50 MW), Phalodi, Rajasthan  

---

## 🎭 Demonstration Personas & Test Credentials

All demonstration accounts use the password: `password123`  
(All accessible via 1-click **Quick-Login Demo Accounts** on `/login`)

| Role | Persona Name | Registered Mobile | Solar Site Context |
| :--- | :--- | :--- | :--- |
| **Field Technician** | **Rajesh Meena** | `+919876500002` | On-site at Block A, Bhadla Solar Park |
| **Site Supervisor** | **Vikramaditya Rathore** | `+919876500001` | Control Room, Bhadla Solar Park |

---

## ⏱️ Walkthrough Track A: 3-Minute Lightning Pitch

### [0:00 - 0:35] The Problem Under 45°C Desert Sunlight
- **Presenter says:**
  > *"Utility solar plants in Rajasthan span thousands of acres. Technicians like Rajesh walk 10 kilometers a day in 45-degree heat wearing protective gloves. When an inverter trips, they can't type English reports on a touchscreen under blinding glare. They drop blurry photos or vague voice notes on WhatsApp like 'Inverter trip ho gaya'. Hours are lost, critical error codes are missing, and solar generation is wasted.*
  > *This is FieldSignal: a voice-first maintenance intelligence platform that turns multi-lingual field speech into verified, audit-proof maintenance dispatch in under 4 seconds."*

### [0:35 - 1:30] Live Voice Reporting & Multilingual AI Extraction
- **Action:**
  1. Open `/login`, click the **Rajesh Meena (Technician)** quick-login card.
  2. Navigate to `/field` (Field Voice Console).
  3. Tap the **Microphone** button and speak naturally:
     > *"Bhai Block A me Inverter 1 subah se over-temperature error 204 de raha hai. Heat sink bahut garam hai, cooling fan nahi chal raha."*
     *(Alternatively, click the Quick Simulation Chip: `INV-01 Over-Temp Trip (Hindi)`)*.
  4. Tap **Stop Recording**.
- **Presenter highlights:**
  - *"Notice the live audio visualizer. The audio buffer is captured in browser WebM, transcoded, and streamed to Gnani AI's Vachana ASR engine using the prisma-v3.0 multilingual model."*
  - *"In less than 2 seconds, Gnani transcribes the Hindi-English code-switched speech verbatim. Google Gemini 1.5 Flash parses the transcript against our solar domain taxonomy."*

### [1:30 - 2:15] Deterministic Matching, Historical Intelligence & Explicit Confirmation
- **Action:**
  1. Show the **Technician Review & Confirmation Card**.
  2. Point to the **Deterministic Asset Match**: `INV-01` (Central Inverter 1, SMA 2.5MW) resolved from the database.
  3. Point to **Historical Incident Intelligence**:
     - *"Repeat Fault Alert: 3rd thermal incident in 30 days."*
     - Point to the **Root Cause Safety Disclaimer**: *"Notice: Description similarity does NOT imply identical root causes. Physical electrical testing required."*
  4. Show that the **Confirm & Submit Incident** button is strictly **disabled** until the explicit confirmation checkbox is ticked.
  5. Check the box and click **Confirm & Submit Incident**.
- **Presenter highlights:**
  - *"The original transcript is preserved permanently in the database. Notice the Gnani Timbre voice reading the confirmation receipt aloud for hands-free field feedback."*

### [2:15 - 3:00] Live Supervisor Operations Dispatch Dashboard
- **Action:**
  1. Open a new tab or click Logout, then click the **Vikramaditya Rathore (Supervisor)** quick-login card.
  2. Land on `/dashboard`.
  3. Point to the live counters: Open Incidents, Critical/High Priority, Inverters Offline.
  4. Point to the newly submitted ticket `INC-2026-0005` in the dispatch queue.
  5. Click into the ticket to reveal the **Immutable Audit Timeline** logging the technician's confirmation event.
- **Presenter concludes:**
  - *"Every metric on this screen is queried live from PostgreSQL—zero fake statistics. From spoken Hindi in the desert to an assigned work order in the control room in under 5 minutes. That is FieldSignal."*

---

## ⏱️ Walkthrough Track B: 5-Minute In-Depth Engineering Walkthrough

Use this script when judges ask technical follow-up questions regarding architecture, edge cases, and compliance.

### Scene 1: Multi-Tenant Site Isolation & Role-Based Access Control
- **Key Point:** Bhadla technician Rajesh cannot access or see Pavagada Solar Park assets or tickets.
- **Demo Step:**
  - Log in as Rajesh Meena (`+919876500002`).
  - Demonstrate that asset selectors and incident queries are strictly bounded to `siteId` (`Bhadla Solar Park Sector IV`).
  - Attempting to pass a foreign asset ID from Pavagada triggers an immediate `SITE_MISMATCH` rejection.

### Scene 2: Handling Unknown Assets & Ambiguity
- **Key Point:** FieldSignal **never hallucinates or guesses** equipment.
- **Demo Step:**
  - Speak or enter a non-existent asset tag: *"Inverter 9999 band pad gaya hai"*.
  - Show the validation result: `NO_MATCH`.
  - The system flags `needsClarification: true` and generates a focused question: *"Equipment tag INV-9999 was not found in Bhadla registry. Please select the correct inverter station."*

### Scene 3: Multi-Turn Focused Clarification Workflow
- **Key Point:** One focused question at a time; never repeats answered fields.
- **Demo Step:**
  - Speak: *"Tracker chal nahi raha hai"* (missing block, missing tracker ID).
  - Turn 1: Clarification engine asks specifically for the tracker identifier.
  - Technician answers: *"Tracker TR-04"*.
  - Turn 2: Updates extraction and automatically advances to the next missing field without repeating the tracker question.

### Scene 4: Historical Symptom Similarity vs. Root Cause Negative Invariant
- **Key Point:** Deterministic asset grouping + token-level Jaccard similarity.
- **Demo Step:**
  - Open an incident on `INV-01`.
  - Show the **Historical Intelligence Card**.
  - Show how previous thermal symptoms on `INV-01` are scored and grouped.
  - Explain the **hard architectural rule**: Even if two descriptions are 99% identical, the system labels them as *Similar reported symptom*, never as *Identical root cause*, protecting plant safety and warranty audits.

### Scene 5: Gnani AI Timbre Text-to-Speech (Optional Audio Feedback)
- **Key Point:** Spoken status feedback that is completely non-blocking.
- **Demo Step:**
  - Click the **Listen (Timbre TTS)** button on an incident confirmation or status update.
  - Audio plays cleanly via server-side synthesis (`timbre-v3.0`).
  - Mute or disable TTS; show that the entire workflow remains 100% usable without audio.

### Scene 6: Concurrency, Idempotency & Database Audit Trail
- **Key Point:** ACID transaction safety in remote, flaky network conditions.
- **Demo Step:**
  - If a technician clicks "Confirm & Submit" multiple times on a spotty 2G connection, the 15-minute idempotency window catches the duplicate payload.
  - The API returns HTTP 200 with the existing ticket ID rather than creating duplicate tickets.
  - The **Incident Timeline** displays the immutable `CONFIRMATION` event with user ID, timestamp, and field patch diff.

---

## 🛡️ Fail-Safe Demonstration Backup Plan

If venue Wi-Fi becomes unstable or the microphone is muted by the operating system:

1. **Microphone Mute Fallback:**
   - On `/field`, click any of the **Quick Audio Simulation Chips**:
     - `INV-01 Over-Temp Trip (Hindi)`
     - `SCB-04 String Blown Fuse (Hinglish)`
     - `Transformer TR-01 Low Pressure (English)`
   - This loads verified field recordings and real transcripts instantly.
2. **Offline Network Simulation:**
   - Open Chrome DevTools → Network → Toggle "Slow 3G".
   - Demonstrate the client-side audio payload validation and timeout resilience.
3. **Automated Verification Terminal:**
   - Keep a split terminal open with `npm run test:unit`.
   - Run `npm run test:unit` in 2.6 seconds to demonstrate 40/40 passing tests live to judges.
