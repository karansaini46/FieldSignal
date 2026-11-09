import { FaultCategory, IncidentPriority, AssetType } from "@prisma/client";

export type EquipmentType =
  | "INVERTER"
  | "SOLAR_MODULE"
  | "COMBINER_BOX"
  | "TRANSFORMER"
  | "TRACKER"
  | "WEATHER_STATION"
  | "BATTERY_STORAGE"
  | "OTHER"
  | "UNKNOWN";

export interface SiteContext {
  id: string;
  name: string;
  code: string;
  location?: string | null;
}

export interface AssetContext {
  id: string;
  assetTag: string;
  name: string;
  assetType: AssetType;
  block?: string | null;
  row?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  ratedCapacityKw?: number | null;
}

export interface KnownAssetSummary {
  id: string;
  assetTag: string;
  name: string;
  assetType: AssetType;
  block?: string | null;
  model?: string | null;
  row?: string | null;
}

export interface PreviousIncidentSummary {
  id: string;
  ticketNumber: string;
  title: string;
  faultCategory: string;
  priority: string;
  createdAt: Date | string;
  errorCode?: string | null;
}

export interface ExtractionInput {
  /** Raw audio transcript from field technician */
  transcript: string;
  /** Site where the incident occurred */
  site: SiteContext;
  /** Explicitly pre-selected asset (if technician selected one), or null */
  selectedAsset?: AssetContext | null;
  /** Inventory of valid assets on this site for exact matching (prevents hallucination) */
  knownSiteAssets?: KnownAssetSummary[];
  /** Historical incidents for recurrence & repeat fault analysis */
  previousIncidents?: PreviousIncidentSummary[];
}

export interface ExtractedIncident {
  /** Asset code explicitly stated and validated against site assets, or null if missing/ambiguous */
  assetCode: string | null;
  /** Matched database asset ID if assetCode was verified against knownSiteAssets, or null */
  matchedAssetId: string | null;
  /** Equipment classification */
  equipmentType: EquipmentType;
  /** Factual fault description based purely on reported observations (no unevidenced root cause) */
  faultDescription: string;
  /** Reported OEM or inverter alarm code (e.g. E-402, F-14) or null if not explicitly reported */
  reportedAlarm: string | null;
  /** List of observed physical or operational symptoms reported */
  symptoms: string[];
  /** Physical or safety actions already performed by technician prior to reporting, or null */
  actionsAlreadyTaken: string | null;
  /** Whether the technician mentioned recurrence or previous occurrences of this fault */
  recurrenceMentioned: boolean;
  /** Suggested priority: CRITICAL, HIGH, MEDIUM, LOW */
  suggestedPriority: IncidentPriority;
  /** Inferred or matched fault category for FieldSignal database */
  faultCategory: FaultCategory;
  /** List of missing pieces of essential information needed for complete triage */
  missingInformation: string[];
  /** Specific clarification question to ask technician if information is missing, or null if complete */
  clarificationQuestion: string | null;
  /** Model extraction confidence score between 0.0 and 1.0 */
  extractionConfidence: number;
  /** Whether the incident requires clarification before it can be confirmed */
  needsClarification: boolean;
  /** Suggested initial status: NEEDS_CLARIFICATION or DRAFT */
  suggestedStatus: "NEEDS_CLARIFICATION" | "DRAFT";
  /** Detailed breakdown separating verbatim reported facts from model inferences */
  details: {
    reported: {
      rawObservations: string[];
      statedAlarmCode: string | null;
      statedActions: string | null;
      spokenAssetCode: string | null;
    };
    inferred: {
      inferredEquipmentType: EquipmentType;
      inferredFaultCategory: FaultCategory;
      priorityReasoning: string[];
    };
  };
  /** True if multiple asset candidates match with similar confidence */
  isAmbiguous?: boolean;
  /** Candidate assets when an asset match is ambiguous or requires user disambiguation */
  candidateAssets?: Array<{
    id: string;
    assetTag: string;
    name: string;
    assetType: AssetType;
    block?: string | null;
    confidence?: number;
  }>;
  /** True if system cannot confidently match a single asset and requests manual selection */
  requiresManualSelection?: boolean;
  /** Contradictions detected between asset types, fault categories, or reported severities */
  contradictions?: Array<{
    fieldA: string;
    fieldB: string;
    severity: "ERROR" | "WARNING";
    code: string;
    message: string;
    resolution: string;
  }>;
  /** Verbatim original transcript strictly preserved from voice ASR or input */
  originalTranscript?: string | null;
}

export interface IExtractionEngine {
  extractIncident(input: ExtractionInput): Promise<ExtractedIncident>;
}
