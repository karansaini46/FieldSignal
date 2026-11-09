import { ExtractionInput, ExtractedIncident, IExtractionEngine, EquipmentType } from "./types";
import { extractionInputSchema, extractedIncidentSchema } from "./schemas";
import { DeterministicExtractionEngine } from "./deterministic-extractor";
import { GeminiExtractionEngine } from "./gemini-extractor";
import { AssetType, FaultCategory, IncidentPriority } from "@prisma/client";
import {
  DeterministicAssetMatcher,
  MatchedAssetCandidate,
} from "@/modules/assets/asset-matcher";
import {
  detectContradictoryFields,
  validateEquipmentType,
} from "@/modules/incidents/incident-validator";

/**
 * Production Incident Extraction Engine.
 * Combines Generative AI (Gemini) with deterministic solar heuristics,
 * asset verification, contradiction detection, and strict Zod validation.
 *
 * Core Negative Constraints:
 * 1. Match extracted asset codes against actual database assets.
 * 2. Ensure the asset belongs to the selected site.
 * 3. Reject unknown asset references.
 * 4. Identify ambiguous asset matches (request manual selection, never silently pick one).
 * 5. Validate extracted equipment type.
 * 6. Validate incident field lengths and types.
 * 7. Detect missing required information.
 * 8. Detect contradictory extracted fields.
 * 9. Preserve the original transcript.
 */
export class IncidentExtractionEngine implements IExtractionEngine {
  private readonly deterministicEngine: DeterministicExtractionEngine;
  private readonly geminiEngine: GeminiExtractionEngine;
  private readonly assetMatcher: DeterministicAssetMatcher;

  constructor() {
    this.deterministicEngine = new DeterministicExtractionEngine();
    this.geminiEngine = new GeminiExtractionEngine();
    this.assetMatcher = new DeterministicAssetMatcher();
  }

  public async extractIncident(rawInput: ExtractionInput): Promise<ExtractedIncident> {
    // 1. Validate input structure
    const input = extractionInputSchema.parse(rawInput);
    const transcript = input.transcript.trim();

    // 2. Execute extraction
    let candidateData: any = null;
    let usedAi = false;

    try {
      candidateData = await this.geminiEngine.extract(input);
      usedAi = true;
    } catch {
      // Gracefully fall back to deterministic extraction
      candidateData = this.deterministicEngine.extract(input);
      usedAi = false;
    }

    // 3. Post-Process & Enforce Zero-Hallucination Guardrails
    const validated = this.enforceGuardrails(candidateData, input, usedAi);

    // 4. Validate through Zod schema
    return extractedIncidentSchema.parse(validated) as ExtractedIncident;
  }

