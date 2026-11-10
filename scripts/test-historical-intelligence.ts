/**
 * FieldSignal Historical Incident Intelligence Test Suite
 *
 * Verifies all 6 requirements:
 * 1. Retrieve previous incidents for the same asset using deterministic asset matching.
 * 2. Identify similar reported symptoms using simple text similarity.
 * 3. Display previous incidents with dates and statuses.
 * 4. Display previously recorded actions and resolution notes.
 * 5. Identify repeated reported symptoms with frequency.
 * 6. Show unresolved incidents.
 *
 * Negative Invariant:
 * - Never claim that two incidents have the same root cause merely because descriptions are similar.
 *
 * Required Labels:
 * - "Same asset"
 * - "Similar reported symptom"
 * - "Previous incident"
 * - "Unresolved incident"
 */

import { PrismaClient, IncidentStatus, IncidentPriority, FaultCategory, UserRole } from "@prisma/client";
import {
  getHistoricalIntelligenceService,
  evaluateSymptomSimilarity,
  extractSignificantTokens,
  computeTokenJaccard,
  ROOT_CAUSE_DISCLAIMER,
  ROOT_CAUSE_DISCLAIMER_TITLE,
  HistoricalIncidentLabel,
} from "../src/modules/incidents/historical-intelligence";
import { DeterministicAssetMatcher } from "../src/modules/assets/asset-matcher";
import { createSessionToken } from "../src/lib/session";

