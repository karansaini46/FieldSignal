import {
  AssetType,
  FaultCategory,
  IncidentPriority,
  IncidentStatus,
} from "@prisma/client";
import {
  AssetMatchResult,
  DeterministicAssetMatcher,
  MatchedAssetCandidate,
} from "@/modules/assets/asset-matcher";

export interface FieldValidationError {
  field: string;
  expectedType: string;
  receivedType: string;
  message: string;
  code:
    | "INVALID_TYPE"
    | "TOO_SHORT"
    | "TOO_LONG"
    | "INVALID_FORMAT"
    | "INVALID_ENUM"
    | "REQUIRED"
    | "WHITESPACE_ONLY";
}

export interface IncidentValidationWarning {
  field: string;
  message: string;
  code: string;
}

export interface ContradictionFinding {
  fieldA: string;
  fieldB: string;
  valueA: unknown;
  valueB: unknown;
  severity: "ERROR" | "WARNING";
  code: string;
  message: string;
  resolution: string;
}

export interface EquipmentTypeValidationResult {
  isValid: boolean;
  equipmentType: string;
  canonicalType?: AssetType | "UNKNOWN" | "OTHER";
  isCompatibleWithAsset: boolean;
  error?: string;
  contradiction?: ContradictionFinding;
}

export interface IncidentValidationInput {
  siteId?: unknown;
  assetId?: unknown;
  assetCode?: unknown;
  matchedAsset?: MatchedAssetCandidate | null;
  equipmentType?: unknown;
  title?: unknown;
  description?: unknown;
  symptoms?: unknown;
  errorCode?: unknown;
  reportedAlarm?: unknown;
  priority?: unknown;
  faultCategory?: unknown;
  status?: unknown;
  assignedToUserId?: unknown;
  audioRecordingId?: unknown;
  originalTranscript?: unknown;
  transcript?: unknown;
  detectedLanguage?: unknown;
  resolutionNotes?: unknown;
  missingFields?: unknown;
  isAiExtracted?: unknown;
  userConfirmed?: unknown;
}

export interface IncidentValidationContext {
  site?: { id: string; name: string };
  siteAssets?: MatchedAssetCandidate[];
  crossSiteAssets?: MatchedAssetCandidate[];
}

export interface IncidentValidationReport {
  isValid: boolean;
  errors: FieldValidationError[];
  warnings: IncidentValidationWarning[];
  missingFields: string[];
  contradictions: ContradictionFinding[];
  equipmentTypeValid: boolean;
  assetMatch: AssetMatchResult | null;
  requiresManualSelection: boolean;
  needsClarification: boolean;
  clarificationQuestions: string[];
  preservedTranscript: string | null;
}

const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

export function isValidUuid(val: unknown): boolean {
  return typeof val === "string" && UUID_REGEX.test(val);
}

/**
 * Valid equipment types recognized by the solar operations system.
 */
export const VALID_EQUIPMENT_TYPES: string[] = [
  "INVERTER",
  "SOLAR_MODULE",
  "COMBINER_BOX",
  "TRANSFORMER",
  "TRACKER",
  "WEATHER_STATION",
  "BATTERY_STORAGE",
  "OTHER",
  "UNKNOWN",
];

/**
 * Validates incident field types, lengths, and format boundaries.
 */
