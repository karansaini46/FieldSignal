import { FaultCategory, IncidentPriority, AssetType } from "@prisma/client";
import { ExtractionInput, ExtractedIncident, EquipmentType } from "./types";
import {
  DeterministicAssetMatcher,
  MatchedAssetCandidate,
} from "@/modules/assets/asset-matcher";
import {
  detectContradictoryFields,
  validateEquipmentType,
} from "@/modules/incidents/incident-validator";

/**
 * Deterministic Extraction Engine.
 * Employs domain-specific solar heuristics, regex patterns, and exact database asset-tag matching.
 * Strictly adheres to all negative constraints: zero hallucinated IDs, zero invented alarms,
 * zero fabricated repair actions, explicit distinction between reported vs inferred data,
 * and preservation of the original voice transcript.
 */
export class DeterministicExtractionEngine {
  private readonly assetMatcher: DeterministicAssetMatcher;

  constructor() {
    this.assetMatcher = new DeterministicAssetMatcher();
  }

  public extract(input: ExtractionInput): ExtractedIncident {
    const { transcript, selectedAsset, knownSiteAssets, previousIncidents, site } = input;
    const cleanText = transcript.trim();
    const lower = cleanText.toLowerCase();

    // 1. Asset Tag Resolution using DeterministicAssetMatcher
    const siteAssets: MatchedAssetCandidate[] = (knownSiteAssets || []).map((a) => ({
      id: a.id,
      assetTag: a.assetTag,
      name: a.name,
      assetType: a.assetType as AssetType,
      block: a.block || null,
      row: a.row || null,
      model: a.model || null,
      siteId: site.id,
      confidence: 0,
      matchReason: "",
    }));

    const matchResult = this.assetMatcher.matchAsset(
      {
        transcript: cleanText,
        selectedAssetId: selectedAsset?.id,
      },
      {
        siteId: site.id,
        siteName: site.name,
        siteAssets,
      }
    );

    let resolvedAssetTag: string | null = null;
    let matchedAssetId: string | null = null;
    let spokenTag: string | null = matchResult.extractedCode;
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
      resolvedAssetTag = matchResult.matchedAsset.assetTag;
      matchedAssetId = matchResult.matchedAsset.id;
      requiresManualSelection = false;
    } else if (matchResult.status === "AMBIGUOUS_MATCH") {
      // NEVER silently select an unrelated or ambiguous asset
      resolvedAssetTag = null;
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
    } else if (matchResult.status === "NO_MATCH" || matchResult.status === "SITE_MISMATCH") {
      // Reject unknown or cross-site asset references
      resolvedAssetTag = null;
      matchedAssetId = null;
      requiresManualSelection = true;
    } else {
      // NO_REFERENCE
      resolvedAssetTag = null;
      matchedAssetId = null;
      requiresManualSelection = true;
    }

    // 2. Equipment Type Resolution
    let equipmentType: EquipmentType = "UNKNOWN";
    if (selectedAsset?.assetType) {
      equipmentType = selectedAsset.assetType as EquipmentType;
    } else if (matchedAssetId && matchResult.matchedAsset) {
      equipmentType = matchResult.matchedAsset.assetType as EquipmentType;
    } else {
      if (/\b(inverter|igbt|inverter blower|heatsink)\b/i.test(lower)) {
        equipmentType = "INVERTER";
      } else if (/\b(combiner|scb|smb|junction box|string combiner)\b/i.test(lower)) {
        equipmentType = "COMBINER_BOX";
      } else if (/\b(transformer|step up|substation|vcb|ht panel)\b/i.test(lower)) {
        equipmentType = "TRANSFORMER";
      } else if (/\b(module|panel|pv string|pv module|solar panel)\b/i.test(lower)) {
        equipmentType = "SOLAR_MODULE";
      } else if (/\b(tracker|slew drive|inclinometer|motor|sensor)\b/i.test(lower)) {
        equipmentType = "TRACKER";
      } else if (/\b(battery|bess|storage|cell)\b/i.test(lower)) {
        equipmentType = "BATTERY_STORAGE";
      } else if (/\b(weather|pyranometer|anemometer)\b/i.test(lower)) {
        equipmentType = "WEATHER_STATION";
      }
    }

    // Validate equipment type against matched asset type
    const equipValidation = validateEquipmentType(
      equipmentType,
      matchResult.matchedAsset?.assetType
    );
    if (equipValidation.canonicalType && equipValidation.canonicalType !== "UNKNOWN") {
      equipmentType = equipValidation.canonicalType as EquipmentType;
    }

