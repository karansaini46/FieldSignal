/**
 * Comprehensive Test Suite: Incident Clarification Workflow
 *
 * Verifies all requirements and domain examples:
 * 1. Technician reports a fault without specifying equipment -> asks for equipment.
 * 2. Technician reports repeated tripping without current status -> asks for current status.
 * 3. Technician reports an alarm without providing alarm code -> asks for alarm code.
 * 4. Technician mentions a repair attempt but not its result -> asks for repair result.
 * 5. Asks one focused question at a time in prioritized order.
 * 6. Allows text or voice answers.
 * 7. Stores response and updates the extraction object.
 * 8. Validates the updated information.
 * 9. Preserves the original transcript verbatim.
 * 10. Maintains clarification history.
 * 11. Do not repeatedly ask questions whose answers already exist.
 * 12. Avoid generating unnecessary questions.
 * 13. API Route integration & database workflow.
 */

import { PrismaClient, IncidentStatus, ClarificationStatus } from "@prisma/client";
import {
  getIncidentClarificationService,
  ClarificationItem,
} from "../src/modules/incidents/clarification-service";
import { getAssetMatcher, MatchedAssetCandidate } from "../src/modules/assets/asset-matcher";
import { POST as clarifyRoute } from "../src/app/api/v1/incidents/clarify/route";
import { POST as postIncidentsRoute } from "../src/app/api/v1/incidents/route";
import { POST as answerClarificationRoute } from "../src/app/api/v1/incidents/[id]/clarifications/route";
import { createSessionToken } from "../src/lib/session";
import { NextRequest } from "next/server";

