import { AssetType, PrismaClient } from "@prisma/client";
import { db as defaultDb } from "@/lib/db";

export type AssetMatchStatus =
  | "EXACT_MATCH"        // Single unambiguous match with high confidence (>= 0.85)
  | "AMBIGUOUS_MATCH"    // Multiple candidate assets matched with comparable confidence
  | "NO_MATCH"           // Extracted code or reference does not exist in the site inventory
  | "SITE_MISMATCH"      // Asset exists in the system but belongs to a different site
  | "NO_REFERENCE";      // No asset code or equipment reference was detected in the input

export interface MatchedAssetCandidate {
  id: string;
  assetTag: string;
  name: string;
  assetType: AssetType;
  block?: string | null;
  row?: string | null;
  model?: string | null;
  siteId: string;
  siteName?: string;
  confidence: number;
  matchReason: string;
}

export interface AssetMatchResult {
  status: AssetMatchStatus;
  matchedAsset: MatchedAssetCandidate | null;
  candidates: MatchedAssetCandidate[];
  extractedCode: string | null;
  selectedSiteId: string;
  confidence: number;
  reason: string;
  requiresManualSelection: boolean;
  clarificationPrompt: string | null;
}

export interface MatchAssetOptions {
  /** If true, checks across all sites to see if an unknown code belongs to another site */
  checkCrossSite?: boolean;
  /** Explicit list of all assets in other sites for offline/in-memory cross-site detection */
  crossSiteAssets?: MatchedAssetCandidate[];
  /** Minimum confidence threshold to consider a match valid without manual confirmation (default: 0.85) */
  minConfidenceThreshold?: number;
}

/**
 * Normalizes an asset code or tag by stripping non-alphanumeric characters and lowercasing.
 * e.g. "BHA-INV-01" -> "bhainv01", "INV 01" -> "inv01", "SCB_01.A" -> "scb01a"
 */