const prisma = new PrismaClient();
const historicalService = getHistoricalIntelligenceService(prisma);

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✅ PASS: ${message}`);
}

async function runTestSuite() {
  console.log("\n==================================================================");
  console.log("🧠 FieldSignal Historical Incident Intelligence Test Suite");
  console.log("==================================================================\n");

  let passedTests = 0;
  let failedTests = 0;

  // 1. Fetch Bhadla site and existing assets
  const siteBhadla = await prisma.site.findFirst({
    where: { code: "SUN-BHA-04" },
    include: { organization: true },
  });
  assert(Boolean(siteBhadla), "Database contains seeded Bhadla Solar site");

  const inv01 = await prisma.asset.findFirst({
    where: { siteId: siteBhadla!.id, assetTag: "INV-01" },
  });
  assert(Boolean(inv01), "Asset INV-01 exists in Bhadla site");

  const inv03 = await prisma.asset.findFirst({
    where: { siteId: siteBhadla!.id, assetTag: "INV-03" },
  });
  assert(Boolean(inv03), "Asset INV-03 exists in Bhadla site");

  const technician = await prisma.user.findFirst({
    where: { siteId: siteBhadla!.id, role: UserRole.TECHNICIAN },
  });
  assert(Boolean(technician), "Technician user exists at Bhadla site");

  // ===========================================================================
  // GROUP 1: Text Similarity & Negative Root Cause Invariant (Req 2 & Invariant)
  // ===========================================================================
  console.log("\n📌 Group 1: Text Similarity Engine & Negative Root Cause Invariant");

  const tokens = extractSignificantTokens(
    "Inverter 1 heat sink over-temperature error E-14 pe trip ho gaya hai"
  );
  assert(tokens.includes("inverter"), "Extracts significant token 'inverter'");
  assert(tokens.includes("temperature"), "Extracts significant token 'temperature'");
  assert(!tokens.includes("hai"), "Filters out noise word 'hai'");
  assert(!tokens.includes("ho"), "Filters out noise word 'ho'");

  const jaccardMatch = computeTokenJaccard(
    ["inverter", "blower", "fan", "heat", "overtemperature"],
    ["inverter", "blower", "motor", "heat", "temperature"]
  );
  assert(jaccardMatch > 0.3, "Computes non-zero Jaccard score on overlapping symptom tokens");

  // Test similarity evaluation
  const sim1 = evaluateSymptomSimilarity(
    "Inverter heat sink temperature 85C, blower fan failure",
    "Heat sink over-temperature trip on E-14 with stopped cooling fan",
    "E-14",
    "E-14"
  );
  assert(sim1.isSimilar === true, "Identifies similar thermal symptoms and matching error code");
  assert(sim1.score >= 0.7, "High similarity score for matching thermal patterns and alarm code");
  assert(
    sim1.matchedKeywords.some((k) => k.includes("Thermal") || k.includes("Alarm Code")),
    "Identifies matched pattern keywords"
  );

  // Unrelated symptoms should NOT be similar
  const simUnrelated = evaluateSymptomSimilarity(
    "Tracker single-axis slew drive mechanical jam with clicking noise",
    "Inverter heat sink thermal overload E-14"
  );
  assert(simUnrelated.isSimilar === false, "Correctly rejects unrelated mechanical vs thermal symptoms");
  assert(simUnrelated.score < 0.2, "Low similarity score (< 0.20) for unrelated symptoms");

  // NEGATIVE CONSTRAINT: Never claim root cause equivalence
  assert(
    ROOT_CAUSE_DISCLAIMER.includes("Never claim that two incidents have the same root cause"),
    "Explicitly enforces negative invariant: Never claim same root cause merely due to description similarity"
  );
  assert(
    ROOT_CAUSE_DISCLAIMER_TITLE.includes("Symptom Similarity Does Not Imply Identical Root Cause"),
    "Root cause disclaimer title clearly disclaims root cause causality"
  );

  // ===========================================================================
  // GROUP 2: Seed Test Data with Prior & Unresolved Incidents
  // ===========================================================================
  console.log("\n📌 Group 2: Preparing Realistic Historical Incident Scenarios");

  // Create Prior Incident A: Resolved over-temperature trip on INV-01 with recorded actions
  const priorIncidentA = await prisma.incident.create({
    data: {
      ticketNumber: `INC-TEST-HIST-${Date.now()}-A`,
      siteId: siteBhadla!.id,
      assetId: inv01!.id,
      reportedByUserId: technician!.id,
      status: IncidentStatus.RESOLVED,
      priority: IncidentPriority.HIGH,
      faultCategory: FaultCategory.OVER_TEMPERATURE,
      title: "INV-01 Cooling Fan Stalled Thermal Trip",
      description: "Inverter INV-01 tripped on internal thermal threshold. Cooling fan stalled due to dust buildup.",
      symptoms: "Internal temperature 84°C, cooling fan stopped spinning, thermal alarm triggered",
      errorCode: "E-14",
      confirmedAt: new Date(Date.now() - 86400000 * 5), // 5 days ago
      resolvedAt: new Date(Date.now() - 86400000 * 4), // 4 days ago
      resolutionNotes: "Disassembled cooling fan assembly, cleaned heat sink fins with dry nitrogen, verified fan speed at 2800 RPM.",
      events: {
        create: [
          {
            userId: technician!.id,
            eventType: "STATUS_CHANGE",
            fromStatus: IncidentStatus.IN_PROGRESS,
            toStatus: IncidentStatus.RESOLVED,
            title: "Replaced Fan Fuse & Cleaned Heat Sink",
            description: "Technician replaced blown 2A auxiliary fan fuse and restored air flow.",
          },
        ],
      },
    },
  });
  assert(Boolean(priorIncidentA.id), "Created resolved historical incident A on INV-01 with resolution notes");

  // Create Prior Incident B: Unresolved incident on INV-01 with tripping symptom
  const priorIncidentB = await prisma.incident.create({
    data: {
      ticketNumber: `INC-TEST-HIST-${Date.now()}-B`,
      siteId: siteBhadla!.id,
      assetId: inv01!.id,
      reportedByUserId: technician!.id,
      status: IncidentStatus.IN_PROGRESS, // UNRESOLVED!
      priority: IncidentPriority.MEDIUM,
      faultCategory: FaultCategory.OVER_TEMPERATURE,
      title: "INV-01 Intermittent Thermal Warning",
      description: "INV-01 reporting elevated heat sink temperature during peak midday irradiance.",
      symptoms: "Elevated temperature reading 79°C, fan operating at maximum speed",
      errorCode: "E-14",
      confirmedAt: new Date(Date.now() - 86400000 * 1), // 1 day ago
      events: {
        create: [
          {
            userId: technician!.id,
            eventType: "STATUS_CHANGE",
            fromStatus: IncidentStatus.ACKNOWLEDGED,
            toStatus: IncidentStatus.IN_PROGRESS,
            title: "Thermal Imaging Inspection Underway",
            description: "FLIR thermal camera inspection of power stacks initiated by site technician.",
          },
        ],
      },
    },
  });
  assert(Boolean(priorIncidentB.id), "Created unresolved historical incident B (IN_PROGRESS) on INV-01");

  // Create Prior Incident C: Unrelated resolved incident on another asset (INV-03)
  const priorIncidentC = await prisma.incident.create({
    data: {
      ticketNumber: `INC-TEST-HIST-${Date.now()}-C`,
      siteId: siteBhadla!.id,
      assetId: inv03!.id,
      reportedByUserId: technician!.id,
      status: IncidentStatus.RESOLVED,
      priority: IncidentPriority.CRITICAL,
      faultCategory: FaultCategory.DC_ARC_FIRE,
      title: "INV-03 DC Isolator Burnt Lug",
      description: "DC switchgear terminal lug charred due to loose crimp connection.",
      symptoms: "Burnt acrid smell, smoke residue on enclosure lid",
      confirmedAt: new Date(Date.now() - 86400000 * 10),
      resolvedAt: new Date(Date.now() - 86400000 * 9),
      resolutionNotes: "Replaced 400A DC switch lug and torqued to 35Nm.",
    },
  });
  assert(Boolean(priorIncidentC.id), "Created prior incident C on different asset INV-03");

  try {
    // ===========================================================================
    // GROUP 3: Review Analysis on New Incident on INV-01 (Req 1, 2, 3, 4, 5, 6)
    // ===========================================================================
    console.log("\n📌 Group 3: Historical Intelligence Analysis on New Incident Review");

    const report = await historicalService.analyzeHistoricalIntelligence({
      siteId: siteBhadla!.id,
      assetId: inv01!.id,
      symptoms: ["Heat sink over-temperature", "Blower fan stopped spinning", "Inverter tripped"],
      description: "Inverter INV-01 tripped midday on high temperature error code E-14.",
      errorCode: "E-14",
    });

    // Requirement 1: Retrieve previous incidents for the same asset
    assert(report.sameAssetCount >= 2, "Req 1: Retrieves previous incidents for the same asset INV-01 (count >= 2)");
    assert(
      report.sameAssetIncidents.some((i) => i.ticketNumber === priorIncidentA.ticketNumber),
      "Req 1: Successfully retrieved prior incident A for INV-01"
    );
    assert(
      report.sameAssetIncidents.some((i) => i.ticketNumber === priorIncidentB.ticketNumber),
      "Req 1: Successfully retrieved prior incident B for INV-01"
    );

    // Requirement 2: Identify similar reported symptoms
    assert(
      report.similarSymptomsCount >= 2,
      "Req 2: Identifies similar reported symptoms across historical tickets"
    );
    const similarIncidentA = report.allRelevantIncidents.find((i) => i.ticketNumber === priorIncidentA.ticketNumber);
    assert(Boolean(similarIncidentA), "Prior Incident A is included in relevant incidents");
    assert(
      similarIncidentA?.labels.includes("Similar reported symptom") === true,
      "Req 2: Labels incident with 'Similar reported symptom'"
    );
    assert(
      similarIncidentA?.symptomSimilarityScore !== undefined && similarIncidentA.symptomSimilarityScore > 0.5,
      "Req 2: Computes high symptom similarity score for thermal match"
    );

    // Requirement 3: Display previous incidents with dates and statuses
    assert(Boolean(similarIncidentA?.createdAt), "Req 3: Displays createdAt date for previous incident");
    assert(similarIncidentA?.status === IncidentStatus.RESOLVED, "Req 3: Displays accurate status (RESOLVED)");
    assert(Boolean(similarIncidentA?.resolvedAt), "Req 3: Displays resolvedAt date for completed incident");

    // Requirement 4: Display previously recorded actions
    assert(
      similarIncidentA?.resolutionNotes?.includes("cleaned heat sink fins") === true,
      "Req 4: Displays previously recorded resolution notes"
    );
    assert(
      similarIncidentA?.recordedActions.some((a) => a.includes("nitrogen") || a.includes("fuse")) === true,
      "Req 4: Displays previously recorded actions from resolution and timeline events"
    );

    // Requirement 5: Identify repeated reported symptoms
    assert(
      report.repeatedSymptoms.length > 0,
      "Req 5: Identifies repeated reported symptoms across historical tickets"
    );
    const thermalRepetition = report.repeatedSymptoms.find((r) => r.displayName.includes("Thermal"));
    assert(Boolean(thermalRepetition), "Req 5: Detects repeated 'Thermal / Over-Temperature' symptom group");
    assert(
      thermalRepetition !== undefined && thermalRepetition.occurrenceCount >= 2,
      "Req 5: Identifies symptom repeated 2+ times"
    );
    assert(
      thermalRepetition?.isCurrentIncidentMatch === true,
      "Req 5: Identifies that current incident matches the repeated symptom"
    );
    assert(
      thermalRepetition?.incidentNumbers.includes(priorIncidentA.ticketNumber) === true,
      "Req 5: Tracks ticket numbers where repeated symptom occurred"
    );

    // Requirement 6: Show unresolved incidents
    assert(report.unresolvedCount >= 1, "Req 6: Accurately counts unresolved incidents on the asset");
    assert(
      report.unresolvedIncidents.some((u) => u.ticketNumber === priorIncidentB.ticketNumber),
      "Req 6: Shows unresolved incident B (IN_PROGRESS)"
    );
    assert(
      !report.unresolvedIncidents.some((u) => u.ticketNumber === priorIncidentA.ticketNumber),
      "Req 6: Excludes RESOLVED incident A from unresolved list"
    );

    // ===========================================================================
    // GROUP 4: Required Labels Verification
    // ===========================================================================
    console.log("\n📌 Group 4: Required Label Classifications");

    // Incident B is on the same asset, has similar symptoms, is previous, and is unresolved!
    const itemB = report.allRelevantIncidents.find((i) => i.ticketNumber === priorIncidentB.ticketNumber);
    assert(Boolean(itemB), "Found incident B in report");

    const requiredLabels: HistoricalIncidentLabel[] = [
      "Same asset",
      "Similar reported symptom",
      "Previous incident",
      "Unresolved incident",
    ];

    for (const label of requiredLabels) {
      assert(itemB?.labels.includes(label) === true, `Assigns required label '${label}' to incident B`);
    }

    // Incident A is RESOLVED, so it should NOT have "Unresolved incident"
    assert(
      similarIncidentA?.labels.includes("Unresolved incident") === false,
      "Resolved incident A does NOT have 'Unresolved incident' label"
    );
    assert(
      similarIncidentA?.labels.includes("Same asset") === true,
      "Resolved incident A has 'Same asset' label"
    );
    assert(
      similarIncidentA?.labels.includes("Previous incident") === true,
      "Resolved incident A has 'Previous incident' label"
    );

    // ===========================================================================
    // GROUP 5: Deterministic Asset Matching from Spoken / Tag Reference
    // ===========================================================================
    console.log("\n📌 Group 5: Deterministic Asset Matching for Historical Retrieval");

    // Query historical intelligence using asset tag "INV-01" instead of assetId
    const tagReport = await historicalService.analyzeHistoricalIntelligence({
      siteId: siteBhadla!.id,
      assetTag: "INV-01",
      symptoms: "Fan issue",
    });

    assert(Boolean(tagReport.targetAsset), "Deterministically matched target asset from tag 'INV-01'");
    assert(tagReport.targetAsset?.id === inv01!.id, "Resolved to correct asset ID for INV-01");
    assert(tagReport.sameAssetCount >= 2, "Retrieves previous incidents using deterministic tag match");

    // ===========================================================================
    // GROUP 6: API Routes Verification
    // ===========================================================================
    console.log("\n📌 Group 6: API Endpoints Integration");

    // 1. GET /api/v1/incidents/:id/historical-intelligence
    const { GET: getHistoricalHandler } = await import(
      "../src/app/api/v1/incidents/[id]/historical-intelligence/route"
    );

    const supervisor = await prisma.user.findFirst({
      where: { siteId: siteBhadla!.id, role: UserRole.SUPERVISOR },
    });
    const sessionToken = await createSessionToken({
      userId: supervisor!.id,
      organizationId: siteBhadla!.organizationId,
      siteId: siteBhadla!.id,
      role: supervisor!.role,
      name: supervisor!.name,
      phone: supervisor!.phone,
    });

    const getReq = new Request(
      `http://localhost:3000/api/v1/incidents/${priorIncidentB.id}/historical-intelligence`,
      {
        headers: { Cookie: `fs_session=${sessionToken}` },
      }
    );

    const getRes = await getHistoricalHandler(getReq as any, {
      params: Promise.resolve({ id: priorIncidentB.id }),
    });

    assert(getRes.status === 200, "GET /api/v1/incidents/:id/historical-intelligence returns HTTP 200");
    const getJson = await getRes.json();
    assert(getJson.success === true, "API returns success: true");
    assert(Boolean(getJson.data.rootCauseDisclaimer), "API payload includes root cause safety disclaimer");
    assert(Array.isArray(getJson.data.allRelevantIncidents), "API payload includes allRelevantIncidents array");
    assert(Array.isArray(getJson.data.repeatedSymptoms), "API payload includes repeatedSymptoms array");

    // 2. POST /api/v1/incidents/historical-intelligence (Draft Review)
    const { POST: postHistoricalHandler } = await import(
      "../src/app/api/v1/incidents/historical-intelligence/route"
    );

    const postReq = new Request(
      "http://localhost:3000/api/v1/incidents/historical-intelligence",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `fs_session=${sessionToken}`,
        },
        body: JSON.stringify({
          siteId: siteBhadla!.id,
          assetId: inv01!.id,
          symptoms: "High heat sink temperature",
        }),
      }
    );

    const postRes = await postHistoricalHandler(postReq as any);
    assert(postRes.status === 200, "POST /api/v1/incidents/historical-intelligence returns HTTP 200");
    const postJson = await postRes.json();
    assert(postJson.success === true, "Draft intelligence returns success: true");
    assert(postJson.data.sameAssetCount >= 2, "Draft intelligence retrieves same-asset incidents");
  } finally {
    // Cleanup synthetic test records
    await prisma.incidentEvent.deleteMany({
      where: {
        incidentId: {
          in: [priorIncidentA.id, priorIncidentB.id, priorIncidentC.id],
        },
      },
    });
    await prisma.incident.deleteMany({
      where: {
        id: { in: [priorIncidentA.id, priorIncidentB.id, priorIncidentC.id] },
      },
    });
    console.log("  🧹 Cleaned up temporary test incidents and events from database");
  }

  console.log("\n==================================================================");
  console.log("🏁 Test Summary: All Historical Incident Intelligence Checks Passed!");
  console.log("==================================================================\n");
}

runTestSuite()
  .catch((err) => {
    console.error("Test Suite Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

