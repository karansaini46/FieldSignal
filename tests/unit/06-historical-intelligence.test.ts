import { describe, it, expect } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  HistoricalIntelligenceService,
  ROOT_CAUSE_DISCLAIMER,
  ROOT_CAUSE_DISCLAIMER_TITLE,
} from "@/modules/incidents/historical-intelligence";

const prisma = new PrismaClient();

// ponytail: test suite 10 covering historical incident intelligence & root cause separation
describe("Audit 10: Historical Incident Intelligence & Root Cause Separation", () => {
  const service = new HistoricalIntelligenceService(prisma);

  it("retrieves previous incidents for the same asset", async () => {
    const bhadlaSite = await prisma.site.findFirst({ where: { code: "SUN-BHA-04" } });
    expect(bhadlaSite).not.toBeNull();

    const asset = await prisma.asset.findFirst({
      where: { siteId: bhadlaSite!.id, incidents: { some: {} } },
    });
    expect(asset).not.toBeNull();

    const report = await service.analyzeHistoricalIntelligence({
      siteId: bhadlaSite!.id,
      assetId: asset!.id,
      symptoms: "Inverter tripping on overvoltage",
    });

    expect(report.siteId).toBe(bhadlaSite!.id);
    expect(report.targetAsset).not.toBeNull();
    expect(report.targetAsset?.id).toBe(asset!.id);
    expect(report.allRelevantIncidents.length).toBeGreaterThan(0);
    // Every incident in sameAssetIncidents for this asset must carry "Same asset" label
    for (const incident of report.sameAssetIncidents) {
      expect(incident.labels).toContain("Same asset");
    }
  });

  it("labels incidents deterministically into required categories", async () => {
    const bhadlaSite = await prisma.site.findFirst({ where: { code: "SUN-BHA-04" } });
    const asset = await prisma.asset.findFirst({
      where: { siteId: bhadlaSite!.id, incidents: { some: {} } },
    });

    const report = await service.analyzeHistoricalIntelligence({
      siteId: bhadlaSite!.id,
      assetId: asset!.id,
      description: "Grid frequency abnormality causing trip",
    });

    const validLabels = [
      "Same asset",
      "Similar reported symptom",
      "Previous incident",
      "Unresolved incident",
    ];

    for (const incident of report.allRelevantIncidents) {
      for (const label of incident.labels) {
        expect(validLabels).toContain(label);
      }
    }
  });

  it("NEGATIVE INVARIANT: Never claims identical root cause based on similar descriptions", async () => {
    const bhadlaSite = await prisma.site.findFirst({ where: { code: "SUN-BHA-04" } });
    const asset = await prisma.asset.findFirst({
      where: { siteId: bhadlaSite!.id, incidents: { some: {} } },
    });

    const report = await service.analyzeHistoricalIntelligence({
      siteId: bhadlaSite!.id,
      assetId: asset?.id,
      symptoms: "Overheating smoke from combiner box",
      description: "Overheating smoke from combiner box",
    });

    // The service must provide the prominent safety disclaimer
    expect(report.rootCauseDisclaimer).toBe(ROOT_CAUSE_DISCLAIMER);
    expect(report.rootCauseDisclaimerTitle).toBe(ROOT_CAUSE_DISCLAIMER_TITLE);
    expect(report.rootCauseDisclaimer.toLowerCase()).toContain("never claim");
    expect(report.rootCauseDisclaimer.toLowerCase()).toContain("same root cause");

    // Check that no incident item asserts an identical root cause
    for (const incident of report.allRelevantIncidents) {
      expect(incident.symptomSimilarityScore).toBeDefined();
      expect(typeof incident.symptomSimilarityScore).toBe("number");
    }
  });

  it("extracts previously recorded actions and timestamps", async () => {
    const bhadlaSite = await prisma.site.findFirst({ where: { code: "SUN-BHA-04" } });
    const asset = await prisma.asset.findFirst({
      where: { siteId: bhadlaSite!.id, incidents: { some: {} } },
    });

    const report = await service.analyzeHistoricalIntelligence({
      siteId: bhadlaSite!.id,
      assetId: asset?.id,
    });

    for (const incident of report.allRelevantIncidents) {
      expect(incident.createdAt).toBeDefined();
      expect(incident.status).toBeDefined();
      expect(Array.isArray(incident.recordedActions)).toBe(true);
    }
  });
});
