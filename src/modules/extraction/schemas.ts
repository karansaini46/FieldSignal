import { z } from "zod";
import { FaultCategory, IncidentPriority, AssetType } from "@prisma/client";

export const equipmentTypeSchema = z.enum([
  "INVERTER",
  "SOLAR_MODULE",
  "COMBINER_BOX",
  "TRANSFORMER",
  "TRACKER",
  "WEATHER_STATION",
  "BATTERY_STORAGE",
  "OTHER",
  "UNKNOWN",
]);

export const faultCategorySchema = z.nativeEnum(FaultCategory);
export const incidentPrioritySchema = z.nativeEnum(IncidentPriority);

export const extractedIncidentSchema = z.object({
  assetCode: z
    .string()
    .nullable()
    .describe("Asset tag/code explicitly stated and matched, or null if missing"),
  matchedAssetId: z
    .string()
    .nullable()
    .describe("Matched database UUID of the asset, or null if not resolved"),
  equipmentType: equipmentTypeSchema.describe(
    "Equipment type: INVERTER, SOLAR_MODULE, COMBINER_BOX, TRANSFORMER, TRACKER, WEATHER_STATION, BATTERY_STORAGE, OTHER, or UNKNOWN"
  ),
  faultDescription: z
    .string()
    .min(1, "Fault description cannot be empty")
    .describe("Concise factual summary of the incident without hallucinating unevidenced root causes"),
  reportedAlarm: z
    .string()
    .nullable()
    .describe("Exact alarm/error code reported by technician, or null if none mentioned"),
  symptoms: z
    .array(z.string())
    .default([])
    .describe("Physical or electrical symptoms explicitly observed"),
  actionsAlreadyTaken: z
    .string()
    .nullable()
    .describe("Actions already performed by technician, or null if none mentioned"),
  recurrenceMentioned: z
    .boolean()
    .default(false)
    .describe("True if technician stated this fault occurred previously"),
  suggestedPriority: incidentPrioritySchema.describe(
    "Suggested priority: CRITICAL, HIGH, MEDIUM, LOW"
  ),
  faultCategory: faultCategorySchema.default(FaultCategory.OTHER).describe(
    "Database fault category classification"
  ),
  missingInformation: z
    .array(z.string())
    .default([])
    .describe("Required information missing from the report"),
  clarificationQuestion: z
    .string()
    .nullable()
    .describe("Targeted question to ask technician to resolve ambiguity, or null if complete"),
  extractionConfidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence score in the extraction fidelity"),
  needsClarification: z
    .boolean()
    .describe("True if required information is missing or ambiguous"),
  suggestedStatus: z
    .enum(["NEEDS_CLARIFICATION", "DRAFT"])
    .describe("NEEDS_CLARIFICATION if essential fields missing, else DRAFT"),
  details: z.object({
    reported: z.object({
      rawObservations: z.array(z.string()).default([]),
      statedAlarmCode: z.string().nullable().default(null),
      statedActions: z.string().nullable().default(null),
      spokenAssetCode: z.string().nullable().default(null),
    }),
    inferred: z.object({
      inferredEquipmentType: equipmentTypeSchema,
      inferredFaultCategory: faultCategorySchema,
      priorityReasoning: z.array(z.string()).default([]),
    }),
  }),
  isAmbiguous: z.boolean().optional().default(false),
  candidateAssets: z
    .array(
      z.object({
        id: z.string(),
        assetTag: z.string(),
        name: z.string(),
        assetType: z.any(),
        block: z.string().optional().nullable(),
        confidence: z.number().optional(),
      })
    )
    .optional()
    .default([]),
  requiresManualSelection: z.boolean().optional().default(false),
  contradictions: z
    .array(
      z.object({
        fieldA: z.string(),
        fieldB: z.string(),
        severity: z.enum(["ERROR", "WARNING"]),
        code: z.string(),
        message: z.string(),
        resolution: z.string(),
      })
    )
    .optional()
    .default([]),
  originalTranscript: z.string().optional().nullable(),
});

export const extractionInputSchema = z.object({
  transcript: z.string().min(1, "Transcript cannot be empty"),
  site: z.object({
    id: z.string(),
    name: z.string(),
    code: z.string(),
    location: z.string().optional().nullable(),
  }),
  selectedAsset: z
    .object({
      id: z.string(),
      assetTag: z.string(),
      name: z.string(),
      assetType: z.any(),
      block: z.string().optional().nullable(),
      row: z.string().optional().nullable(),
      manufacturer: z.string().optional().nullable(),
      model: z.string().optional().nullable(),
      ratedCapacityKw: z.number().optional().nullable(),
    })
    .optional()
    .nullable(),
  knownSiteAssets: z
    .array(
      z.object({
        id: z.string(),
        assetTag: z.string(),
        name: z.string(),
        assetType: z.any(),
        block: z.string().optional().nullable(),
        model: z.string().optional().nullable(),
        row: z.string().optional().nullable(),
      })
    )
    .optional(),
  previousIncidents: z
    .array(
      z.object({
        id: z.string(),
        ticketNumber: z.string(),
        title: z.string(),
        faultCategory: z.string(),
        priority: z.string(),
        createdAt: z.union([z.string(), z.date()]),
        errorCode: z.string().optional().nullable(),
      })
    )
    .optional(),
});
