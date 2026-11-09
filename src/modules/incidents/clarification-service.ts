import { AssetType, FaultCategory, IncidentPriority } from "@prisma/client";
import { ExtractedIncident, EquipmentType } from "@/modules/extraction/types";
import {
  DeterministicAssetMatcher,
  MatchedAssetCandidate,
} from "@/modules/assets/asset-matcher";
import {
  IncidentValidationService,
  IncidentValidationReport,
} from "./incident-validator";

export type MissingFieldKey =
  | "asset"
  | "alarm_code"
  | "current_status"
  | "repair_result"
  | "symptoms";

export interface ClarificationItem {
  id?: string;
  field: MissingFieldKey;
  question: string;
  response?: string | null;
  status: "PENDING" | "RESOLVED" | "DISMISSED";
  createdAt: Date | string;
  respondedAt?: Date | string | null;
  fromVoice?: boolean;
}

export interface ClarificationEvaluation {
  missingFields: MissingFieldKey[];
  currentQuestion: ClarificationItem | null;
  isComplete: boolean;
  clarificationHistory: ClarificationItem[];
}

export interface ClarificationInputData {
  transcript?: string | null;
  originalTranscript?: string | null;
  assetCode?: string | null;
  matchedAssetId?: string | null;
  reportedAlarm?: string | null;
  symptoms?: string[];
  actionsAlreadyTaken?: string | null;
  description?: string | null;
  equipmentType?: string | null;
  currentStatus?: string | null;
  operationalStatus?: string | null;
}

export interface ProcessClarificationParams {
  field: MissingFieldKey;
  response: string;
  fromVoice?: boolean;
  currentExtraction: ExtractedIncident;
  history?: ClarificationItem[];
  siteContext: {
    id: string;
    name: string;
    siteAssets: MatchedAssetCandidate[];
  };
}

export interface ProcessClarificationResult {
  updatedExtraction: ExtractedIncident;
  history: ClarificationItem[];
  nextQuestion: ClarificationItem | null;
  isComplete: boolean;
  validationReport: IncidentValidationReport;
}

/**
 * Extracts normalized alphanumeric alarm code from technician input.
 * e.g. "it shows code E-402 on the display" -> "E-402"
 */
export function extractAlarmCodeFromText(text: string): string | null {
  const clean = text.trim();
  const match = clean.match(
    /\b(?:error(?: code)?|alarm(?: code)?|code)?\s*([eEfFwW][-\s]?\d{1,4}|err[-\s]?\d{1,4})\b/i
  );
  if (match && match[1]) {
    return match[1].toUpperCase().replace(/\s+/, "-");
  }
  // If technician simply typed "E402" or "402"
  if (/^[a-zA-Z]?\d{2,4}$/.test(clean)) {
    return clean.toUpperCase();
  }
  return clean.length <= 20 ? clean.toUpperCase() : null;
}

/**
 * Incident Clarification Service.
 * Implements one-focused-question-at-a-time clarification workflow:
 * - Detects missing essential operational fields in prioritized order.
 * - Never asks questions whose answers already exist in extraction or history.
 * - Avoids generating unnecessary questions.
 * - Updates extraction, validates updated info, and preserves verbatim transcript.
 */
export class IncidentClarificationService {
  private readonly assetMatcher: DeterministicAssetMatcher;
  private readonly validator: IncidentValidationService;

  constructor() {
    this.assetMatcher = new DeterministicAssetMatcher();
    this.validator = new IncidentValidationService();
  }