    // 3. Reported Alarm / Error Code Extraction (DO NOT INVENT)
    let reportedAlarm: string | null = null;
    const alarmMatch = cleanText.match(
      /\b(?:error(?: code)?|alarm(?: code)?|code)?\s*([eEfFwW][-\s]?\d{1,4}|err[-\s]?\d{1,4})\b/i
    );
    if (alarmMatch && alarmMatch[1]) {
      reportedAlarm = alarmMatch[1].toUpperCase().replace(/\s+/, "-");
    }

    // 4. Symptoms Extraction
    const symptoms: string[] = [];
    if (/smoke|dhuan|fire|aag|spark|sparking|jal gaya/i.test(lower)) {
      symptoms.push("Visible smoke, fire, or arc sparking");
    }
    if (/over-temp|overtemp|temperature|overheating|heat|garam|garm/i.test(lower)) {
      symptoms.push("Thermal overload / High temperature");
    }
    if (/trip|tripped|band ho gaya|shut down|off/i.test(lower)) {
      symptoms.push("Equipment trip / automatic shutdown");
    }
    if (/noise|sound|screeching|grinding|awaz|awaaz|vibration/i.test(lower)) {
      symptoms.push("Abnormal mechanical grinding sound or vibration");
    }
    if (/fan|blower|cooling/i.test(lower)) {
      symptoms.push("Cooling fan / airflow failure");
    }
    if (/insulation|earth fault|ground fault/i.test(lower)) {
      symptoms.push("Insulation breakdown / Earth fault");
    }
    if (/fuse|fuse blown|ud gaya/i.test(lower)) {
      symptoms.push("Blown fuse / open circuit");
    }

    // 5. Actions Already Taken Extraction (DO NOT INVENT)
    let actionsAlreadyTaken: string | null = null;
    const actionMatches: string[] = [];
    if (/isolated|isolate kiya|band kiya|dc disconnect|loto|lock out/i.test(lower)) {
      actionMatches.push("DC switch isolated / LOTO protocol initiated");
    }
    if (/emergency stop|e-stop|trip dabaya/i.test(lower)) {
      actionMatches.push("Emergency stop button triggered");
    }
    if (/fire extinguisher|extinguisher chalaya/i.test(lower)) {
      actionMatches.push("Fire extinguisher deployed");
    }
    if (/reset kiya|reset try kiya|restart kiya/i.test(lower)) {
      actionMatches.push("System reset attempt executed");
    }
    if (actionMatches.length > 0) {
      actionsAlreadyTaken = actionMatches.join("; ");
    }

    // 6. Recurrence Mentioned
    const recurrenceMentioned =
      /\b(phir se|phir|repeat|again|previously|kal bhi|recurring|doobara|dubara)\b/i.test(lower);

    // 7. Fault Category Inferred
    let faultCategory: FaultCategory = FaultCategory.OTHER;
    if (/smoke|fire|aag|spark|arc/i.test(lower)) {
      faultCategory = FaultCategory.DC_ARC_FIRE;
    } else if (/over-temp|overheating|blower|cooling fan/i.test(lower)) {
      faultCategory = FaultCategory.OVER_TEMPERATURE;
    } else if (/earth fault|ground fault/i.test(lower)) {
      faultCategory = FaultCategory.EARTH_FAULT;
    } else if (/insulation/i.test(lower)) {
      faultCategory = FaultCategory.INSULATION_FAILURE;
    } else if (/grid trip|frequency|voltage fluctuation/i.test(lower)) {
      faultCategory = FaultCategory.GRID_TRIP;
    } else if (/tracker|slew drive/i.test(lower)) {
      faultCategory = FaultCategory.TRACKER_FAILURE;
    } else if (/fuse|blown/i.test(lower)) {
      faultCategory = FaultCategory.FUSE_BLOWN;
    } else if (/scada|communication|no signal|telemetry/i.test(lower)) {
      faultCategory = FaultCategory.COMMUNICATION_LOSS;
    }

    // 8. Priority Suggestion
    const priorityReasoning: string[] = [];
    let suggestedPriority: IncidentPriority = IncidentPriority.MEDIUM;