export function normalizeAssetTag(tag: string): string {
  return tag.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

/**
 * Tokenizes text into words and alphanumeric tokens.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

/**
 * Deterministic Solar Asset Matcher.
 * Adheres strictly to the negative constraints:
 * - Never silently select an unrelated asset.
 * - Always identify ambiguous matches and request manual selection.
 * - Reject unknown asset references and cross-site assets.
 */
export class DeterministicAssetMatcher {
  private readonly minConfidenceThreshold: number;

  constructor(options?: { minConfidenceThreshold?: number }) {
    this.minConfidenceThreshold = options?.minConfidenceThreshold ?? 0.85;
  }

  /**
   * Evaluates how well a candidate asset matches a target query code or spoken phrase.
   * Returns a confidence score between 0.0 and 1.0, and a descriptive reason.
   */
  public scoreCandidate(
    candidate: { assetTag: string; name: string; block?: string | null },
    queryCode: string
  ): { score: number; reason: string } {
    const rawQuery = queryCode.trim();
    if (!rawQuery) return { score: 0, reason: "Empty query" };

    const upperQuery = rawQuery.toUpperCase();
    const upperTag = candidate.assetTag.toUpperCase();
    const normQuery = normalizeAssetTag(rawQuery);
    const normTag = normalizeAssetTag(candidate.assetTag);
    const normName = normalizeAssetTag(candidate.name);

    // 1. Exact verbatim tag match (e.g. "BHA-INV-01" === "BHA-INV-01")
    if (upperTag === upperQuery) {
      return { score: 1.0, reason: "Exact asset tag match" };
    }

    // 2. Normalized alphanumeric match (e.g. "BHA INV 01" matches "BHA-INV-01", "INV_01" matches "INV-01")
    if (normTag === normQuery && normQuery.length >= 2) {
      return { score: 0.98, reason: "Normalized asset tag match" };
    }

    // 3. Exact full name match (e.g. "Central Inverter 1" matches "Central Inverter 1")
    if (candidate.name.trim().toLowerCase() === rawQuery.toLowerCase()) {
      return { score: 0.95, reason: "Exact asset name match" };
    }

    // 4. Suffix match where site prefix is omitted in speech:
    // e.g. technician says "INV-01" while registered tag is "BHA-INV-01" or "SUN-BHA-INV-01"
    if (upperTag.endsWith("-" + upperQuery) || upperTag.endsWith("_" + upperQuery)) {
      return { score: 0.90, reason: "Asset tag suffix match (site prefix omitted)" };
    }
    if (normTag.endsWith(normQuery) && normQuery.length >= 4) {
      return { score: 0.88, reason: "Normalized asset tag suffix match" };
    }

    // 5. Prefix match where technician included site prefix but asset tag is local:
    // e.g. technician says "BHA-INV-01" while registered tag is "INV-01"
    if (upperQuery.endsWith("-" + upperTag) || upperQuery.endsWith("_" + upperTag)) {
      return { score: 0.89, reason: "Query suffix matches local asset tag" };
    }
    if (normQuery.endsWith(normTag) && normTag.length >= 4) {
      return { score: 0.87, reason: "Query normalized suffix matches local asset tag" };
    }

    // 6. Name contains query phrase or query contains full name
    if (normName.includes(normQuery) && normQuery.length >= 5) {
      return { score: 0.82, reason: "Asset name contains query string" };
    }

    // 7. Partial token overlap (e.g. "Inverter 1" matches name "Central Inverter 1 (SMA 2.5MW)")
    const queryTokens = tokenize(rawQuery);
    const nameTokens = tokenize(candidate.name);
    const tagTokens = tokenize(candidate.assetTag);
    const allCandidateTokens = new Set([...nameTokens, ...tagTokens]);

    if (queryTokens.length >= 2) {
      const matchCount = queryTokens.filter((t) => allCandidateTokens.has(t)).length;
      if (matchCount === queryTokens.length) {
        return { score: 0.80, reason: "All query tokens match asset name/tag" };
      }
      if (matchCount >= 2 && matchCount / queryTokens.length >= 0.66) {
        return { score: 0.65, reason: "Partial token match" };
      }
    }

    return { score: 0.0, reason: "No significant match" };
  }

  /**
   * Scans a spoken transcript to extract candidate asset references or tags.
   */
  public extractCandidateReferencesFromTranscript(
    transcript: string,
    siteAssets: Array<{ assetTag: string; name: string }>
  ): string[] {
    const candidates = new Set<string>();
    const clean = transcript.trim();
    if (!clean) return [];

    // 1. Direct tag matches present in transcript
    for (const asset of siteAssets) {
      // Regex boundary for tag or spaced tag: "BHA-INV-01" or "BHA INV 01"
      const escaped = asset.assetTag.replace(/[-_.]/g, "[-_.\\s]?");
      const tagRegex = new RegExp(`\\b${escaped}\\b`, "i");
      if (tagRegex.test(clean)) {
        candidates.add(asset.assetTag);
      }
    }

    // 2. Common solar equipment patterns:
    // e.g. "INV-01", "INV 02", "SCB-04-A", "TR-01", "SMB-12", "STR-INV-03", "TRK-01"
    const tagPattern = /\b([A-Za-z]{2,5}[-_.\s]?[A-Za-z0-9]{1,4}(?:[-_.\s]?[A-Za-z0-9]{1,3})?)\b/g;
    let match: RegExpExecArray | null;
    while ((match = tagPattern.exec(clean)) !== null) {
      if (!match[1]) continue;
      const token = match[1].trim();
      // Filter out non-equipment words like "THE", "THIS", "ERROR", "ALARM"
      const stopwords = new Set([
        "ERROR",
        "ALARM",
        "FAULT",
        "ISSUE",
        "TRIP",
        "LOTO",
        "PHIR",
        "HUA",
        "YEH",
        "KA",
        "KI",
        "MEIN",
        "SE",
        "HAIN",
        "DEKHA",
        "SHOW",
        "CODE",
      ]);
      const normalizedUpper = token.toUpperCase().replace(/\s+/, "-");
      if (!stopwords.has(normalizedUpper) && normalizedUpper.length >= 3) {
        // Only add if it contains digits or known solar prefixes
        if (
          /\d/.test(normalizedUpper) ||
          /^(INV|SCB|SMB|TR|XFMR|MOD|TRK|BHA|PAV|REW)/.test(normalizedUpper)
        ) {
          candidates.add(normalizedUpper);
        }
      }
    }

    // 3. Spoken equipment name patterns: e.g. "inverter 1", "transformer 2", "combiner box 4"
    const spokenNamePattern = /\b(inverter|transformer|combiner\s*box|scb|smb|string\s*inverter)\s*(\d{1,3}[a-zA-Z]?)\b/gi;
    while ((match = spokenNamePattern.exec(clean)) !== null) {
      if (!match[1] || !match[2]) continue;
      const typeStr = match[1].trim();
      const numStr = match[2].trim();
      candidates.add(`${typeStr} ${numStr}`.toUpperCase());
    }

    return Array.from(candidates);
  }

  /**
   * Deterministically matches an extracted code or transcript against site assets.
   */
  public matchAsset(
    query: {
      extractedCode?: string | null;
      transcript?: string | null;
      selectedAssetId?: string | null;
    },
    siteContext: {
      siteId: string;
      siteName?: string;
      siteAssets: MatchedAssetCandidate[];
    },
    options?: MatchAssetOptions
  ): AssetMatchResult {
    const { siteId, siteName = "Selected Site", siteAssets } = siteContext;
    const threshold = options?.minConfidenceThreshold ?? this.minConfidenceThreshold;

    // 1. Explicit asset pre-selection validation:
    // If technician or caller already supplied a selectedAssetId, verify that it belongs to this site!
    if (query.selectedAssetId) {
      const found = siteAssets.find((a) => a.id === query.selectedAssetId);
      if (found) {
        return {
          status: "EXACT_MATCH",
          matchedAsset: { ...found, confidence: 1.0, matchReason: "Explicitly selected asset verified on site" },
          candidates: [found],
          extractedCode: found.assetTag,
          selectedSiteId: siteId,
          confidence: 1.0,
          reason: `Asset '${found.assetTag}' verified on site '${siteName}'.`,
          requiresManualSelection: false,
          clarificationPrompt: null,
        };
      } else {
        // Selected asset ID DOES NOT belong to this site!
        return {
          status: "SITE_MISMATCH",
          matchedAsset: null,
          candidates: [],
          extractedCode: query.extractedCode || null,
          selectedSiteId: siteId,
          confidence: 0.0,
          reason: `Selected asset does not belong to site '${siteName}'.`,
          requiresManualSelection: true,
          clarificationPrompt: `The specified asset is not registered under ${siteName}. Please select an asset from this site.`,
        };
      }
    }

    // 2. Identify candidate codes to evaluate:
    let candidatesToEvaluate: string[] = [];
    if (query.extractedCode && query.extractedCode.trim()) {
      candidatesToEvaluate.push(query.extractedCode.trim());
    }
    if (query.transcript && query.transcript.trim()) {
      const transcriptCandidates = this.extractCandidateReferencesFromTranscript(
        query.transcript,
        siteAssets
      );
      for (const tc of transcriptCandidates) {
        if (!candidatesToEvaluate.some((c) => c.toUpperCase() === tc.toUpperCase())) {
          candidatesToEvaluate.push(tc);
        }
      }
    }

    // If no code and no mentions in transcript:
    if (candidatesToEvaluate.length === 0) {
      return {
        status: "NO_REFERENCE",
        matchedAsset: null,
        candidates: [],
        extractedCode: null,
        selectedSiteId: siteId,
        confidence: 0.0,
        reason: "No asset code or equipment reference was mentioned in the report.",
        requiresManualSelection: true,
        clarificationPrompt: `Which specific equipment tag at ${siteName} (e.g. INV-01, SCB-04) is experiencing this fault?`,
      };
    }

    // 3. Score all site assets against all candidates:
    const candidateMap = new Map<string, MatchedAssetCandidate>();

    for (const code of candidatesToEvaluate) {
      for (const asset of siteAssets) {
        const { score, reason } = this.scoreCandidate(asset, code);
        if (score > 0.5) {
          const existing = candidateMap.get(asset.id);
          if (!existing || score > existing.confidence) {
            candidateMap.set(asset.id, {
              ...asset,
              confidence: score,
              matchReason: reason,
            });
          }
        }
      }
    }

    const scoredCandidates = Array.from(candidateMap.values()).sort(
      (a, b) => b.confidence - a.confidence
    );

    const primaryExtractedCode = candidatesToEvaluate[0] || null;

    // 4. Cross-Site Verification:
    // If an asset code has an exact or high-confidence match on ANOTHER site,
    // while on this site it is either absent or only a weak/suffix match (< 0.95),
    // then this is a cross-site reference (SITE_MISMATCH).
    if (options?.crossSiteAssets && options.crossSiteAssets.length > 0 && primaryExtractedCode) {
      let crossSiteMatch: MatchedAssetCandidate | null = null;
      let crossSiteScore = 0;

      for (const otherAsset of options.crossSiteAssets) {
        if (otherAsset.siteId !== siteId) {
          const { score } = this.scoreCandidate(otherAsset, primaryExtractedCode);
          if (score >= 0.95 && score > crossSiteScore) {
            crossSiteMatch = otherAsset;
            crossSiteScore = score;
          }
        }
      }

      const localTopScore = scoredCandidates[0]?.confidence ?? 0;
      if (crossSiteMatch && crossSiteScore > localTopScore) {
        const otherSiteName = crossSiteMatch.siteName || "another site";
        return {
          status: "SITE_MISMATCH",
          matchedAsset: null,
          candidates: [],
          extractedCode: primaryExtractedCode,
          selectedSiteId: siteId,
          confidence: 0.0,
          reason: `Asset '${primaryExtractedCode}' belongs to ${otherSiteName}, not ${siteName}.`,
          requiresManualSelection: true,
          clarificationPrompt: `Which specific equipment tag at ${siteName} is experiencing this issue? Asset '${primaryExtractedCode}' belongs to ${otherSiteName}.`,
        };
      }
    }

    // If completely no match found on site:
    if (scoredCandidates.length === 0) {
      return {
        status: "NO_MATCH",
        matchedAsset: null,
        candidates: [],
        extractedCode: primaryExtractedCode,
        selectedSiteId: siteId,
        confidence: 0.0,
        reason: `Unknown asset code '${primaryExtractedCode}'. Not found in ${siteName} inventory.`,
        requiresManualSelection: true,
        clarificationPrompt: `Which specific equipment tag at ${siteName} is experiencing this fault? Asset '${primaryExtractedCode}' was not found in the site inventory.`,
      };
    }

    const bestCandidate = scoredCandidates[0];
    if (!bestCandidate) {
      return {
        status: "NO_MATCH",
        matchedAsset: null,
        candidates: [],
        extractedCode: primaryExtractedCode,
        selectedSiteId: siteId,
        confidence: 0.0,
        reason: "No matching asset found in site inventory.",
        requiresManualSelection: true,
        clarificationPrompt: `Please select an asset registered under ${siteName}.`,
      };
    }

    // 5. Evaluate Ambiguity:
    const topScore = bestCandidate.confidence;
    const topCandidates = scoredCandidates.filter((c) => c.confidence >= topScore - 0.05);

    if (topCandidates.length > 1) {
      const candidateTags = topCandidates.map((c) => c.assetTag).join(", ");
      return {
        status: "AMBIGUOUS_MATCH",
        matchedAsset: null, // NEVER silently pick one!
        candidates: topCandidates,
        extractedCode: primaryExtractedCode,
        selectedSiteId: siteId,
        confidence: 0.5,
        reason: `Ambiguous asset match for '${primaryExtractedCode}'. Multiple potential candidates found: [${candidateTags}].`,
        requiresManualSelection: true,
        clarificationPrompt: `Which specific equipment tag at ${siteName} among [${candidateTags}] is experiencing this issue? Multiple assets match '${primaryExtractedCode}'.`,
      };
    }

    // 6. Confident Single Match:
    if (bestCandidate.confidence >= threshold) {
      return {
        status: "EXACT_MATCH",
        matchedAsset: bestCandidate,
        candidates: [bestCandidate],
        extractedCode: primaryExtractedCode,
        selectedSiteId: siteId,
        confidence: bestCandidate.confidence,
        reason: `Unambiguous match: ${bestCandidate.matchReason}`,
        requiresManualSelection: false,
        clarificationPrompt: null,
      };
    }

    // Low confidence match (< threshold): Request manual confirmation
    return {
      status: "AMBIGUOUS_MATCH",
      matchedAsset: null,
      candidates: scoredCandidates.slice(0, 3),
      extractedCode: primaryExtractedCode,
      selectedSiteId: siteId,
      confidence: bestCandidate.confidence,
      reason: `Match confidence (${Math.round(bestCandidate.confidence * 100)}%) is below required threshold (${Math.round(threshold * 100)}%). Manual selection required.`,
      requiresManualSelection: true,
      clarificationPrompt: `Did you mean '${bestCandidate.assetTag}' (${bestCandidate.name})? Please confirm or manually select an asset.`,
    };
  }

  /**
   * Helper that queries the Prisma database to match an asset against live records.
   */
  public async matchAssetAgainstDatabase(
    prisma: PrismaClient,
    query: {
      extractedCode?: string | null;
      transcript?: string | null;
      selectedAssetId?: string | null;
      siteId: string;
      organizationId?: string;
    }
  ): Promise<AssetMatchResult> {
    const site = await prisma.site.findUnique({
      where: { id: query.siteId },
      select: { id: true, name: true, code: true, organizationId: true },
    });

    if (!site) {
      return {
        status: "NO_MATCH",
        matchedAsset: null,
        candidates: [],
        extractedCode: query.extractedCode || null,
        selectedSiteId: query.siteId,
        confidence: 0.0,
        reason: "Specified site ID does not exist.",
        requiresManualSelection: true,
        clarificationPrompt: "Please select a valid site.",
      };
    }

    // Fetch site assets
    const dbSiteAssets = await prisma.asset.findMany({
      where: { siteId: site.id },
      select: {
        id: true,
        assetTag: true,
        name: true,
        assetType: true,
        block: true,
        row: true,
        model: true,
        siteId: true,
      },
      orderBy: [{ block: "asc" }, { assetTag: "asc" }],
    });

    const siteAssets: MatchedAssetCandidate[] = dbSiteAssets.map((a) => ({
      ...a,
      siteName: site.name,
      confidence: 0,
      matchReason: "",
    }));

    // Fetch assets from other sites within organization for cross-site detection
    const dbOtherAssets = await prisma.asset.findMany({
      where: {
        siteId: { not: site.id },
        ...(query.organizationId ? { site: { organizationId: query.organizationId } } : {}),
      },
      select: {
        id: true,
        assetTag: true,
        name: true,
        assetType: true,
        block: true,
        row: true,
        model: true,
        siteId: true,
        site: { select: { name: true } },
      },
      take: 200,
    });

    const crossSiteAssets: MatchedAssetCandidate[] = dbOtherAssets.map((a) => ({
      id: a.id,
      assetTag: a.assetTag,
      name: a.name,
      assetType: a.assetType,
      block: a.block,
      row: a.row,
      model: a.model,
      siteId: a.siteId,
      siteName: a.site.name,
      confidence: 0,
      matchReason: "",
    }));

    return this.matchAsset(
      {
        extractedCode: query.extractedCode,
        transcript: query.transcript,
        selectedAssetId: query.selectedAssetId,
      },
      {
        siteId: site.id,
        siteName: site.name,
        siteAssets,
      },
      {
        checkCrossSite: true,
        crossSiteAssets,
      }
    );
  }
}

let defaultAssetMatcher: DeterministicAssetMatcher | null = null;

export function getAssetMatcher(): DeterministicAssetMatcher {
  if (!defaultAssetMatcher) {
    defaultAssetMatcher = new DeterministicAssetMatcher();
  }
  return defaultAssetMatcher;
}
