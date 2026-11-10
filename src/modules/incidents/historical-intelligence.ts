import { PrismaClient, IncidentStatus, IncidentPriority, FaultCategory } from "@prisma/client";
import { db as defaultDb } from "@/lib/db";
import { DeterministicAssetMatcher, normalizeAssetTag } from "@/modules/assets/asset-matcher";

export type HistoricalIncidentLabel =
  | "Same asset"
  | "Similar reported symptom"
  | "Previous incident"
  | "Unresolved incident";

export const UNRESOLVED_INCIDENT_STATUSES: IncidentStatus[] = [
  IncidentStatus.DRAFT,
  IncidentStatus.NEEDS_CLARIFICATION,
  IncidentStatus.SUBMITTED,
  IncidentStatus.ACKNOWLEDGED,
  IncidentStatus.IN_PROGRESS,
];

export const ROOT_CAUSE_DISCLAIMER_TITLE =
  "Safety Notice: Symptom Similarity Does Not Imply Identical Root Cause";

export const ROOT_CAUSE_DISCLAIMER =
  "Never claim that two incidents have the same root cause merely because their descriptions are similar. Similar reported symptoms, alarms, or operational observations do not guarantee identical failure mechanisms or root causes. Always perform on-site electrical validation and physical inspection before concluding cause.";

export interface HistoricalIncidentItem {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  symptoms: string | null;
  errorCode: string | null;
  status: IncidentStatus;
  priority: IncidentPriority;
  faultCategory: FaultCategory;
  createdAt: Date;
  resolvedAt: Date | null;
  closedAt: Date | null;
  asset: {
    id: string;
    assetTag: string;
    name: string;
    assetType: string;
    block?: string | null;
    row?: string | null;
  } | null;
  // Previously recorded actions (Req 4)
  recordedActions: string[];
  resolutionNotes: string | null;
  // Similarity metrics (Req 2)
  symptomSimilarityScore: number;
  matchingSymptomKeywords: string[];
  // Required Labels (Req: Label results as...)
  labels: HistoricalIncidentLabel[];
}

export interface RepeatedSymptomItem {
  symptomKey: string;
  displayName: string;
  occurrenceCount: number;
  firstReportedAt: Date;
  lastReportedAt: Date;
  incidentNumbers: string[];
  isCurrentIncidentMatch: boolean;
}

export interface HistoricalIntelligenceReport {
  currentIncidentId?: string | null;
  siteId: string;
  targetAsset: {
    id: string;
    assetTag: string;
    name: string;
    assetType: string;
  } | null;
  totalPreviousIncidents: number;
  sameAssetCount: number;
  similarSymptomsCount: number;
  unresolvedCount: number;
  sameAssetIncidents: HistoricalIncidentItem[];
  similarSymptomIncidents: HistoricalIncidentItem[];
  allRelevantIncidents: HistoricalIncidentItem[];
  repeatedSymptoms: RepeatedSymptomItem[];
  unresolvedIncidents: HistoricalIncidentItem[];
  rootCauseDisclaimer: string;
  rootCauseDisclaimerTitle: string;
}

export interface AnalyzeHistoricalOptions {
  siteId: string;
  currentIncidentId?: string | null;
  assetId?: string | null;
  assetTag?: string | null;
  symptoms?: string[] | string | null;
  description?: string | null;
  title?: string | null;
  errorCode?: string | null;
  limit?: number;
}

/** Common English and Hinglish noise words filtered out during symptom text similarity calculation */
const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "in", "on", "at", "to", "for", "with", "by", "of",
  "is", "are", "was", "were", "be", "been", "this", "that", "it", "has", "have", "had",
  "hai", "hain", "ho", "hua", "gaya", "gaye", "rahi", "raha", "rahe", "tha", "the",
  "thi", "ka", "ke", "ki", "se", "ko", "pe", "par", "me", "mein", "aur", "ya", "bhi",
  "ne", "subah", "abhi", "kripya", "bhai", "kuch", "bahut", "sirf", "lekin"
]);