const prisma = new PrismaClient();

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
  console.log("==================================================================");
  console.log("🧪 FieldSignal Incident Clarification Workflow Test Suite");
  console.log("==================================================================\n");

  const clarificationService = getIncidentClarificationService();

  // Load test entities
  const siteBhadla = await prisma.site.findUniqueOrThrow({ where: { code: "SUN-BHA-04" } });
  const techRajesh = await prisma.user.findUniqueOrThrow({ where: { phone: "+919876500002" } });
  const supervisorVikram = await prisma.user.findUniqueOrThrow({ where: { phone: "+919876500001" } });

  const techToken = await createSessionToken({
    userId: techRajesh.id,
    name: techRajesh.name,
    phone: techRajesh.phone,
    role: techRajesh.role,
    organizationId: techRajesh.organizationId,
    siteId: techRajesh.siteId,
  });

  const bhadlaAssets = await prisma.asset.findMany({
    where: { siteId: siteBhadla.id },
  });

  const bhadlaAssetCandidates: MatchedAssetCandidate[] = bhadlaAssets.map((a) => ({
    id: a.id,
    assetTag: a.assetTag,
    name: a.name,
    assetType: a.assetType,
    block: a.block,
    row: a.row,
    model: a.model,
    siteId: a.siteId,
    siteName: siteBhadla.name,
    confidence: 0,
    matchReason: "",
  }));

  const siteContext = {
    id: siteBhadla.id,
    name: siteBhadla.name,
    siteAssets: bhadlaAssetCandidates,
  };

  // ===========================================================================
  // EXAMPLE 1: Fault without specifying equipment
  // ===========================================================================
  console.log("📌 Example 1: Fault Reported Without Specifying Equipment");

  const transcriptNoAsset =
    "Inverter room mein IGBT temperature alarm aaya hai and cooling blower fan seized lag raha hai.";

  const eval1 = clarificationService.identifyNextQuestion(
    {
      transcript: transcriptNoAsset,
      originalTranscript: transcriptNoAsset,
      assetCode: null,
      matchedAssetId: null,
      reportedAlarm: null,
      symptoms: ["Thermal overload / High temperature"],
    },
    [],
    siteBhadla.name
  );

  assert(eval1.missingFields.includes("asset"), "Identifies equipment as missing field");
  assert(eval1.currentQuestion !== null, "Generates focused clarification question");
  assert(eval1.currentQuestion?.field === "asset", "Top focused question is for 'asset'");
  assert(
    Boolean(eval1.currentQuestion?.question.toLowerCase().includes("which") ||
      eval1.currentQuestion?.question.toLowerCase().includes("equipment")),
    "Asks targeted question asking which equipment tag is affected"
  );
  assert(eval1.isComplete === false, "Incident marked as incomplete pending clarification");

  // Answering Question 1 with text answer
  const mockExtraction1: any = {
    assetCode: null,
    matchedAssetId: null,
    equipmentType: "INVERTER",
    faultDescription: "Inverter: Thermal overload observed.",
    reportedAlarm: null,
    symptoms: ["Thermal overload / High temperature"],
    actionsAlreadyTaken: null,
    recurrenceMentioned: false,
    suggestedPriority: "HIGH",
    faultCategory: "OVER_TEMPERATURE",
    missingInformation: ["Specific asset tag / equipment code"],
    clarificationQuestion: eval1.currentQuestion?.question,
    extractionConfidence: 0.75,
    needsClarification: true,
    suggestedStatus: "NEEDS_CLARIFICATION",
    originalTranscript: transcriptNoAsset,
    details: {
      reported: { rawObservations: ["High heat"], statedAlarmCode: null, statedActions: null, spokenAssetCode: null },
      inferred: { inferredEquipmentType: "INVERTER", inferredFaultCategory: "OVER_TEMPERATURE", priorityReasoning: [] },
    },
  };

  const process1 = clarificationService.processResponse({
    field: "asset",
    response: "INV-01",
    fromVoice: false,
    currentExtraction: mockExtraction1,
    history: [],
    siteContext,
  });

  assert(process1.updatedExtraction.assetCode === "INV-01", "Updates extraction assetCode to 'INV-01'");
  assert(Boolean(process1.updatedExtraction.matchedAssetId), "Resolves matched database asset ID");
  assert(process1.history.length === 1, "Appends response to clarification history");
  assert(process1.history[0]?.field === "asset", "History records field as 'asset'");
  assert(process1.history[0]?.response === "INV-01", "History records response 'INV-01'");
  assert(process1.history[0]?.status === "RESOLVED", "History marks clarification as RESOLVED");
  assert(
    process1.updatedExtraction.originalTranscript === transcriptNoAsset,
    "Strictly preserves verbatim original transcript"
  );

  // ===========================================================================
  // EXAMPLE 2: Repeated tripping without identifying current status
  // ===========================================================================
  console.log("\n📌 Example 2: Repeated Tripping Without Identifying Current Status");

  const transcriptTrippingNoStatus =
    "INV-01 inverter baar baar trip ho raha hai, aaj doosri baar shutdown hua.";

  const eval2 = clarificationService.identifyNextQuestion(
    {
      transcript: transcriptTrippingNoStatus,
      originalTranscript: transcriptTrippingNoStatus,
      assetCode: "INV-01",
      matchedAssetId: "asset_01",
      reportedAlarm: null,
      symptoms: ["Equipment trip / automatic shutdown"],
    },
    [],
    siteBhadla.name
  );

  assert(
    eval2.missingFields.includes("current_status"),
    "Identifies current operational status as missing field"
  );
  assert(eval2.currentQuestion?.field === "current_status", "Focused question is for 'current_status'");
  assert(
    Boolean(eval2.currentQuestion?.question.toLowerCase().includes("current operational status") ||
      eval2.currentQuestion?.question.toLowerCase().includes("tripped")),
    "Asks whether equipment is currently offline/tripped or running"
  );
  assert(
    !eval2.missingFields.includes("asset"),
    "Does not ask for equipment (asset INV-01 is already known)"
  );

  // Answering Question 2 via voice answer
  const mockExtraction2: any = {
    ...mockExtraction1,
    assetCode: "INV-01",
    matchedAssetId: "asset_01",
    originalTranscript: transcriptTrippingNoStatus,
  };

  const process2 = clarificationService.processResponse({
    field: "current_status",
    response: "Abhi bhi band hai, completely tripped offline",
    fromVoice: true,
    currentExtraction: mockExtraction2,
    history: [],
    siteContext,
  });

  assert(
    process2.updatedExtraction.symptoms.some((s) => s.includes("tripped offline")),
    "Updates extraction observations with current status"
  );
  assert(process2.history[0]?.fromVoice === true, "History records response came from voice");
  assert(
    process2.updatedExtraction.originalTranscript === transcriptTrippingNoStatus,
    "Preserves original transcript verbatim after status clarification"
  );

  // ===========================================================================
  // EXAMPLE 3: Alarm reported without providing alarm code
  // ===========================================================================
  console.log("\n📌 Example 3: Alarm Reported Without Providing Alarm Code");

  const transcriptAlarmNoCode =
    "INV-01 inverter screen pe over-temp warning alarm show ho raha hai.";

  const eval3 = clarificationService.identifyNextQuestion(
    {
      transcript: transcriptAlarmNoCode,
      originalTranscript: transcriptAlarmNoCode,
      assetCode: "INV-01",
      matchedAssetId: "asset_01",
      reportedAlarm: null, // NOT provided!
      symptoms: ["Thermal warning"],
    },
    [],
    siteBhadla.name
  );

  assert(eval3.missingFields.includes("alarm_code"), "Identifies alarm code as missing field");
  assert(eval3.currentQuestion?.field === "alarm_code", "Focused question is for 'alarm_code'");
  assert(
    Boolean(eval3.currentQuestion?.question.toLowerCase().includes("alarm") ||
      eval3.currentQuestion?.question.toLowerCase().includes("error code")),
    "Asks technician for specific alarm or error code shown on display"
  );

  // Answering with code "E-402"
  const process3 = clarificationService.processResponse({
    field: "alarm_code",
    response: "Error code E-402 show ho raha hai",
    fromVoice: false,
    currentExtraction: mockExtraction2,
    history: [],
    siteContext,
  });

  assert(process3.updatedExtraction.reportedAlarm === "E-402", "Extracts normalized alarm code 'E-402'");
  assert(
    process3.updatedExtraction.details.reported.statedAlarmCode === "E-402",
    "Updates statedAlarmCode in details.reported"
  );

  // ===========================================================================
  // EXAMPLE 4: Repair attempt mentioned without its result
  // ===========================================================================
  console.log("\n📌 Example 4: Repair Attempt Mentioned Without Result");

  const transcriptRepairNoOutcome =
    "INV-01 offline hai, technician ne breaker reset try kiya aur cooling filter clean kiya.";

  const eval4 = clarificationService.identifyNextQuestion(
    {
      transcript: transcriptRepairNoOutcome,
      originalTranscript: transcriptRepairNoOutcome,
      assetCode: "INV-01",
      matchedAssetId: "asset_01",
      reportedAlarm: "E-402",
      symptoms: ["Trip"],
      actionsAlreadyTaken: "Breaker reset attempted",
      currentStatus: "OFFLINE",
    },
    [],
    siteBhadla.name
  );

  assert(eval4.missingFields.includes("repair_result"), "Identifies repair result as missing field");
  assert(eval4.currentQuestion?.field === "repair_result", "Focused question is for 'repair_result'");
  assert(
    Boolean(eval4.currentQuestion?.question.toLowerCase().includes("result") ||
      eval4.currentQuestion?.question.toLowerCase().includes("outcome")),
    "Asks what the outcome of the reset attempt was"
  );

  // Answering repair outcome
  const process4 = clarificationService.processResponse({
    field: "repair_result",
    response: "Reset attempt failed, inverter tripped again immediately",
    fromVoice: false,
    currentExtraction: {
      ...mockExtraction2,
      actionsAlreadyTaken: "Breaker reset attempted",
    },
    history: [],
    siteContext,
  });

  assert(
    Boolean(process4.updatedExtraction.actionsAlreadyTaken?.includes("tripped again immediately")),
    "Updates actionsAlreadyTaken with the clarified repair outcome"
  );

  // ===========================================================================
  // REQUIREMENT 5 & 11: One Focused Question At A Time & Never Repeat
  // ===========================================================================
  console.log("\n📌 Group 5: One Focused Question At A Time & Never Repeat Answered Questions");

  // Report missing BOTH asset and alarm code
  const transcriptMissingMultiple =
    "Inverter room mein alarm show ho raha hai aur smoke ki smell aa rahi hai.";

  let history: ClarificationItem[] = [];

  // Turn 1: Should ask ONLY for asset (highest priority missing item)
  const turn1 = clarificationService.identifyNextQuestion(
    {
      transcript: transcriptMissingMultiple,
      originalTranscript: transcriptMissingMultiple,
      assetCode: null,
      matchedAssetId: null,
      reportedAlarm: null,
    },
    history,
    siteBhadla.name
  );

  assert(turn1.currentQuestion?.field === "asset", "Turn 1 asks focused Question 1: 'asset'");
  assert(turn1.missingFields.length >= 2, "Detects multiple missing fields");

  // Technician answers Turn 1: "INV-01"
  const turn1Result = clarificationService.processResponse({
    field: "asset",
    response: "INV-01",
    currentExtraction: {
      ...mockExtraction1,
      assetCode: null,
      matchedAssetId: null,
      reportedAlarm: null,
      originalTranscript: transcriptMissingMultiple,
    },
    history,
    siteContext,
  });

  history = turn1Result.history;
  assert(history.length === 1, "History has 1 resolved item");
  assert(turn1Result.updatedExtraction.assetCode === "INV-01", "Extraction updated with assetCode INV-01");

  // Turn 2: Re-evaluate. Should now ask for alarm_code, NEVER repeat asset question!
  assert(
    turn1Result.nextQuestion?.field === "alarm_code",
    "Turn 2 automatically advances to next focused question: 'alarm_code'"
  );
  assert(
    turn1Result.nextQuestion?.field !== "asset",
    "Does not repeat the asset question since answer already exists"
  );

  // Technician answers Turn 2: "E-402"
  const turn2Result = clarificationService.processResponse({
    field: "alarm_code",
    response: "E-402",
    currentExtraction: turn1Result.updatedExtraction,
    history,
    siteContext,
  });

  history = turn2Result.history;
  assert(history.length === 2, "History maintains all 2 clarification items");
  assert(turn2Result.isComplete === true, "Marks clarification complete once all items resolved");
  assert(turn2Result.nextQuestion === null, "nextQuestion is null when complete");
  assert(turn2Result.updatedExtraction.needsClarification === false, "needsClarification set to false");
  assert(turn2Result.updatedExtraction.suggestedStatus === "DRAFT", "suggestedStatus updated to DRAFT");
  assert(
    turn2Result.updatedExtraction.originalTranscript === transcriptMissingMultiple,
    "Original transcript preserved throughout multi-turn workflow"
  );

  // ===========================================================================
  // REQUIREMENT 12: Avoid Generating Unnecessary Questions
  // ===========================================================================
  console.log("\n📌 Group 6: Avoid Generating Unnecessary Questions");

  // Complete report: Asset, alarm code, symptoms all present, no repair attempt mentioned
  const completeReport = {
    transcript: "INV-01 inverter cooling fan seized with alarm E-402.",
    originalTranscript: "INV-01 inverter cooling fan seized with alarm E-402.",
    assetCode: "INV-01",
    matchedAssetId: "asset_01",
    reportedAlarm: "E-402",
    symptoms: ["Cooling fan seized"],
    actionsAlreadyTaken: null,
  };

  const evalComplete = clarificationService.identifyNextQuestion(completeReport, [], siteBhadla.name);
  assert(evalComplete.missingFields.length === 0, "Zero missing fields on complete report");
  assert(evalComplete.currentQuestion === null, "Does not generate unnecessary questions");
  assert(evalComplete.isComplete === true, "Marks as complete immediately");

  // Report mentions high temperature but NO tripping, NO repair attempt, NO alarm
  const tempOnlyReport = {
    transcript: "INV-01 heatsink temperature is 88 degrees.",
    originalTranscript: "INV-01 heatsink temperature is 88 degrees.",
    assetCode: "INV-01",
    matchedAssetId: "asset_01",
    reportedAlarm: null,
    symptoms: ["High temperature"],
  };

  const evalTemp = clarificationService.identifyNextQuestion(tempOnlyReport, [], siteBhadla.name);
  assert(!evalTemp.missingFields.includes("current_status"), "Does not ask current status when tripping not mentioned");
  assert(!evalTemp.missingFields.includes("repair_result"), "Does not ask repair result when no repair attempted");
  assert(!evalTemp.missingFields.includes("alarm_code"), "Does not ask alarm code when no alarm mentioned");

  // ===========================================================================
  // GROUP 7: API Endpoint POST /api/v1/incidents/clarify
  // ===========================================================================
  console.log("\n📌 Group 7: API Route POST /api/v1/incidents/clarify");

  const reqClarify = new NextRequest("http://localhost:3000/api/v1/incidents/clarify", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${techToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      siteId: siteBhadla.id,
      field: "asset",
      response: "INV-01",
      fromVoice: true,
      currentExtraction: mockExtraction1,
      history: [],
    }),
  });

  const resClarify = await clarifyRoute(reqClarify);
  assert(resClarify.status === 200, "POST /api/v1/incidents/clarify returns HTTP 200");

  const jsonClarify = await resClarify.json();
  assert(jsonClarify.success === true, "API response returns success: true");
  assert(jsonClarify.data.updatedExtraction.assetCode === "INV-01", "API updates extraction with assetCode 'INV-01'");
  assert(Array.isArray(jsonClarify.data.history), "API returns clarification history array");
  assert(
    jsonClarify.data.updatedExtraction.originalTranscript === transcriptNoAsset,
    "API preserves original transcript in response"
  );

  // ===========================================================================
  // GROUP 8: Existing Incident Database Clarification Workflow
  // ===========================================================================
  console.log("\n📌 Group 8: Database Workflow — Answer Clarification on Ticket");

  // Create incident ticket in NEEDS_CLARIFICATION state
  const createIncidentReq = new NextRequest("http://localhost:3000/api/v1/incidents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${techToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      siteId: siteBhadla.id,
      title: "Unidentified Inverter Fault",
      description: "Alarm sound heard from inverter section.",
      symptoms: "Audible alarm",
      status: IncidentStatus.NEEDS_CLARIFICATION,
      missingFields: ["assetId"],
      originalTranscript: "Inverter room se alarm sound aa rahi hai.",
    }),
  });

  const createIncidentRes = await postIncidentsRoute(createIncidentReq);
  const createIncidentJson = await createIncidentRes.json();
  assert(createIncidentRes.status === 201, "Creates incident in NEEDS_CLARIFICATION");

  const testIncidentId = createIncidentJson.data.id;

  // Verify initial Clarification record was persisted
  const pendingClarification = await prisma.clarification.findFirst({
    where: { incidentId: testIncidentId, status: ClarificationStatus.PENDING },
  });
  assert(Boolean(pendingClarification), "Initial Clarification record persisted in database");

  // Technician responds to the clarification via POST /api/v1/incidents/[id]/clarifications
  const answerReq = new NextRequest(
    `http://localhost:3000/api/v1/incidents/${testIncidentId}/clarifications`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${techToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        clarificationId: pendingClarification!.id,
        response: "INV-01",
        fromVoice: true,
      }),
    }
  );

  const answerRes = await answerClarificationRoute(answerReq, {
    params: Promise.resolve({ id: testIncidentId }),
  });
  assert(answerRes.status === 200, "POST /api/v1/incidents/:id/clarifications returns HTTP 200");

  const answerJson = await answerRes.json();
  assert(answerJson.data.clarification.status === "RESOLVED", "Clarification record status set to RESOLVED");
  assert(answerJson.data.clarification.response === "INV-01", "Clarification response stored in database");
  assert(Boolean(answerJson.data.clarification.respondedAt), "Clarification respondedAt timestamp recorded");

  // Verify incident advanced status to SUBMITTED and resolved asset
  const refreshedIncident = await prisma.incident.findUnique({
    where: { id: testIncidentId },
    include: { events: true, asset: true },
  });

  assert(
    refreshedIncident?.status === IncidentStatus.SUBMITTED || refreshedIncident?.status === IncidentStatus.DRAFT,
    "Incident status advanced out of NEEDS_CLARIFICATION"
  );
  assert(Boolean(refreshedIncident?.assetId), "Asset ID resolved and attached to incident");
  assert(
    Boolean(refreshedIncident?.events.some((e) => e.title === "Clarification Answered")),
    "Recorded audit event 'Clarification Answered' in incident timeline"
  );
  assert(
    refreshedIncident?.originalTranscript === "Inverter room se alarm sound aa rahi hai.",
    "Original transcript preserved untouched in database"
  );

  // Cleanup test ticket
  await prisma.clarification.deleteMany({ where: { incidentId: testIncidentId } });
  await prisma.incidentEvent.deleteMany({ where: { incidentId: testIncidentId } });
  await prisma.incident.delete({ where: { id: testIncidentId } });

  // ===========================================================================
  // Summary
  // ===========================================================================
  console.log("\n==================================================================");
  console.log(`🏁 Test Summary: ${passedCount} Passed, ${failedCount} Failed`);
  console.log("==================================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests()
  .catch((err) => {
    console.error("Fatal test runner error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