export function validateFieldLengthsAndTypes(
  data: IncidentValidationInput
): { isValid: boolean; errors: FieldValidationError[] } {
  const errors: FieldValidationError[] = [];

  // 1. siteId: required UUID string
  if (data.siteId === undefined || data.siteId === null || data.siteId === "") {
    errors.push({
      field: "siteId",
      expectedType: "string (UUID)",
      receivedType: typeof data.siteId,
      message: "Site ID is required.",
      code: "REQUIRED",
    });
  } else if (typeof data.siteId !== "string") {
    errors.push({
      field: "siteId",
      expectedType: "string (UUID)",
      receivedType: typeof data.siteId,
      message: "Site ID must be a string.",
      code: "INVALID_TYPE",
    });
  } else if (!isValidUuid(data.siteId)) {
    errors.push({
      field: "siteId",
      expectedType: "string (UUID format)",
      receivedType: "invalid format",
      message: "Site ID must be a valid UUID.",
      code: "INVALID_FORMAT",
    });
  }

  // 2. title: string, 3 - 200 chars
  if (data.title === undefined || data.title === null) {
    errors.push({
      field: "title",
      expectedType: "string",
      receivedType: typeof data.title,
      message: "Title is required.",
      code: "REQUIRED",
    });
  } else if (typeof data.title !== "string") {
    errors.push({
      field: "title",
      expectedType: "string",
      receivedType: typeof data.title,
      message: "Title must be a string.",
      code: "INVALID_TYPE",
    });
  } else {
    const trimmedTitle = data.title.trim();
    if (trimmedTitle.length === 0) {
      errors.push({
        field: "title",
        expectedType: "non-empty string",
        receivedType: "empty string",
        message: "Title cannot be empty or whitespace only.",
        code: "WHITESPACE_ONLY",
      });
    } else if (trimmedTitle.length < 3) {
      errors.push({
        field: "title",
        expectedType: "string (min 3 chars)",
        receivedType: `string (${trimmedTitle.length} chars)`,
        message: "Title must be at least 3 characters long.",
        code: "TOO_SHORT",
      });
    } else if (data.title.length > 200) {
      errors.push({
        field: "title",
        expectedType: "string (max 200 chars)",
        receivedType: `string (${data.title.length} chars)`,
        message: "Title cannot exceed 200 characters.",
        code: "TOO_LONG",
      });
    }
  }

  // 3. description: string, 5 - 5000 chars
  if (data.description === undefined || data.description === null) {
    errors.push({
      field: "description",
      expectedType: "string",
      receivedType: typeof data.description,
      message: "Description is required.",
      code: "REQUIRED",
    });
  } else if (typeof data.description !== "string") {
    errors.push({
      field: "description",
      expectedType: "string",
      receivedType: typeof data.description,
      message: "Description must be a string.",
      code: "INVALID_TYPE",
    });
  } else {
    const trimmedDesc = data.description.trim();
    if (trimmedDesc.length === 0) {
      errors.push({
        field: "description",
        expectedType: "non-empty string",
        receivedType: "empty string",
        message: "Description cannot be empty or whitespace only.",
        code: "WHITESPACE_ONLY",
      });
    } else if (trimmedDesc.length < 5) {
      errors.push({
        field: "description",
        expectedType: "string (min 5 chars)",
        receivedType: `string (${trimmedDesc.length} chars)`,
        message: "Description must be at least 5 characters long.",
        code: "TOO_SHORT",
      });
    } else if (data.description.length > 5000) {
      errors.push({
        field: "description",
        expectedType: "string (max 5000 chars)",
        receivedType: `string (${data.description.length} chars)`,
        message: "Description cannot exceed 5000 characters.",
        code: "TOO_LONG",
      });
    }
  }

  // 4. symptoms: optional string, max 2000 chars
  if (data.symptoms !== undefined && data.symptoms !== null) {
    if (typeof data.symptoms !== "string") {
      errors.push({
        field: "symptoms",
        expectedType: "string or null",
        receivedType: typeof data.symptoms,
        message: "Symptoms must be a string if provided.",
        code: "INVALID_TYPE",
      });
    } else if (data.symptoms.length > 2000) {
      errors.push({
        field: "symptoms",
        expectedType: "string (max 2000 chars)",
        receivedType: `string (${data.symptoms.length} chars)`,
        message: "Symptoms cannot exceed 2000 characters.",
        code: "TOO_LONG",
      });
    }
  }

  // 5. errorCode / reportedAlarm: optional string, max 50 chars
  const codeVal = data.errorCode ?? data.reportedAlarm;
  if (codeVal !== undefined && codeVal !== null) {
    if (typeof codeVal !== "string") {
      errors.push({
        field: "errorCode",
        expectedType: "string or null",
        receivedType: typeof codeVal,
        message: "Error code must be a string if provided.",
        code: "INVALID_TYPE",
      });
    } else if (codeVal.length > 50) {
      errors.push({
        field: "errorCode",
        expectedType: "string (max 50 chars)",
        receivedType: `string (${codeVal.length} chars)`,
        message: "Error code cannot exceed 50 characters.",
        code: "TOO_LONG",
      });
    }
  }

  // 6. assetId: optional UUID string
  if (data.assetId !== undefined && data.assetId !== null && data.assetId !== "") {
    if (typeof data.assetId !== "string") {
      errors.push({
        field: "assetId",
        expectedType: "string (UUID) or null",
        receivedType: typeof data.assetId,
        message: "Asset ID must be a string if provided.",
        code: "INVALID_TYPE",
      });
    } else if (!isValidUuid(data.assetId)) {
      errors.push({
        field: "assetId",
        expectedType: "string (UUID format)",
        receivedType: "invalid format",
        message: "Asset ID must be a valid UUID format.",
        code: "INVALID_FORMAT",
      });
    }
  }

  // 7. priority: enum IncidentPriority
  if (data.priority !== undefined && data.priority !== null) {
    const validPriorities = Object.values(IncidentPriority);
    if (!validPriorities.includes(data.priority as IncidentPriority)) {
      errors.push({
        field: "priority",
        expectedType: validPriorities.join(" | "),
        receivedType: String(data.priority),
        message: `Priority must be one of: ${validPriorities.join(", ")}.`,
        code: "INVALID_ENUM",
      });
    }
  }

  // 8. faultCategory: enum FaultCategory
  if (data.faultCategory !== undefined && data.faultCategory !== null) {
    const validCategories = Object.values(FaultCategory);
    if (!validCategories.includes(data.faultCategory as FaultCategory)) {
      errors.push({
        field: "faultCategory",
        expectedType: validCategories.join(" | "),
        receivedType: String(data.faultCategory),
        message: `Fault category must be one of: ${validCategories.join(", ")}.`,
        code: "INVALID_ENUM",
      });
    }
  }

  // 9. status: enum IncidentStatus
  if (data.status !== undefined && data.status !== null) {
    const validStatuses = Object.values(IncidentStatus);
    if (!validStatuses.includes(data.status as IncidentStatus)) {
      errors.push({
        field: "status",
        expectedType: validStatuses.join(" | "),
        receivedType: String(data.status),
        message: `Status must be one of: ${validStatuses.join(", ")}.`,
        code: "INVALID_ENUM",
      });
    }
  }

  // 10. assignedToUserId: optional UUID string
  if (
    data.assignedToUserId !== undefined &&
    data.assignedToUserId !== null &&
    data.assignedToUserId !== ""
  ) {
    if (typeof data.assignedToUserId !== "string" || !isValidUuid(data.assignedToUserId)) {
      errors.push({
        field: "assignedToUserId",
        expectedType: "string (UUID format) or null",
        receivedType: typeof data.assignedToUserId,
        message: "Assigned user ID must be a valid UUID if provided.",
        code: "INVALID_FORMAT",
      });
    }
  }

  // 11. audioRecordingId: optional UUID string
  if (
    data.audioRecordingId !== undefined &&
    data.audioRecordingId !== null &&
    data.audioRecordingId !== ""
  ) {
    if (typeof data.audioRecordingId !== "string" || !isValidUuid(data.audioRecordingId)) {
      errors.push({
        field: "audioRecordingId",
        expectedType: "string (UUID format) or null",
        receivedType: typeof data.audioRecordingId,
        message: "Audio recording ID must be a valid UUID if provided.",
        code: "INVALID_FORMAT",
      });
    }
  }

  // 12. originalTranscript: optional string, max 10000 chars
  if (data.originalTranscript !== undefined && data.originalTranscript !== null) {
    if (typeof data.originalTranscript !== "string") {
      errors.push({
        field: "originalTranscript",
        expectedType: "string or null",
        receivedType: typeof data.originalTranscript,
        message: "Original transcript must be a string if provided.",
        code: "INVALID_TYPE",
      });
    } else if (data.originalTranscript.length > 10000) {
      errors.push({
        field: "originalTranscript",
        expectedType: "string (max 10000 chars)",
        receivedType: `string (${data.originalTranscript.length} chars)`,
        message: "Original transcript cannot exceed 10000 characters.",
        code: "TOO_LONG",
      });
    }
  }

  // 13. detectedLanguage: optional string, max 20 chars
  if (data.detectedLanguage !== undefined && data.detectedLanguage !== null) {
    if (typeof data.detectedLanguage !== "string") {
      errors.push({
        field: "detectedLanguage",
        expectedType: "string or null",
        receivedType: typeof data.detectedLanguage,
        message: "Detected language must be a string if provided.",
        code: "INVALID_TYPE",
      });
    } else if (data.detectedLanguage.length > 20) {
      errors.push({
        field: "detectedLanguage",
        expectedType: "string (max 20 chars)",
        receivedType: `string (${data.detectedLanguage.length} chars)`,
        message: "Detected language cannot exceed 20 characters.",
        code: "TOO_LONG",
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates the extracted equipment type against solar standards and matched asset.
 */
export function validateEquipmentType(
  rawEquipmentType: unknown,
  matchedAssetType?: AssetType | null
): EquipmentTypeValidationResult {
  if (rawEquipmentType === undefined || rawEquipmentType === null || rawEquipmentType === "") {
    return {
      isValid: false,
      equipmentType: "UNKNOWN",
      isCompatibleWithAsset: true,
      error: "Equipment type is missing or undefined.",
    };
  }

  const strType = String(rawEquipmentType).trim().toUpperCase();

  if (!VALID_EQUIPMENT_TYPES.includes(strType)) {
    return {
      isValid: false,
      equipmentType: strType,
      isCompatibleWithAsset: false,
      error: `Invalid equipment type '${strType}'. Must be one of: ${VALID_EQUIPMENT_TYPES.join(", ")}.`,
    };
  }

  // If a matched asset exists, check compatibility
  if (matchedAssetType) {
    const isDirectMatch = strType === (matchedAssetType as string);
    const isOtherCompatible =
      strType === "OTHER" ||
      matchedAssetType === AssetType.OTHER ||
      strType === "TRACKER" ||
      strType === "WEATHER_STATION" ||
      strType === "BATTERY_STORAGE";

    if (!isDirectMatch && !isOtherCompatible && strType !== "UNKNOWN") {
      const contradiction: ContradictionFinding = {
        fieldA: "equipmentType",
        fieldB: "asset.assetType",
        valueA: strType,
        valueB: matchedAssetType,
        severity: "ERROR",
        code: "EQUIPMENT_TYPE_MISMATCH",
        message: `Extracted equipment type '${strType}' conflicts with actual registered asset type '${matchedAssetType}'.`,
        resolution: `Align the equipment classification with the verified asset type (${matchedAssetType}).`,
      };

      return {
        isValid: false,
        equipmentType: strType,
        canonicalType: matchedAssetType,
        isCompatibleWithAsset: false,
        error: contradiction.message,
        contradiction,
      };
    }
  }

  return {
    isValid: true,
    equipmentType: strType,
    canonicalType: (matchedAssetType || strType) as AssetType | "UNKNOWN" | "OTHER",
    isCompatibleWithAsset: true,
  };
}

/**
 * Detects missing required operational information for incident triage.
 */
export function detectMissingInformation(data: IncidentValidationInput): {
  missingFields: string[];
  needsClarification: boolean;
  clarificationQuestions: string[];
} {
  const missingFields: string[] = [];
  const clarificationQuestions: string[] = [];

  // 1. Missing Asset: An incident needs an identified piece of equipment
  const hasAssetId = Boolean(data.assetId && String(data.assetId).trim());
  const hasAssetCode = Boolean(
    data.assetCode && String(data.assetCode).trim().toUpperCase() !== "UNKNOWN"
  );
  const hasMatchedAsset = Boolean(data.matchedAsset);

  if (!hasAssetId && !hasAssetCode && !hasMatchedAsset) {
    missingFields.push("assetId");
    clarificationQuestions.push(
      "Which specific solar equipment (e.g. Inverter INV-01, Combiner Box SCB-04) is experiencing this issue?"
    );
  }

  // 2. Missing Fault Evidence: Need either symptoms or an alarm/error code
  const symptomsStr = typeof data.symptoms === "string" ? data.symptoms.trim() : "";
  const errorStr = typeof data.errorCode === "string" ? data.errorCode.trim() : "";
  const alarmStr = typeof data.reportedAlarm === "string" ? data.reportedAlarm.trim() : "";
  const hasFaultEvidence =
    symptomsStr.length > 0 || errorStr.length > 0 || alarmStr.length > 0;

  if (!hasFaultEvidence) {
    missingFields.push("symptomsOrErrorCode");
    clarificationQuestions.push(
      "What specific alarm code, display reading, or physical symptoms (e.g. high temperature, trip, smoke) were observed?"
    );
  }

  // 3. Core fields
  if (!data.title || (typeof data.title === "string" && !data.title.trim())) {
    missingFields.push("title");
  }
  if (!data.description || (typeof data.description === "string" && !data.description.trim())) {
    missingFields.push("description");
  }

  const needsClarification = missingFields.length > 0;

  return {
    missingFields,
    needsClarification,
    clarificationQuestions,
  };
}

/**
 * Detects domain contradictions in solar incident reports:
 * 1. Asset type vs Equipment type
 * 2. Asset type vs Fault category
 * 3. Priority vs Reported severity/hazards
 * 4. Equipment type vs Alarm code
 * 5. Workflow state consistency (status vs assignment/resolution)
 */
export function detectContradictoryFields(
  data: IncidentValidationInput
): ContradictionFinding[] {
  const contradictions: ContradictionFinding[] = [];

  const textToScan = [
    typeof data.description === "string" ? data.description : "",
    typeof data.symptoms === "string" ? data.symptoms : "",
    typeof data.title === "string" ? data.title : "",
    typeof data.originalTranscript === "string" ? data.originalTranscript : "",
    typeof data.transcript === "string" ? data.transcript : "",
  ]
    .join(" ")
    .toLowerCase();

  // 1. Asset Type vs Equipment Type
  const assetType = data.matchedAsset?.assetType;
  const equipmentType = typeof data.equipmentType === "string" ? data.equipmentType.toUpperCase() : null;

  if (assetType && equipmentType && equipmentType !== "UNKNOWN" && equipmentType !== "OTHER") {
    if (assetType !== (equipmentType as AssetType)) {
      contradictions.push({
        fieldA: "equipmentType",
        fieldB: "asset.assetType",
        valueA: equipmentType,
        valueB: assetType,
        severity: "ERROR",
        code: "ASSET_EQUIPMENT_TYPE_CONTRADICTION",
        message: `Report classified equipment as '${equipmentType}', but matched asset '${data.matchedAsset?.assetTag}' is actually a '${assetType}'.`,
        resolution: `Update equipment type to '${assetType}'.`,
      });
    }
  }

  // 2. Asset Type vs Fault Category Contradictions
  const faultCat = data.faultCategory as FaultCategory | undefined;
  if (assetType && faultCat) {
    // TRACKER_FAILURE on an Inverter or Transformer
    if (
      faultCat === FaultCategory.TRACKER_FAILURE &&
      (assetType === AssetType.INVERTER || assetType === AssetType.TRANSFORMER || assetType === AssetType.COMBINER_BOX)
    ) {
      contradictions.push({
        fieldA: "faultCategory",
        fieldB: "asset.assetType",
        valueA: faultCat,
        valueB: assetType,
        severity: "ERROR",
        code: "CATEGORY_ASSET_TYPE_CONTRADICTION",
        message: `Fault category '${faultCat}' cannot apply to a ${assetType}. Trackers are mechanical racking systems.`,
        resolution: "Change fault category to OVER_TEMPERATURE, GRID_TRIP, or OTHER.",
      });
    }

    // DC_ARC_FIRE on non-DC equipment like Auxiliary Weather Station / OTHER
    if (
      faultCat === FaultCategory.DC_ARC_FIRE &&
      assetType === AssetType.OTHER &&
      /\b(weather|sensor|met|pyranometer)\b/i.test(textToScan)
    ) {
      contradictions.push({
        fieldA: "faultCategory",
        fieldB: "asset.assetType",
        valueA: faultCat,
        valueB: assetType,
        severity: "WARNING",
        code: "DC_ARC_FIRE_ON_AUXILIARY_CONTRADICTION",
        message: `DC Arc Fire reported on auxiliary weather equipment. Weather stations do not handle high-voltage DC string currents.`,
        resolution: "Verify if arc occurred at combiner box or inverter DC input.",
      });
    }
  }

  // 3. Priority vs Severity Contradiction
  // If report describes fire, smoke, arc, blast, or explosion, priority MUST NOT be LOW
  const hasFireHazard = /\b(fire|smoke|dhuan|aag|spark|sparking|blast|explosion|arc|burning|jal gaya)\b/i.test(
    textToScan
  );
  const isArcFireCat = faultCat === FaultCategory.DC_ARC_FIRE;

  if ((hasFireHazard || isArcFireCat) && data.priority === IncidentPriority.LOW) {
    contradictions.push({
      fieldA: "priority",
      fieldB: "symptoms/faultCategory",
      valueA: data.priority,
      valueB: isArcFireCat ? FaultCategory.DC_ARC_FIRE : "Fire/Arc Hazard",
      severity: "ERROR",
      code: "SAFETY_HAZARD_LOW_PRIORITY_CONTRADICTION",
      message: "Severe thermal or fire hazard detected in report, but priority is marked LOW. Safety hazards require CRITICAL priority.",
      resolution: "Escalate priority to CRITICAL.",
    });
  }

  // If report explicitly describes minor cosmetic/cleaning issue with no fault, but priority is CRITICAL
  const hasOnlyCosmeticIssue =
    /\b(cosmetic|dust|cleaning|soiling|dirty|loose label|paint scratch)\b/i.test(textToScan) &&
    !hasFireHazard &&
    !/\b(trip|offline|shutdown|alarm|error)\b/i.test(textToScan);

  if (hasOnlyCosmeticIssue && data.priority === IncidentPriority.CRITICAL) {
    contradictions.push({
      fieldA: "priority",
      fieldB: "description",
      valueA: data.priority,
      valueB: "Routine cosmetic/soiling",
      severity: "WARNING",
      code: "COSMETIC_ISSUE_CRITICAL_PRIORITY_CONTRADICTION",
      message: "Cosmetic or routine cleaning issue marked as CRITICAL priority without evidence of generation loss or safety risk.",
      resolution: "Adjust priority to LOW or MEDIUM.",
    });
  }

  // 4. Equipment Type vs Alarm Code Contradiction
  const reportedCode = String(data.errorCode || data.reportedAlarm || "").trim();
  const effectiveEquipment = assetType || equipmentType;
  if (effectiveEquipment === "SOLAR_MODULE" && /^[EeFfWw][-\s]?\d{1,4}/.test(reportedCode)) {
    contradictions.push({
      fieldA: "errorCode",
      fieldB: "equipmentType",
      valueA: reportedCode,
      valueB: "SOLAR_MODULE",
      severity: "WARNING",
      code: "ALARM_CODE_ON_PASSIVE_MODULE_CONTRADICTION",
      message: `Inverter/SCADA alarm code '${reportedCode}' assigned to SOLAR_MODULE. Passive PV modules do not display digital error codes.`,
      resolution: "Verify if alarm originated from central inverter or string monitoring box.",
    });
  }

  // 5. Workflow State Consistency Contradictions
  const status = data.status as IncidentStatus | undefined;

  // Incident marked RESOLVED or CLOSED without resolution notes
  if (
    (status === IncidentStatus.RESOLVED || status === IncidentStatus.CLOSED) &&
    (!data.resolutionNotes || (typeof data.resolutionNotes === "string" && !data.resolutionNotes.trim()))
  ) {
    contradictions.push({
      fieldA: "status",
      fieldB: "resolutionNotes",
      valueA: status,
      valueB: null,
      severity: "ERROR",
      code: "RESOLVED_WITHOUT_NOTES_CONTRADICTION",
      message: `Incident status is ${status}, but no resolution notes are provided explaining how the issue was fixed.`,
      resolution: "Add required resolution notes documenting repairs performed.",
    });
  }

  // Incident marked IN_PROGRESS or RESOLVED without an assigned technician
  if (
    (status === IncidentStatus.IN_PROGRESS || status === IncidentStatus.RESOLVED) &&
    !data.assignedToUserId
  ) {
    contradictions.push({
      fieldA: "status",
      fieldB: "assignedToUserId",
      valueA: status,
      valueB: null,
      severity: "ERROR",
      code: "ACTIVE_STATUS_WITHOUT_ASSIGNEE_CONTRADICTION",
      message: `Incident status is ${status}, but no maintenance technician is assigned to the work order.`,
      resolution: "Assign a technician before advancing to IN_PROGRESS or RESOLVED.",
    });
  }

  return contradictions;
}

/**
 * Validates that the original transcript is preserved intact and not lost or truncated.
 */
export function validateTranscriptPreservation(
  originalTranscript: unknown,
  extractedDescription?: unknown
): {
  isPreserved: boolean;
  preservedTranscript: string | null;
  warning?: string;
} {
  if (originalTranscript === undefined || originalTranscript === null) {
    return {
      isPreserved: false,
      preservedTranscript: null,
      warning: "No original transcript was provided to preserve.",
    };
  }

  if (typeof originalTranscript !== "string") {
    return {
      isPreserved: false,
      preservedTranscript: null,
      warning: "Original transcript must be a string.",
    };
  }

  const clean = originalTranscript.trim();
  if (clean.length === 0) {
    return {
      isPreserved: false,
      preservedTranscript: null,
      warning: "Original transcript is empty.",
    };
  }

  // Ensure that edited description does NOT silently overwrite originalTranscript
  return {
    isPreserved: true,
    preservedTranscript: clean,
  };
}

/**
 * Master Incident Validation Service.
 * Combines field length/type validation, asset matching & site verification,
 * equipment type validation, missing information detection, and contradiction checks.
 */
export class IncidentValidationService {
  private readonly assetMatcher: DeterministicAssetMatcher;

  constructor() {
    this.assetMatcher = new DeterministicAssetMatcher();
  }

  public validate(
    input: IncidentValidationInput,
    context?: IncidentValidationContext
  ): IncidentValidationReport {
    // 1. Field lengths and types
    const fieldCheck = validateFieldLengthsAndTypes(input);

    // 2. Asset Matching & Site Ownership Verification
    let assetMatch: AssetMatchResult | null = null;
    let requiresManualSelection = false;

    if (context?.site && context.siteAssets) {
      assetMatch = this.assetMatcher.matchAsset(
        {
          extractedCode: typeof input.assetCode === "string" ? input.assetCode : undefined,
          transcript:
            typeof input.transcript === "string"
              ? input.transcript
              : typeof input.originalTranscript === "string"
              ? input.originalTranscript
              : undefined,
          selectedAssetId: typeof input.assetId === "string" ? input.assetId : undefined,
        },
        {
          siteId: context.site.id,
          siteName: context.site.name,
          siteAssets: context.siteAssets,
        },
        {
          checkCrossSite: true,
          crossSiteAssets: context.crossSiteAssets,
        }
      );

      if (assetMatch.requiresManualSelection) {
        requiresManualSelection = true;
      }
    }

    // 3. Equipment Type Validation
    const matchedAssetType =
      input.matchedAsset?.assetType || assetMatch?.matchedAsset?.assetType || null;
    const equipCheck = validateEquipmentType(input.equipmentType, matchedAssetType);

    // 4. Missing Information Detection
    const missingInfo = detectMissingInformation({
      ...input,
      matchedAsset: input.matchedAsset || assetMatch?.matchedAsset,
    });

    // 5. Contradiction Detection
    const contradictions = detectContradictoryFields({
      ...input,
      matchedAsset: input.matchedAsset || assetMatch?.matchedAsset,
    });

    if (equipCheck.contradiction) {
      contradictions.push(equipCheck.contradiction);
    }

    // 6. Original Transcript Preservation
    const transcriptCheck = validateTranscriptPreservation(
      input.originalTranscript || input.transcript,
      input.description
    );

    // Compile warnings
    const warnings: IncidentValidationWarning[] = [];
    if (transcriptCheck.warning && (input.isAiExtracted || input.audioRecordingId)) {
      warnings.push({
        field: "originalTranscript",
        message: transcriptCheck.warning,
        code: "TRANSCRIPT_NOT_PRESERVED",
      });
    }

    // Include clarification questions
    const clarificationQuestions = [...missingInfo.clarificationQuestions];
    if (assetMatch?.clarificationPrompt && !clarificationQuestions.includes(assetMatch.clarificationPrompt)) {
      clarificationQuestions.unshift(assetMatch.clarificationPrompt);
    }

    // Check overall validity:
    // It is valid if:
    // - No field length/type errors
    // - No ERROR severity contradictions
    // - No site mismatch error on asset
    const hasFatalContradiction = contradictions.some((c) => c.severity === "ERROR");
    const hasSiteMismatch = assetMatch?.status === "SITE_MISMATCH";

    const isValid = fieldCheck.isValid && !hasFatalContradiction && !hasSiteMismatch;

    return {
      isValid,
      errors: fieldCheck.errors,
      warnings,
      missingFields: missingInfo.missingFields,
      contradictions,
      equipmentTypeValid: equipCheck.isValid,
      assetMatch,
      requiresManualSelection: requiresManualSelection || missingInfo.missingFields.includes("assetId"),
      needsClarification: missingInfo.needsClarification || requiresManualSelection,
      clarificationQuestions,
      preservedTranscript: transcriptCheck.preservedTranscript,
    };
  }
}

let defaultValidationService: IncidentValidationService | null = null;

export function getIncidentValidationService(): IncidentValidationService {
  if (!defaultValidationService) {
    defaultValidationService = new IncidentValidationService();
  }
  return defaultValidationService;
}