/** Solar O&M Domain Symptom Lexicon for deterministic keyword matching */
const DOMAIN_SYMPTOM_GROUPS: Record<string, { label: string; terms: string[] }> = {
  over_temperature: {
    label: "Thermal / Over-Temperature",
    terms: ["overtemp", "temperature", "heat", "overheating", "overheated", "heatsink", "fan", "blower", "cooling", "thermal", "high-temp", "e-14", "e-402"],
  },
  tripping: {
    label: "Tripping / Unexpected Shutdown",
    terms: ["trip", "tripped", "tripping", "offline", "shutdown", "shut-down", "band", "f-042", "restart"],
  },
  earth_fault: {
    label: "DC / AC Earth & Insulation Fault",
    terms: ["earth", "ground", "insulation", "leakage", "isolation", "r-iso", "ground-fault"],
  },
  smoke_fire_arc: {
    label: "Smoke / Arc / Insulation Burning",
    terms: ["smoke", "fire", "burning", "burnt", "arc", "spark", "smell", "acrid", "charred", "flame"],
  },
  tracker_failure: {
    label: "Tracker Slew Drive / Mechanical Jam",
    terms: ["tracker", "slew", "drive", "jam", "jammed", "motor", "inclinometer", "tilt", "stuck", "clicking", "gearbox"],
  },
  blown_fuse: {
    label: "Blown String Fuse / Zero Current",
    terms: ["fuse", "blown", "blown-fuse", "zero-current", "open-circuit", "string-drop"],
  },
  comm_loss: {
    label: "SCADA / Telemetry Communication Loss",
    terms: ["comm", "communication", "scada", "telemetry", "modbus", "rs485", "disconnected", "offline-sync"],
  },
};

/**
 * Tokenizes text into normalized non-stopword tokens.
 */
export function extractSignificantTokens(text: string): string[] {
  if (!text) return [];
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\-\s]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);

  const result: string[] = [];
  for (const w of words) {
    if (w.length > 2 && !STOP_WORDS.has(w)) {
      result.push(w);
    }
    if (w.includes("-")) {
      const subParts = w.split("-").map((p) => p.trim()).filter((p) => p.length > 2 && !STOP_WORDS.has(p));
      result.push(...subParts);
    }
  }

  return Array.from(new Set(result));
}

/**
 * Computes Jaccard similarity coefficient between two sets of tokens (0.0 to 1.0).
 */
export function computeTokenJaccard(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : Number((intersection / union).toFixed(3));
}

/**
 * Evaluates whether two incident symptom payloads are similar based on:
 * 1. Normalized token overlap (Jaccard similarity).
 * 2. Shared domain symptom groups (e.g. both reporting over-temp / fan failure).
 * 3. Matching exact error/alarm codes.
 */
export function evaluateSymptomSimilarity(
  currentText: string,
  candidateText: string,
  currentErrorCode?: string | null,
  candidateErrorCode?: string | null
): { isSimilar: boolean; score: number; matchedKeywords: string[] } {
  const currentTokens = extractSignificantTokens(currentText);
  const candidateTokens = extractSignificantTokens(candidateText);

  // 1. Direct Token Jaccard Similarity
  const jaccardScore = computeTokenJaccard(currentTokens, candidateTokens);

  // 2. Identify shared domain symptom groups
  const matchedKeywords: string[] = [];
  const currentLower = currentText.toLowerCase();
  const candidateLower = candidateText.toLowerCase();

  for (const [groupKey, group] of Object.entries(DOMAIN_SYMPTOM_GROUPS)) {
    const currentMatches = group.terms.filter((t) => currentLower.includes(t));
    const candidateMatches = group.terms.filter((t) => candidateLower.includes(t));

    if (currentMatches.length > 0 && candidateMatches.length > 0) {
      matchedKeywords.push(group.label);
    }
  }

  // 3. Error code match
  const errorCodeMatch = Boolean(
    currentErrorCode &&
    candidateErrorCode &&
    currentErrorCode.trim().toLowerCase() === candidateErrorCode.trim().toLowerCase()
  );

  if (errorCodeMatch) {
    matchedKeywords.push(`Alarm Code Match (${currentErrorCode})`);
  }

  // Combine signals into overall similarity score
  let score = jaccardScore;
  if (errorCodeMatch) {
    score = Math.max(score, 0.85);
  } else if (matchedKeywords.length >= 2) {
    score = Math.max(score, 0.65);
  } else if (matchedKeywords.length === 1) {
    score = Math.max(score, 0.35);
  }

  // Threshold for similarity: 0.20 or any matched domain symptom keyword or error code
  const isSimilar = score >= 0.20 || matchedKeywords.length > 0 || errorCodeMatch;

  return {
    isSimilar,
    score: Number(Math.min(score, 1.0).toFixed(2)),
    matchedKeywords,
  };
}

