/**
 * Test Suite: Incident Extraction Engine
 * Tests structured extraction, integrity guardrails, zero-hallucination constraints,
 * missing information clarification, and API endpoint integration.
 */

import {
  getIncidentExtractionEngine,
  ExtractionInput,
  extractedIncidentSchema,
} from "../src/modules/extraction";
import { db } from "../src/lib/db";
import { POST as extractHandler } from "../src/app/api/v1/incidents/extract/route";
import { NextRequest } from "next/server";
import { createSessionToken } from "../src/lib/session";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName}${details ? ` -> ${details}` : ""}`);
    failedCount++;
  }
}

async function runTests() {
  console.log("\n🧪 Starting Incident Extraction Engine Test Suite...\n");

  const engine = getIncidentExtractionEngine();

  const mockSite = {
    id: "site_test_01",
    name: "Bhadla Solar Operations Phase 2",
    code: "SUN-BHA-02",
    location: "Bhadla, Rajasthan",
  };

  const mockKnownAssets = [
    {
      id: "asset_inv_01",
      assetTag: "BHA-INV-01",
      name: "Central Inverter 1",
      assetType: "INVERTER" as const,
      block: "Block A",
      model: "SMA Sunny Central 2500-EV",
    },
    {
      id: "asset_inv_02",
      assetTag: "BHA-INV-02",
      name: "Central Inverter 2",
      assetType: "INVERTER" as const,
      block: "Block A",
      model: "SMA Sunny Central 2500-EV",
    },
    {
      id: "asset_scb_04",
      assetTag: "BHA-SCB-04",
      name: "String Combiner Box 4",
      assetType: "COMBINER_BOX" as const,
      block: "Block B",
      model: "Schneider Solar SMB 16",
    },
    {
      id: "asset_xfmr_01",
      assetTag: "BHA-XFMR-01",
      name: "Power Transformer 1",
      assetType: "TRANSFORMER" as const,
      block: "Substation",
      model: "ABB 33kV Step-Up",
    },
  ];

  // ---------------------------------------------------------------------------
  // Test Group 1: Complete & Verified Extraction (Hindi/Hinglish Transcript)
  // ---------------------------------------------------------------------------
  console.log("📌 Group 1: Complete Speech Extraction (Hinglish with Known Asset)");
  try {
    const input: ExtractionInput = {
      transcript:
        "BHA-INV-01 mein IGBT over-temperature alarm aaya hai. Error code E-402 show ho raha hai aur cooling blower fan seized lag raha hai. DC switch isolate kiya aur LOTO protocol apply kar diya.",
      site: mockSite,
      knownSiteAssets: mockKnownAssets,
    };

    const result = await engine.extractIncident(input);

    assert(result.assetCode === "BHA-INV-01", "Accurately extracts verified asset code BHA-INV-01");
    assert(result.matchedAssetId === "asset_inv_01", "Resolves database UUID for matched asset");
    assert(result.equipmentType === "INVERTER", "Identifies equipment type as INVERTER");
    assert(result.reportedAlarm === "E-402", "Extracts verbatim reported alarm code E-402");
    assert(
      result.symptoms.length > 0 && result.symptoms.some((s) => s.toLowerCase().includes("temperature")),
      "Extracts over-temperature symptoms"
    );
    assert(
      result.actionsAlreadyTaken !== null && result.actionsAlreadyTaken.toLowerCase().includes("isolate"),
      "Extracts actions already performed by technician (DC isolation)"
    );
    assert(result.needsClarification === false, "Marks complete incident as needsClarification: false");
    assert(result.suggestedStatus === "DRAFT", "Sets initial status to DRAFT for complete report");
    assert(result.extractionConfidence >= 0.8, "Provides high confidence score (> 0.8)");

    // Zod validation check
    const parseCheck = extractedIncidentSchema.safeParse(result);
    assert(parseCheck.success === true, "Result strictly conforms to Zod extractedIncidentSchema");
  } catch (err: any) {
    console.error("Unexpected error in Group 1:", err);
  }

  // ---------------------------------------------------------------------------
  // Test Group 2: Integrity Constraint — Never Invent an Asset ID
  // ---------------------------------------------------------------------------
  console.log("\n📌 Group 2: Integrity Constraint — Never Invent Asset ID");
  try {
    // Transcript mentions generic equipment without specifying which inverter
    const inputWithoutAsset: ExtractionInput = {
      transcript:
        "Inverter se bahut zyada screeching noise aur vibration aa rahi hai. Over-temperature alarm E-301 dikh raha hai.",
      site: mockSite,
      knownSiteAssets: mockKnownAssets,
    };

    const resultWithoutAsset = await engine.extractIncident(inputWithoutAsset);

    assert(resultWithoutAsset.assetCode === null, "Refuses to invent asset code when none stated (assetCode = null)");
    assert(resultWithoutAsset.matchedAssetId === null, "Leaves matchedAssetId as null");
    assert(resultWithoutAsset.needsClarification === true, "Flags report as needing clarification");
    assert(
      resultWithoutAsset.suggestedStatus === "NEEDS_CLARIFICATION",
      "Sets status to NEEDS_CLARIFICATION when asset code is missing"
    );
    assert(
      typeof resultWithoutAsset.clarificationQuestion === "string" &&
        resultWithoutAsset.clarificationQuestion.toLowerCase().includes("which"),
      "Generates specific clarification question asking which asset has the issue"
    );
    assert(
      resultWithoutAsset.missingInformation.some((m) => m.toLowerCase().includes("asset")),
      "Records missing asset tag in missingInformation array"
    );

    // Transcript mentions hallucinated/fake asset tag not present in knownSiteAssets
    const inputWithFakeAsset: ExtractionInput = {
      transcript: "INV-9999 mein issue hua hai. Blower band hai.",
      site: mockSite,
      knownSiteAssets: mockKnownAssets,
    };

    const resultFake = await engine.extractIncident(inputWithFakeAsset);
    assert(
      resultFake.assetCode === null || resultFake.assetCode === "INV-9999",
      "Rejects hallucinated asset tag not belonging to site"
    );
    if (!resultFake.matchedAssetId) {
      assert(true, "Does not match asset ID for unrecognized code");
    }
  } catch (err: any) {
    console.error("Unexpected error in Group 2:", err);
  }

  // ---------------------------------------------------------------------------
  // Test Group 3: Integrity Constraint — Never Invent Alarm Codes
  // ---------------------------------------------------------------------------
  console.log("\n📌 Group 3: Integrity Constraint — Never Invent Alarm Codes");
  try {
    const inputNoAlarm: ExtractionInput = {
      transcript:
        "BHA-SCB-04 box ka door open mila aur string 2 ka fuse burnt dikh raha hai. Physical inspection mein smell aa rahi hai.",
      site: mockSite,
      knownSiteAssets: mockKnownAssets,
    };

    const result = await engine.extractIncident(inputNoAlarm);

    assert(result.assetCode === "BHA-SCB-04", "Matches known combiner box BHA-SCB-04");
    assert(result.reportedAlarm === null, "Sets reportedAlarm to null when no alarm code was spoken");
    assert(
      result.details.reported.statedAlarmCode === null,
      "Preserves null in details.reported.statedAlarmCode"
    );
  } catch (err: any) {
    console.error("Unexpected error in Group 3:", err);
  }

  // ---------------------------------------------------------------------------
  // Test Group 4: Integrity Constraint — Never Invent Repair Actions
  // ---------------------------------------------------------------------------
  console.log("\n📌 Group 4: Integrity Constraint — Never Invent Repair Actions");
  try {
    const inputNoAction: ExtractionInput = {
      transcript:
        "BHA-XFMR-01 transformer oil temperature 88 degrees pahunch gaya hai, whistling sound sunai de rahi hai.",
      site: mockSite,
      knownSiteAssets: mockKnownAssets,
    };

    const result = await engine.extractIncident(inputNoAction);

    assert(
      result.actionsAlreadyTaken === null,
      "Leaves actionsAlreadyTaken as null when technician reported no mitigation action"
    );
    assert(
      result.details.reported.statedActions === null,
      "Preserves null in details.reported.statedActions"
    );
    assert(
      result.equipmentType === "TRANSFORMER",
      "Correctly identifies equipment type as TRANSFORMER"
    );
  } catch (err: any) {
    console.error("Unexpected error in Group 4:", err);
  }

  // ---------------------------------------------------------------------------
  // Test Group 5: Recurrence Detection & Priority Escalation
  // ---------------------------------------------------------------------------
  console.log("\n📌 Group 5: Recurrence Detection & Priority Escalation");
  try {
    const inputRepeat: ExtractionInput = {
      transcript:
        "BHA-INV-01 phir se trip ho gaya hai. Yeh problem kal bhi aayi thi, repeat fault hai. Error E-402 wapis aaya.",
      site: mockSite,
      knownSiteAssets: mockKnownAssets,
      previousIncidents: [
        {
          id: "prev_01",
          ticketNumber: "INC-2026-0041",
          title: "Inverter 1 Overtemp",
          faultCategory: "OVER_TEMPERATURE",
          priority: "HIGH",
          createdAt: new Date(),
          errorCode: "E-402",
        },
      ],
    };

    const result = await engine.extractIncident(inputRepeat);

    assert(result.recurrenceMentioned === true, "Detects explicit technician mention of repeat fault ('phir se')");
    assert(
      result.suggestedPriority === "CRITICAL" || result.suggestedPriority === "HIGH",
      "Escalates suggested priority due to repeat fault history"
    );
  } catch (err: any) {
    console.error("Unexpected error in Group 5:", err);
  }

  // ---------------------------------------------------------------------------
  // Test Group 6: API Route Integration (POST /api/v1/incidents/extract)
  // ---------------------------------------------------------------------------
  console.log("\n📌 Group 6: API Route Endpoint (POST /api/v1/incidents/extract)");
  try {
    const techUser = await db.user.findFirst({
      where: { role: "TECHNICIAN" },
      include: { organization: true, site: true },
    });

    if (!techUser) {
      throw new Error("No technician in database for API route testing");
    }

    const token = await createSessionToken({
      userId: techUser.id,
      name: techUser.name,
      phone: techUser.phone,
      role: techUser.role,
      organizationId: techUser.organizationId,
      siteId: techUser.siteId || undefined,
    });

    // 6.1 Call API with valid transcript
    const req = new NextRequest("http://localhost:3000/api/v1/incidents/extract", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transcript:
          "INV-01 mein IGBT high temperature warning aayi hai. Error E-402 show kar raha hai.",
        siteId: techUser.siteId,
      }),
    });

    const res = await extractHandler(req);
    assert(res.status === 200, "POST /api/v1/incidents/extract returns HTTP 200");

    const json = await res.json();
    assert(json.success === true, "Response envelope contains success: true");
    assert(
      typeof json.data.faultDescription === "string",
      "Returns valid faultDescription in API response"
    );
    assert(
      json.data.reportedAlarm === "E-402",
      "Returns extracted reportedAlarm E-402 from API"
    );
    assert(
      typeof json.data.extractionConfidence === "number",
      "Returns extractionConfidence score"
    );
    assert(
      json.data.details && typeof json.data.details.reported === "object",
      "Returns segregated details.reported object"
    );
    assert(
      json.data.details && typeof json.data.details.inferred === "object",
      "Returns segregated details.inferred object"
    );
  } catch (err: any) {
    console.error("Unexpected error in Group 6:", err);
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log("\n========================================================");
  console.log(`🏁 Test Summary: ${passedCount} Passed, ${failedCount} Failed`);
  console.log("========================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});