  /**
   * Scans incident text and extraction data to determine what information is missing.
   * Asks exactly ONE focused question at a time in prioritized order.
   *
   * ponytail: rule-based priority queue for operational questions; sufficient for standard solar O&M triage,
   * upgrade path: dynamic conversational LLM agent if open-ended multi-turn troubleshooting is required.
   */
  public identifyNextQuestion(
    data: ClarificationInputData,
    history: ClarificationItem[] = [],
    siteName = "the solar site"
  ): ClarificationEvaluation {
    const textToScan = [
      data.transcript || "",
      data.originalTranscript || "",
      data.description || "",
      ...(data.symptoms || []),
      data.actionsAlreadyTaken || "",
      data.currentStatus || "",
      data.operationalStatus || "",
    ]
      .join(" ")
      .toLowerCase();

    const missingFields: MissingFieldKey[] = [];
    const questionsByField = new Map<MissingFieldKey, string>();

    // Helper: checks if a field has already been answered in clarification history
    const isAlreadyAnswered = (key: MissingFieldKey): boolean => {
      return history.some(
        (h) => h.field === key && h.status === "RESOLVED" && h.response && h.response.trim().length > 0
      );
    };

    // Helper: checks if a field is currently pending in history
    const getExistingPending = (key: MissingFieldKey): ClarificationItem | undefined => {
      return history.find((h) => h.field === key && h.status === "PENDING");
    };

    // -------------------------------------------------------------------------
    // Rule 1: Missing Equipment Identity (Priority 1)
    // Example: Technician reports a fault without specifying the equipment.
    // -------------------------------------------------------------------------
    const hasAsset = Boolean(data.assetCode || data.matchedAssetId);
    if (!hasAsset && !isAlreadyAnswered("asset")) {
      missingFields.push("asset");
      questionsByField.set(
        "asset",
        `Which specific equipment tag or location at ${siteName} (e.g. INV-01, SCB-04) is experiencing this fault?`
      );
    }

    // -------------------------------------------------------------------------
    // Rule 2: Unspecified Alarm / Error Code (Priority 2)
    // Example: Technician reports an alarm without providing the alarm code.
    // Avoids unnecessary question: only asked if technician mentioned an alarm/error!
    // -------------------------------------------------------------------------
    const mentionedAlarm = /\b(alarm|error|code|warning|display|screen|fault code|error code)\b/i.test(
      textToScan
    );
    const hasAlarmCode = Boolean(data.reportedAlarm);

    if (mentionedAlarm && !hasAlarmCode && !isAlreadyAnswered("alarm_code")) {
      missingFields.push("alarm_code");
      questionsByField.set(
        "alarm_code",
        "What is the specific alarm or error code shown on the equipment display (e.g. E-402, F-042)?"
      );
    }

    // -------------------------------------------------------------------------
    // Rule 3: Unidentified Current Operational Status (Priority 3)
    // Example: Technician reports repeated tripping but does not identify current status.
    // Avoids unnecessary question: only asked if tripping/shutdown was mentioned without current status!
    // -------------------------------------------------------------------------
    const mentionedTripping =
      /\b(trip|tripped|tripping|shut down|shutdown|band ho gaya|offline|band hai|phir se trip)\b/i.test(
        textToScan
      );
    const hasCurrentStatus = Boolean(data.currentStatus || data.operationalStatus);
    const mentionsCurrentState =
      hasCurrentStatus ||
      /\b(currently running|still down|still offline|ab chal raha hai|abhi bhi band hai|tripped state|running nominal|restored|online|offline hai|abhi offline|currently offline|system offline)\b/i.test(
        textToScan
      );

    if (mentionedTripping && !mentionsCurrentState && !isAlreadyAnswered("current_status")) {
      missingFields.push("current_status");
      questionsByField.set(
        "current_status",
        "What is the current operational status of the equipment (is it still tripped/offline, or currently running)?"
      );
    }

    // -------------------------------------------------------------------------
    // Rule 4: Unreported Repair Result (Priority 4)
    // Example: Technician mentions a repair attempt but not its result.
    // Avoids unnecessary question: only asked if repair attempt was stated without outcome!
    // -------------------------------------------------------------------------
    const mentionedRepairAttempt =
      /\b(tried to reset|reset attempt|reset kiya|restarted|restart kiya|fuse replace kiya|replaced fuse|tried restarting|breaker reset|tried clearing)\b/i.test(
        textToScan
      );
    const mentionsRepairResult =
      /\b(did not work|worked|restored|tripped again|phir trip ho gaya|success|failed|held|no effect|generation resumed|recovered)\b/i.test(
        textToScan
      );

    if (
      mentionedRepairAttempt &&
      !mentionsRepairResult &&
      !isAlreadyAnswered("repair_result")
    ) {
      missingFields.push("repair_result");
      questionsByField.set(
        "repair_result",
        "What was the result of the repair or reset attempt (did generation resume or did the fault persist)?"
      );
    }

    // -------------------------------------------------------------------------
    // Rule 5: Completely Missing Symptoms (Priority 5)
    // -------------------------------------------------------------------------
    const hasSymptoms = Array.isArray(data.symptoms) && data.symptoms.length > 0;
    if (!hasSymptoms && !hasAlarmCode && !isAlreadyAnswered("symptoms")) {
      missingFields.push("symptoms");
      questionsByField.set(
        "symptoms",
        "What specific abnormal symptoms, display messages, or physical signs were observed on the equipment?"
      );
    }

    // -------------------------------------------------------------------------
    // Select exactly ONE focused question (first item in prioritized queue)
    // -------------------------------------------------------------------------
    let currentQuestion: ClarificationItem | null = null;

    if (missingFields.length > 0) {
      const topField = missingFields[0]!;
      const existingPending = getExistingPending(topField);

      if (existingPending) {
        currentQuestion = existingPending;
      } else {
        currentQuestion = {
          field: topField,
          question: questionsByField.get(topField)!,
          status: "PENDING",
          createdAt: new Date(),
        };
      }
    }

    const isComplete = missingFields.length === 0;

    return {
      missingFields,
      currentQuestion,
      isComplete,
      clarificationHistory: [...history],
    };
  }

