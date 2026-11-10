import { describe, it, expect } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  DeterministicAssetMatcher,
  normalizeAssetTag,
} from "@/modules/assets/asset-matcher";

const prisma = new PrismaClient();

// ponytail: test suite 4 covering deterministic asset matching & site boundaries
describe("Audit 4: Deterministic Asset Matching & Site Scoping", () => {
  it("normalizes asset tag variations correctly", () => {
    expect(normalizeAssetTag("INV-01")).toBe("inv01");
    expect(normalizeAssetTag("inv 01")).toBe("inv01");
    expect(normalizeAssetTag("inv_01")).toBe("inv01");
    expect(normalizeAssetTag("  INV - 01  ")).toBe("inv01");
  });

  it("matches exact asset tags from the selected site", async () => {
    const bhadlaSite = await prisma.site.findFirst({ where: { code: "SUN-BHA-04" } });
    expect(bhadlaSite).not.toBeNull();

    const matcher = new DeterministicAssetMatcher();
    const result = await matcher.matchAssetAgainstDatabase(prisma, {
      siteId: bhadlaSite!.id,
      transcript: "Inverter INV-01 is tripping on ground fault",
    });

    expect(result.status).toBe("EXACT_MATCH");
    expect(result.matchedAsset).not.toBeNull();
    expect(result.matchedAsset?.assetTag).toBe("INV-01");
    expect(result.requiresManualSelection).toBe(false);
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it("handles spoken variations of asset tags (e.g. 'inv 01')", async () => {
    const bhadlaSite = await prisma.site.findFirst({ where: { code: "SUN-BHA-04" } });
    expect(bhadlaSite).not.toBeNull();

    const matcher = new DeterministicAssetMatcher();
    const result = await matcher.matchAssetAgainstDatabase(prisma, {
      siteId: bhadlaSite!.id,
      transcript: "inverter inv 01 me alarm aa raha hai",
    });

    expect(result.matchedAsset).not.toBeNull();
    expect(result.matchedAsset?.assetTag).toBe("INV-01");
  });

  it("flags ambiguous mentions with candidate suggestions", async () => {
    const bhadlaSite = await prisma.site.findFirst({ where: { code: "SUN-BHA-04" } });
    expect(bhadlaSite).not.toBeNull();

    const matcher = new DeterministicAssetMatcher();
    const result = await matcher.matchAssetAgainstDatabase(prisma, {
      siteId: bhadlaSite!.id,
      extractedCode: "Central Inverter",
      transcript: "Central Inverter is making a humming sound and not generating power",
    });

    // Generic name without specific tag should be flagged as ambiguous match
    expect(result.status).toBe("AMBIGUOUS_MATCH");
    expect(result.requiresManualSelection).toBe(true);
    // It should suggest candidate assets for the site
    expect(result.candidates.length).toBeGreaterThanOrEqual(2);
  });

  it("rejects cross-site asset tags (never matches asset belonging to another site)", async () => {
    const bhadlaSite = await prisma.site.findFirst({ where: { code: "SUN-BHA-04" } });
    const pavagadaSite = await prisma.site.findFirst({ where: { code: "SUN-PAV-02" } });
    expect(bhadlaSite).not.toBeNull();
    expect(pavagadaSite).not.toBeNull();

    const matcher = new DeterministicAssetMatcher();
    // Searching for Pavagada asset (TR-02 or TRK-M-PV-01) while scoped to Bhadla site
    const result = await matcher.matchAssetAgainstDatabase(prisma, {
      siteId: bhadlaSite!.id,
      transcript: "TR-02 transformer high temperature alert",
    });

    // Must NEVER match an asset from Pavagada when searching inside Bhadla
    if (result.matchedAsset) {
      expect(result.matchedAsset.siteId).toBe(bhadlaSite!.id);
      expect(result.matchedAsset.assetTag).not.toBe("TR-02");
    } else {
      expect(result.matchedAsset).toBeNull();
    }
  });

  it("returns NO_REFERENCE safely when query contains no equipment reference", async () => {
    const bhadlaSite = await prisma.site.findFirst({ where: { code: "SUN-BHA-04" } });
    const matcher = new DeterministicAssetMatcher();
    const result = await matcher.matchAssetAgainstDatabase(prisma, {
      siteId: bhadlaSite!.id,
      transcript: "General routine maintenance completed today on site",
    });

    expect(result.status).toBe("NO_REFERENCE");
    expect(result.matchedAsset).toBeNull();
  });
});