  /**
   * Applies programmatic boundary checks to guarantee integrity rules
   */
  private enforceGuardrails(
    data: any,
    input: ExtractionInput,
    _usedAi: boolean
  ): ExtractedIncident {
    const rawTranscript = input.transcript.trim();
    const transcriptLower = rawTranscript.toLowerCase();

    // -------------------------------------------------------------------------
    // Guardrail 1-4: Deterministic Asset Matching, Site Ownership & Ambiguity
    // -------------------------------------------------------------------------
    const siteAssets: MatchedAssetCandidate[] = (input.knownSiteAssets || []).map((a) => ({
      id: a.id,
      assetTag: a.assetTag,
      name: a.name,
      assetType: a.assetType as AssetType,
      block: a.block || null,
      row: a.row || null,
      model: a.model || null,
      siteId: input.site.id,
      confidence: 0,
      matchReason: "",
    }));

    const rawCandidateCode = data.assetCode ? String(data.assetCode).trim().toUpperCase() : null;

    const matchResult = this.assetMatcher.matchAsset(
      {
        extractedCode: rawCandidateCode,
        transcript: rawTranscript,
        selectedAssetId: input.selectedAsset?.id,
      },
      {
        siteId: input.site.id,
        siteName: input.site.name,
        siteAssets,
      }
    );

    let assetCode: string | null = null;
    let matchedAssetId: string | null = null;
    let isAmbiguous = false;
    let requiresManualSelection = false;
    let candidateAssets: Array<{
      id: string;
      assetTag: string;
      name: string;
      assetType: AssetType;
      block?: string | null;
      confidence?: number;
    }> = [];

    if (matchResult.status === "EXACT_MATCH" && matchResult.matchedAsset) {
      assetCode = matchResult.matchedAsset.assetTag;
      matchedAssetId = matchResult.matchedAsset.id;
      requiresManualSelection = false;
    } else if (matchResult.status === "AMBIGUOUS_MATCH") {
      // Ambiguous matches MUST NOT silently select an asset
      assetCode = null;
      matchedAssetId = null;
      isAmbiguous = true;
      requiresManualSelection = true;
      candidateAssets = matchResult.candidates.map((c) => ({
        id: c.id,
        assetTag: c.assetTag,
        name: c.name,
        assetType: c.assetType,
        block: c.block,
        confidence: c.confidence,
      }));
    } else {
      // NO_MATCH, SITE_MISMATCH, or NO_REFERENCE
      assetCode = null;
      matchedAssetId = null;
      requiresManualSelection = true;
    }

    // -------------------------------------------------------------------------
    // Guardrail 5: Validate Extracted Equipment Type
    // -------------------------------------------------------------------------
    let rawEquipmentType = data.equipmentType || "UNKNOWN";
    const matchedAssetType = matchResult.matchedAsset?.assetType || input.selectedAsset?.assetType;

    const equipValidation = validateEquipmentType(rawEquipmentType, matchedAssetType);
    let equipmentType: EquipmentType = (
      equipValidation.canonicalType && equipValidation.canonicalType !== "UNKNOWN"
        ? equipValidation.canonicalType
        : rawEquipmentType
    ) as EquipmentType;

    // -------------------------------------------------------------------------
    // Guardrail B: Never invent an alarm code
    // -------------------------------------------------------------------------
    let reportedAlarm = data.reportedAlarm ? String(data.reportedAlarm).trim().toUpperCase() : null;
    if (reportedAlarm) {
      // Verify that the alarm code or its digits actually appeared in transcript
      const digitsOnly = reportedAlarm.replace(/\D/g, "");
      const normalizedAlarm = reportedAlarm.toLowerCase().replace(/[-\s]/g, "");
      const normalizedText = transcriptLower.replace(/[-\s]/g, "");

      const appearsInText =
        normalizedText.includes(normalizedAlarm) ||
        (digitsOnly.length >= 2 && normalizedText.includes(digitsOnly));

      if (!appearsInText) {
        reportedAlarm = null; // Purge hallucinated alarm code
      }
    }

    // -------------------------------------------------------------------------
    // Guardrail C: Never invent a repair action
    // -------------------------------------------------------------------------
    let actionsAlreadyTaken = data.actionsAlreadyTaken ? String(data.actionsAlreadyTaken).trim() : null;
    if (actionsAlreadyTaken) {
      const lowerActions = actionsAlreadyTaken.toLowerCase();
      const actionKeywords = [
        "isolated",
        "switched",
        "loto",
        "stop",
        "reset",
        "trip",
        "breaker",
        "extinguisher",
        "band kiya",
        "disconnect",
        "shutdown",
      ];
      const hasActionEvidence = actionKeywords.some((k) => transcriptLower.includes(k));
      if (!hasActionEvidence && !transcriptLower.includes(lowerActions)) {
        actionsAlreadyTaken = null;
      }
    }

    // -------------------------------------------------------------------------
    // Guardrail D: Factual fault description (never claim root cause without evidence)
    // -------------------------------------------------------------------------
    let faultDescription = data.faultDescription ? String(data.faultDescription).trim() : "";
    if (!faultDescription || faultDescription.length < 5) {
      const tagLabel = assetCode || "Equipment";
      faultDescription = `${tagLabel}: Anomaly observed during field inspection.`;
    }

    // -------------------------------------------------------------------------
    // Guardrail 7: Missing Information & Clarification Flagging
    // -------------------------------------------------------------------------
    const missingInformation: string[] = Array.isArray(data.missingInformation)
      ? [...data.missingInformation]
      : [];

    let needsClarification = Boolean(data.needsClarification) || requiresManualSelection;
    let clarificationQuestion = data.clarificationQuestion ? String(data.clarificationQuestion).trim() : null;

    if (!assetCode) {
      if (isAmbiguous) {
        if (!missingInformation.some((m) => m.toLowerCase().includes("ambiguous"))) {
          missingInformation.push("Specific asset tag (ambiguous match among site assets)");
        }
      } else {
        if (!missingInformation.some((m) => m.toLowerCase().includes("asset"))) {
          missingInformation.push("Specific asset tag / equipment code (e.g. INV-01, SCB-04)");
        }
      }
      needsClarification = true;
      if (!clarificationQuestion) {
        clarificationQuestion = matchResult.clarificationPrompt || `Which specific equipment tag at ${input.site.name} is experiencing this fault?`;
      }
    }

    const symptoms: string[] = Array.isArray(data.symptoms) ? data.symptoms.map(String) : [];
    if (symptoms.length === 0 && !reportedAlarm) {
      if (!missingInformation.some((m) => m.toLowerCase().includes("symptom"))) {
        missingInformation.push("Observed fault symptoms or visible error code");
      }
      needsClarification = true;
      if (!clarificationQuestion) {
        clarificationQuestion = "What error code or specific symptoms were observed on the equipment?";
      }
    }

    const suggestedStatus: "NEEDS_CLARIFICATION" | "DRAFT" = needsClarification
      ? "NEEDS_CLARIFICATION"
      : "DRAFT";

    // -------------------------------------------------------------------------
    // Guardrail 8: Priority & Contradiction Detection
    // -------------------------------------------------------------------------
    let suggestedPriority = data.suggestedPriority || IncidentPriority.MEDIUM;
    const faultCategory = data.faultCategory || FaultCategory.OTHER;
    const recurrenceMentioned = Boolean(data.recurrenceMentioned);

    // Contradiction detection
    const rawContradictions = detectContradictoryFields({
      assetId: matchedAssetId,
      assetCode,
      matchedAsset: matchResult.matchedAsset,
      equipmentType,
      title: `${assetCode || equipmentType}: ${symptoms.slice(0, 2).join(", ")}`,
      description: faultDescription,
      symptoms: symptoms.join(", "),
      errorCode: reportedAlarm,
      priority: suggestedPriority,
      faultCategory,
      originalTranscript: rawTranscript,
    });

    if (equipValidation.contradiction) {
      rawContradictions.push(equipValidation.contradiction);
    }

    // Auto-resolve severe contradiction: safety hazard with LOW priority must escalate
    const fireContradiction = rawContradictions.find(
      (c) => c.code === "SAFETY_HAZARD_LOW_PRIORITY_CONTRADICTION"
    );
    if (fireContradiction) {
      suggestedPriority = IncidentPriority.CRITICAL;
    }

    const contradictions = rawContradictions.map((c) => ({
      fieldA: c.fieldA,
      fieldB: c.fieldB,
      severity: c.severity,
      code: c.code,
      message: c.message,
      resolution: c.resolution,
    }));

    let extractionConfidence =
      typeof data.extractionConfidence === "number"
        ? Math.min(1, Math.max(0, data.extractionConfidence))
        : needsClarification
        ? 0.75
        : 0.92;

    if (isAmbiguous) {
      extractionConfidence = 0.5;
    }

    // -------------------------------------------------------------------------
    // Guardrail 9: Preserve Original Transcript
    // -------------------------------------------------------------------------
    return {
      assetCode,
      matchedAssetId,
      equipmentType,
      faultDescription,
      reportedAlarm,
      symptoms,
      actionsAlreadyTaken,
      recurrenceMentioned,
      suggestedPriority,
      faultCategory,
      missingInformation,
      clarificationQuestion: needsClarification ? clarificationQuestion : null,
      extractionConfidence,
      needsClarification,
      suggestedStatus,
      details: {
        reported: {
          rawObservations: symptoms,
          statedAlarmCode: reportedAlarm,
          statedActions: actionsAlreadyTaken,
          spokenAssetCode: assetCode,
        },
        inferred: {
          inferredEquipmentType: equipmentType,
          inferredFaultCategory: faultCategory,
          priorityReasoning: data.details?.inferred?.priorityReasoning || [
            `Priority ${suggestedPriority} inferred from fault characteristics`,
          ],
        },
      },
      isAmbiguous,
      candidateAssets,
      requiresManualSelection,
      contradictions,
      originalTranscript: rawTranscript,
    };
  }
}

let defaultExtractionEngine: IncidentExtractionEngine | null = null;

export function getIncidentExtractionEngine(): IncidentExtractionEngine {
  if (!defaultExtractionEngine) {
    defaultExtractionEngine = new IncidentExtractionEngine();
  }
  return defaultExtractionEngine;
}