  /**
   * Processes a technician's response (from text or voice transcription),
   * updates the extraction object, validates the updated information,
   * preserves the original transcript, and records the clarification history.
   */
  public processResponse(params: ProcessClarificationParams): ProcessClarificationResult {
    const {
      field,
      response,
      fromVoice = false,
      currentExtraction,
      history = [],
      siteContext,
    } = params;

    const trimmedResponse = response.trim();

    // 1. Maintain Clarification History
    const updatedHistory: ClarificationItem[] = [...history];
    const existingIndex = updatedHistory.findIndex(
      (h) => h.field === field && h.status === "PENDING"
    );

    const answeredItem: ClarificationItem = {
      field,
      question:
        existingIndex >= 0
          ? updatedHistory[existingIndex]!.question
          : `Clarification for ${field}`,
      response: trimmedResponse,
      status: "RESOLVED",
      createdAt:
        existingIndex >= 0 ? updatedHistory[existingIndex]!.createdAt : new Date(),
      respondedAt: new Date(),
      fromVoice,
    };

    if (existingIndex >= 0) {
      updatedHistory[existingIndex] = answeredItem;
    } else {
      updatedHistory.push(answeredItem);
    }

    // 2. Clone extraction object and strictly preserve original transcript
    const updated: ExtractedIncident = {
      ...currentExtraction,
      symptoms: [...currentExtraction.symptoms],
      missingInformation: [...currentExtraction.missingInformation],
      details: {
        reported: {
          ...currentExtraction.details.reported,
          rawObservations: [...currentExtraction.details.reported.rawObservations],
        },
        inferred: {
          ...currentExtraction.details.inferred,
          priorityReasoning: [...currentExtraction.details.inferred.priorityReasoning],
        },
      },
      // REQUIREMENT 6: Original transcript strictly preserved
      originalTranscript: currentExtraction.originalTranscript,
    };

    // 3. Update Extraction Object according to the answered field
    switch (field) {
      case "asset": {
        const matchResult = this.assetMatcher.matchAsset(
          {
            extractedCode: trimmedResponse,
            transcript: trimmedResponse,
          },
          {
            siteId: siteContext.id,
            siteName: siteContext.name,
            siteAssets: siteContext.siteAssets,
          }
        );

        if (matchResult.status === "EXACT_MATCH" && matchResult.matchedAsset) {
          updated.assetCode = matchResult.matchedAsset.assetTag;
          updated.matchedAssetId = matchResult.matchedAsset.id;
          updated.equipmentType = matchResult.matchedAsset.assetType as EquipmentType;
          updated.isAmbiguous = false;
          updated.requiresManualSelection = false;
          updated.candidateAssets = [];
          updated.details.reported.spokenAssetCode = matchResult.matchedAsset.assetTag;
        } else if (matchResult.status === "AMBIGUOUS_MATCH") {
          updated.assetCode = null;
          updated.matchedAssetId = null;
          updated.isAmbiguous = true;
          updated.requiresManualSelection = true;
          updated.candidateAssets = matchResult.candidates.map((c) => ({
            id: c.id,
            assetTag: c.assetTag,
            name: c.name,
            assetType: c.assetType,
            block: c.block,
          }));
        }
        break;
      }

      case "alarm_code": {
        const parsedCode = extractAlarmCodeFromText(trimmedResponse);
        if (parsedCode) {
          updated.reportedAlarm = parsedCode;
          updated.details.reported.statedAlarmCode = parsedCode;
        }
        break;
      }

      case "current_status": {
        updated.symptoms.push(`Current status: ${trimmedResponse}`);
        updated.details.reported.rawObservations.push(`Operational status: ${trimmedResponse}`);
        break;
      }

      case "repair_result": {
        const updatedAction = updated.actionsAlreadyTaken
          ? `${updated.actionsAlreadyTaken} (Result: ${trimmedResponse})`
          : `Repair result: ${trimmedResponse}`;
        updated.actionsAlreadyTaken = updatedAction;
        updated.details.reported.statedActions = updatedAction;
        break;
      }

      case "symptoms": {
        updated.symptoms.push(trimmedResponse);
        updated.details.reported.rawObservations.push(trimmedResponse);
        break;
      }
    }

    // 4. Validate the Updated Information
    const validationReport = this.validator.validate({
      siteId: siteContext.id,
      assetId: updated.matchedAssetId,
      assetCode: updated.assetCode,
      matchedAsset: updated.matchedAssetId
        ? siteContext.siteAssets.find((a) => a.id === updated.matchedAssetId)
        : null,
      equipmentType: updated.equipmentType,
      title: `${updated.assetCode || "Equipment"}: ${updated.faultDescription.slice(0, 40)}`,
      description: updated.faultDescription,
      symptoms: updated.symptoms.join(", "),
      errorCode: updated.reportedAlarm,
      priority: updated.suggestedPriority,
      faultCategory: updated.faultCategory,
      originalTranscript: updated.originalTranscript,
    });

    // 5. Determine if Further Clarification is Needed (One focused question at a time)
    const nextEval = this.identifyNextQuestion(
      {
        transcript: updated.originalTranscript,
        originalTranscript: updated.originalTranscript,
        assetCode: updated.assetCode,
        matchedAssetId: updated.matchedAssetId,
        reportedAlarm: updated.reportedAlarm,
        symptoms: updated.symptoms,
        actionsAlreadyTaken: updated.actionsAlreadyTaken,
        description: updated.faultDescription,
      },
      updatedHistory,
      siteContext.name
    );

    if (nextEval.currentQuestion) {
      updated.needsClarification = true;
      updated.suggestedStatus = "NEEDS_CLARIFICATION";
      updated.clarificationQuestion = nextEval.currentQuestion.question;
      updated.missingInformation = nextEval.missingFields.map((f) => `Missing ${f}`);
    } else {
      updated.needsClarification = false;
      updated.suggestedStatus = "DRAFT";
      updated.clarificationQuestion = null;
      updated.missingInformation = [];
    }

    return {
      updatedExtraction: updated,
      history: updatedHistory,
      nextQuestion: nextEval.currentQuestion,
      isComplete: nextEval.isComplete,
      validationReport,
    };
  }
}

let defaultClarificationService: IncidentClarificationService | null = null;

export function getIncidentClarificationService(): IncidentClarificationService {
  if (!defaultClarificationService) {
    defaultClarificationService = new IncidentClarificationService();
  }
  return defaultClarificationService;
}