/**
 * Historical Incident Intelligence Service.
 *
 * Adheres to:
 * - Deterministic asset matching and simple text similarity.
 * - Negative constraint: NEVER claim that two incidents have the same root cause merely because descriptions are similar.
 * - Categorizes and labels results as:
 *     - "Same asset"
 *     - "Similar reported symptom"
 *     - "Previous incident"
 *     - "Unresolved incident"
 *
 * ponytail: deterministic token-based similarity and SQL index lookup; sufficient for standard solar O&M triage,
 * upgrade path: pgvector semantic embeddings / vector search if natural language phrasing diverges significantly.
 */
export class HistoricalIntelligenceService {
  private readonly assetMatcher: DeterministicAssetMatcher;

  constructor(private readonly prisma: PrismaClient = defaultDb) {
    this.assetMatcher = new DeterministicAssetMatcher();
  }

  /**
   * Retrieves and analyzes previous incidents for an asset and site,
   * detecting symptom similarities, repeated patterns, unresolved tickets, and past actions.
   */
  public async analyzeHistoricalIntelligence(
    options: AnalyzeHistoricalOptions
  ): Promise<HistoricalIntelligenceReport> {
    const { siteId, currentIncidentId, assetTag, symptoms, description, title, errorCode, limit = 20 } = options;

    let targetAssetId = options.assetId || null;
    let targetAsset: { id: string; assetTag: string; name: string; assetType: string } | null = null;

    // 1. Resolve Target Asset using Deterministic Asset Matching if only tag/name is provided
    if (targetAssetId) {
      const asset = await this.prisma.asset.findUnique({
        where: { id: targetAssetId },
        select: { id: true, assetTag: true, name: true, assetType: true },
      });
      if (asset) {
        targetAsset = asset;
      }
    } else if (assetTag) {
      const matchResult = await this.assetMatcher.matchAssetAgainstDatabase(this.prisma, {
        extractedCode: assetTag,
        siteId,
      });
      if (matchResult.matchedAsset) {
        targetAssetId = matchResult.matchedAsset.id;
        targetAsset = {
          id: matchResult.matchedAsset.id,
          assetTag: matchResult.matchedAsset.assetTag,
          name: matchResult.matchedAsset.name,
          assetType: matchResult.matchedAsset.assetType,
        };
      }
    }

    // Combine current symptoms and description text for similarity comparisons
    const currentSymptomsText = [
      Array.isArray(symptoms) ? symptoms.join(", ") : symptoms || "",
      description || "",
      title || "",
    ]
      .filter(Boolean)
      .join(" ");

    // 2. Query historical incidents from Database:
    // We retrieve:
    // A) Incidents on the same asset (if targetAssetId is known)
    // B) Recent incidents on the same site to detect similar symptoms across equipment
    const dbIncidents = await this.prisma.incident.findMany({
      where: {
        siteId,
        ...(currentIncidentId ? { id: { not: currentIncidentId } } : {}),
      },
      include: {
        asset: {
          select: {
            id: true,
            assetTag: true,
            name: true,
            assetType: true,
            block: true,
            row: true,
          },
        },
        events: {
          where: {
            OR: [
              { description: { not: null } },
              { title: { contains: "action", mode: "insensitive" } },
              { title: { contains: "repair", mode: "insensitive" } },
              { title: { contains: "work", mode: "insensitive" } },
              { title: { contains: "resolution", mode: "insensitive" } },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit * 2, // Fetch broader window to score and filter
    });

    const historicalItems: HistoricalIncidentItem[] = [];
    const sameAssetItems: HistoricalIncidentItem[] = [];
    const similarSymptomItems: HistoricalIncidentItem[] = [];
    const unresolvedItems: HistoricalIncidentItem[] = [];

    // Track repeated symptoms across historical incidents
    const symptomRepetitionMap = new Map<
      string,
      {
        displayName: string;
        incidentNumbers: string[];
        firstDate: Date;
        lastDate: Date;
        matchesCurrent: boolean;
      }
    >();

    for (const inc of dbIncidents) {
      const isSameAsset = Boolean(targetAssetId && inc.assetId === targetAssetId);
      const isUnresolved = UNRESOLVED_INCIDENT_STATUSES.includes(inc.status);

      // Candidate symptom text
      const candidateSymptomsText = [inc.symptoms || "", inc.description || "", inc.title || ""]
        .filter(Boolean)
        .join(" ");

      // Evaluate text similarity
      const sim = evaluateSymptomSimilarity(
        currentSymptomsText,
        candidateSymptomsText,
        errorCode,
        inc.errorCode
      );

      // Extract previously recorded actions (Req 4)
      const recordedActions: string[] = [];
      if (inc.resolutionNotes && inc.resolutionNotes.trim()) {
        recordedActions.push(`Resolution: ${inc.resolutionNotes.trim()}`);
      }

      for (const ev of inc.events) {
        if (ev.description && ev.description.trim()) {
          recordedActions.push(`${ev.title}: ${ev.description.trim()}`);
        }
      }

      // Assign labels strictly matching requirements:
      // "Label results as:
      // - Same asset
      // - Similar reported symptom
      // - Previous incident
      // - Unresolved incident"
      const labels: HistoricalIncidentLabel[] = ["Previous incident"];

      if (isSameAsset) {
        labels.unshift("Same asset");
      }
      if (sim.isSimilar) {
        labels.push("Similar reported symptom");
      }
      if (isUnresolved) {
        labels.push("Unresolved incident");
      }

      const item: HistoricalIncidentItem = {
        id: inc.id,
        ticketNumber: inc.ticketNumber,
        title: inc.title,
        description: inc.description,
        symptoms: inc.symptoms,
        errorCode: inc.errorCode,
        status: inc.status,
        priority: inc.priority,
        faultCategory: inc.faultCategory,
        createdAt: inc.createdAt,
        resolvedAt: inc.resolvedAt,
        closedAt: inc.closedAt,
        asset: inc.asset
          ? {
              id: inc.asset.id,
              assetTag: inc.asset.assetTag,
              name: inc.asset.name,
              assetType: String(inc.asset.assetType),
              block: inc.asset.block,
              row: inc.asset.row,
            }
          : null,
        recordedActions,
        resolutionNotes: inc.resolutionNotes,
        symptomSimilarityScore: sim.score,
        matchingSymptomKeywords: sim.matchedKeywords,
        labels,
      };

      // Filter relevance: must be either same asset OR similar symptoms OR unresolved on same site
      const isRelevant = isSameAsset || sim.isSimilar;

      if (isRelevant) {
        historicalItems.push(item);
      }
      if (isSameAsset) {
        sameAssetItems.push(item);
      }
      if (sim.isSimilar) {
        similarSymptomItems.push(item);
      }
      if (isSameAsset && isUnresolved) {
        unresolvedItems.push(item);
      }

      // Catalog symptoms for repeated symptom identification (Req 5)
      // We look at recognized symptom groups present in this incident
      if (isSameAsset || sim.isSimilar) {
        for (const [groupKey, group] of Object.entries(DOMAIN_SYMPTOM_GROUPS)) {
          const hasGroupInCandidate = group.terms.some((t) => candidateSymptomsText.toLowerCase().includes(t));
          if (hasGroupInCandidate) {
            const hasGroupInCurrent = currentSymptomsText
              ? group.terms.some((t) => currentSymptomsText.toLowerCase().includes(t))
              : false;

            const existing = symptomRepetitionMap.get(groupKey);
            if (!existing) {
              symptomRepetitionMap.set(groupKey, {
                displayName: group.label,
                incidentNumbers: [inc.ticketNumber],
                firstDate: inc.createdAt,
                lastDate: inc.createdAt,
                matchesCurrent: hasGroupInCurrent,
              });
            } else {
              if (!existing.incidentNumbers.includes(inc.ticketNumber)) {
                existing.incidentNumbers.push(inc.ticketNumber);
              }
              if (inc.createdAt < existing.firstDate) existing.firstDate = inc.createdAt;
              if (inc.createdAt > existing.lastDate) existing.lastDate = inc.createdAt;
              if (hasGroupInCurrent) existing.matchesCurrent = true;
            }
          }
        }
      }
    }

    // Sort all relevant incidents: same asset first, then higher similarity score, then newer date
    historicalItems.sort((a, b) => {
      const aSame = a.labels.includes("Same asset") ? 1 : 0;
      const bSame = b.labels.includes("Same asset") ? 1 : 0;
      if (aSame !== bSame) return bSame - aSame;

      if (Math.abs(b.symptomSimilarityScore - a.symptomSimilarityScore) >= 0.1) {
        return b.symptomSimilarityScore - a.symptomSimilarityScore;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Format repeated reported symptoms (Req 5):
    // Includes symptoms that appear in at least 2 historical incidents, or appear once and match current incident
    const repeatedSymptoms: RepeatedSymptomItem[] = [];
    for (const [key, data] of symptomRepetitionMap.entries()) {
      if (data.incidentNumbers.length >= 2 || (data.incidentNumbers.length >= 1 && data.matchesCurrent)) {
        repeatedSymptoms.push({
          symptomKey: key,
          displayName: data.displayName,
          occurrenceCount: data.incidentNumbers.length + (data.matchesCurrent ? 1 : 0),
          firstReportedAt: data.firstDate,
          lastReportedAt: data.lastDate,
          incidentNumbers: data.incidentNumbers,
          isCurrentIncidentMatch: data.matchesCurrent,
        });
      }
    }

    // Sort repeated symptoms: current matches first, then highest frequency
    repeatedSymptoms.sort((a, b) => {
      if (a.isCurrentIncidentMatch !== b.isCurrentIncidentMatch) {
        return a.isCurrentIncidentMatch ? -1 : 1;
      }
      return b.occurrenceCount - a.occurrenceCount;
    });

    const truncatedRelevant = historicalItems.slice(0, limit);

    return {
      currentIncidentId: currentIncidentId || null,
      siteId,
      targetAsset,
      totalPreviousIncidents: historicalItems.length,
      sameAssetCount: sameAssetItems.length,
      similarSymptomsCount: similarSymptomItems.length,
      unresolvedCount: unresolvedItems.length,
      sameAssetIncidents: sameAssetItems.slice(0, limit),
      similarSymptomIncidents: similarSymptomItems.slice(0, limit),
      allRelevantIncidents: truncatedRelevant,
      repeatedSymptoms,
      unresolvedIncidents: unresolvedItems,
      rootCauseDisclaimer: ROOT_CAUSE_DISCLAIMER,
      rootCauseDisclaimerTitle: ROOT_CAUSE_DISCLAIMER_TITLE,
    };
  }
}

/**
 * Singleton factory for HistoricalIntelligenceService.
 */
let serviceInstance: HistoricalIntelligenceService | null = null;
export function getHistoricalIntelligenceService(prisma: PrismaClient = defaultDb): HistoricalIntelligenceService {
  if (!serviceInstance || serviceInstance["prisma"] !== prisma) {
    serviceInstance = new HistoricalIntelligenceService(prisma);
  }
  return serviceInstance;
}