    if (faultCategory === FaultCategory.DC_ARC_FIRE || /fire|smoke|blast/i.test(lower)) {
      suggestedPriority = IncidentPriority.CRITICAL;
      priorityReasoning.push("Safety or thermal hazard detected in observations");
    } else if (
      faultCategory === FaultCategory.OVER_TEMPERATURE ||
      faultCategory === FaultCategory.EARTH_FAULT ||
      equipmentType === "INVERTER" ||
      equipmentType === "TRANSFORMER"
    ) {
      suggestedPriority = IncidentPriority.HIGH;
      priorityReasoning.push(`High impact fault on critical equipment (${equipmentType})`);
    } else if (faultCategory === FaultCategory.FUSE_BLOWN) {
      suggestedPriority = IncidentPriority.LOW;
      priorityReasoning.push("Localized component fault (blown fuse)");
    }

    if (recurrenceMentioned) {
      priorityReasoning.push("Technician noted fault is a repeat/recurring issue");
      if (suggestedPriority === IncidentPriority.MEDIUM) suggestedPriority = IncidentPriority.HIGH;
      else if (suggestedPriority === IncidentPriority.HIGH) suggestedPriority = IncidentPriority.CRITICAL;
    }

    if (previousIncidents && previousIncidents.length >= 2) {
      priorityReasoning.push(`Asset has ${previousIncidents.length} prior incidents recorded`);
      if (suggestedPriority !== IncidentPriority.CRITICAL) {
        suggestedPriority = IncidentPriority.HIGH;
      }
    }

    // 9. Missing Information & Clarification Handling
    const missingInformation: string[] = [];
    let clarificationQuestion: string | null = null;
    let needsClarification = false;

    if (!resolvedAssetTag) {
      if (isAmbiguous) {
        missingInformation.push("Specific asset tag (ambiguous match among site assets)");
      } else {
        missingInformation.push("Specific asset tag / equipment identifier");
      }
      needsClarification = true;
      clarificationQuestion = matchResult.clarificationPrompt;
    }

    if (symptoms.length === 0 && !reportedAlarm) {
      missingInformation.push("Specific fault symptoms or error codes");
      needsClarification = true;
      if (!clarificationQuestion) {
        clarificationQuestion = "What specific error code or symptoms are visible on the equipment display?";
      }
    }

    const suggestedStatus: "NEEDS_CLARIFICATION" | "DRAFT" = needsClarification
      ? "NEEDS_CLARIFICATION"
      : "DRAFT";

    // 10. Fault Description (Purely factual, no speculation)
    const equipmentLabel = resolvedAssetTag || (equipmentType !== "UNKNOWN" ? equipmentType : "Equipment");
    const symptomSummary = symptoms.length > 0 ? symptoms.join(", ") : "Operational anomaly observed";
    const alarmSummary = reportedAlarm ? ` with alarm ${reportedAlarm}` : "";
    const faultDescription = `${equipmentLabel}: ${symptomSummary}${alarmSummary}.`;

    // 11. Contradictions Check
    const rawContradictions = detectContradictoryFields({
      assetId: matchedAssetId,
      assetCode: resolvedAssetTag,
      matchedAsset: matchResult.matchedAsset,
      equipmentType,
      title: `${equipmentLabel}: ${symptomSummary}`,
      description: faultDescription,
      symptoms: symptoms.join(", "),
      errorCode: reportedAlarm,
      priority: suggestedPriority,
      faultCategory,
      originalTranscript: cleanText,
    });

    const contradictions = rawContradictions.map((c) => ({
      fieldA: c.fieldA,
      fieldB: c.fieldB,
      severity: c.severity,
      code: c.code,
      message: c.message,
      resolution: c.resolution,
    }));

    // 12. Confidence scoring
    let extractionConfidence = 0.88;
    if (resolvedAssetTag) extractionConfidence += 0.05;
    if (reportedAlarm) extractionConfidence += 0.05;
    if (needsClarification) extractionConfidence -= 0.15;
    if (isAmbiguous) extractionConfidence = 0.5;
    extractionConfidence = Math.min(0.98, Math.max(0.4, extractionConfidence));

    return {
      assetCode: resolvedAssetTag,
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
      clarificationQuestion,
      extractionConfidence,
      needsClarification,
      suggestedStatus,
      details: {
        reported: {
          rawObservations: symptoms,
          statedAlarmCode: reportedAlarm,
          statedActions: actionsAlreadyTaken,
          spokenAssetCode: spokenTag,
        },
        inferred: {
          inferredEquipmentType: equipmentType,
          inferredFaultCategory: faultCategory,
          priorityReasoning,
        },
      },
      isAmbiguous,
      candidateAssets,
      requiresManualSelection,
      contradictions,
      originalTranscript: cleanText,
    };
  }
}
