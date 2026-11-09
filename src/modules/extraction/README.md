# FieldSignal Incident Extraction Engine

The **Incident Extraction Engine** converts technician voice transcripts (in English, Hindi, or Hinglish) into structured, audit-ready incident reports adhering strictly to plant safety standards and database schemas.

---

## 1. Architecture & Pipeline

```
[Voice Note / Spoken Audio]
       │
       ▼ (Gnani AI ASR)
[Raw Spoken Transcript]
       │
       ▼ (Context Enrichment)
[Site Assets + Incident History]
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│                 Incident Extraction Engine                  │
│                                                             │
│  1. Generative AI (Gemini 1.5/2.0) with Structured Output   │
│     └── Fallback: Deterministic Solar Heuristic Engine      │
│                                                             │
│  2. Programmatic Integrity Guardrails Enforcement           │
│     ├── Zero-Hallucination Asset Code Filter                │
│     ├── Verbatim Alarm Verification                         │
│     ├── Strict Repair Action Gate                           │
│     └── Reported vs. Inferred Data Separation               │
│                                                             │
│  3. Zod Schema Validation (`extractedIncidentSchema`)       │
│                                                             │
│  4. Clarification Evaluator (`needsClarification`)          │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
[Structured JSON Incident Object]
```

---

## 2. Input Specifications

The engine accepts a structured `ExtractionInput`:

```typescript
export interface ExtractionInput {
  /** Raw audio transcript from field technician */
  transcript: string;
  /** Site facility where the incident occurred */
  site: SiteContext;
  /** Pre-selected asset (if technician pre-chose one), or null */
  selectedAsset?: AssetContext | null;
  /** Inventory of valid assets on this site for cross-referencing */
  knownSiteAssets?: KnownAssetSummary[];
  /** Historical incidents for repeat fault and recurrence analysis */
  previousIncidents?: PreviousIncidentSummary[];
}
```

---

## 3. Output Specifications

The engine produces a validated `ExtractedIncident` conforming to `extractedIncidentSchema`:

- **`assetCode`** (`string | null`): Validated asset tag matching site inventory, or `null`.
- **`matchedAssetId`** (`string | null`): Database UUID of the verified asset, or `null`.
- **`equipmentType`** (`INVERTER | SOLAR_MODULE | COMBINER_BOX | TRANSFORMER | OTHER | UNKNOWN`): Equipment classification.
- **`faultDescription`** (`string`): Factual summary based strictly on reported observations.
- **`reportedAlarm`** (`string | null`): Exact error/alarm code stated by technician, or `null`.
- **`symptoms`** (`string[]`): Observable physical or electrical anomalies reported.
- **`actionsAlreadyTaken`** (`string | null`): Actions explicitly taken by technician, or `null`.
- **`recurrenceMentioned`** (`boolean`): Whether repeat occurrence was stated.
- **`suggestedPriority`** (`CRITICAL | HIGH | MEDIUM | LOW`): Intelligent priority recommendation.
- **`faultCategory`** (`FaultCategory`): Categorized solar plant fault.
- **`missingInformation`** (`string[]`): Crucial missing telemetry or identifiers.
- **`clarificationQuestion`** (`string | null`): Actionable question to ask technician when information is missing.
- **`extractionConfidence`** (`number`): Extraction certainty between 0.0 and 1.0.
- **`needsClarification`** (`boolean`): Flag marking incomplete reports.
- **`suggestedStatus`** (`"NEEDS_CLARIFICATION" | "DRAFT"`): Initial ticket lifecycle status.
- **`details`**: Segregated container isolating `reported` facts from `inferred` technical assessments.

---

## 4. Critical Negative Constraints

1. **Never Invent an Asset ID / Code**:
   - The engine will **never** guess or hallucinate an asset tag.
   - If the technician says *"an inverter is smoking"* without specifying which one (e.g. `INV-01`), `assetCode` is set to `null`, `needsClarification` is set to `true`, and a clarification question is posed: *"Which specific inverter tag at Bhadla is experiencing this issue?"*.

2. **Never Invent an Alarm Code**:
   - `reportedAlarm` is populated **only** if the technician explicitly speaks an error code (e.g. `E-402`, `F-014`).
   - If not mentioned in the transcript, `reportedAlarm` is strictly `null`.

3. **Never Invent a Repair Action**:
   - `actionsAlreadyTaken` is populated **only** if the technician explicitly reports an action (e.g. *"DC switch isolate kar diya"*, *"emergency stop triggered"*).
   - If no action was reported, `actionsAlreadyTaken` is strictly `null`.

4. **Never Claim a Root Cause Without Evidence**:
   - The engine documents symptoms as facts (e.g., *"grinding sound from blower"*). It never speculates on unevidenced causes (e.g. *"bearing failure due to lack of grease"*).

5. **Distinguish Reported from Inferred Information**:
   - `details.reported`: Verbatim observations, alarms, spoken codes.
   - `details.inferred`: Model-calculated classifications, priority reasoning, and category mappings.

6. **Use UNKNOWN or null When Information is Unavailable**:
   - Undetermined equipment type defaults to `"UNKNOWN"`. Missing codes default to `null`.

---

## 5. Failure Cases & Fallback Matrix

| Scenario / Symptom | Extraction Behavior | Resulting Status | Clarification Question |
| :--- | :--- | :--- | :--- |
| **No Asset Tag Spoken** (e.g. *"Inverter mein overtemp alarm hai"*) | `assetCode = null`, `missingInformation` includes asset tag | `NEEDS_CLARIFICATION` | *"Which specific solar asset (e.g. INV-01, SCB-04) at Bhadla is experiencing this issue?"* |
| **Ambiguous / Non-Existent Asset** (e.g. *"INV-9999 is down"*) | Tag not in `knownSiteAssets` -> rejected to `null` | `NEEDS_CLARIFICATION` | Poses asset identification question to technician. |
| **No Alarm Code Mentioned** | `reportedAlarm = null`. If symptoms exist, report is valid. | `DRAFT` | None (alarm code is optional). |
| **No Symptoms Spoken** (e.g. *"I am standing near INV-01"*) | `symptoms = []`, `missingInformation` includes symptoms/alarms | `NEEDS_CLARIFICATION` | *"What error code or specific symptoms were observed on the equipment?"* |
| **Silent or Inaudible Audio** | Handled before extraction by speech validator (`isEmptyTranscript`). | Rejected early | *"No human speech detected in recording. Please re-record."* |
| **Gemini AI API Network Outage / Placeholder Key** | Programmatic fallback to `DeterministicExtractionEngine`. | Continuous Operation | Deterministic rule-based extraction with exact guardrail compliance. |

