/**
 * FieldSignal — Automated Integration Test Suite for Incident Management
 *
 * Verifies all 9 features:
 * 1. Incident creation
 * 2. Incident listing
 * 3. Incident detail page data retrieval
 * 4. Incident search and filters
 * 5. Status management (DRAFT, NEEDS_CLARIFICATION, SUBMITTED, ACKNOWLEDGED, IN_PROGRESS, RESOLVED, CLOSED)
 * 6. Priority suggestions (rule-based domain engine)
 * 7. Technician and supervisor attribution
 * 8. Incident timeline
 * 9. Audit event creation (storing every important modification in IncidentEvent)
 *
 * Critical Constraint:
 * - AI extraction result CANNOT create a confirmed incident without user approval.
 */

import { PrismaClient, UserRole, IncidentStatus, IncidentPriority, FaultCategory } from "@prisma/client";
import { createSessionToken } from "../src/lib/session";
import { validateIncidentTransition, getAllowedTransitions } from "../src/modules/incidents/state-machine";
import { suggestIncidentPriority } from "../src/modules/incidents/priority-suggester";
import { assertAiExtractionApproval } from "../src/modules/incidents/ai-guard";
import { GET as getIncidentsRoute, POST as postIncidentsRoute } from "../src/app/api/v1/incidents/route";
import { GET as getIncidentByIdRoute, PATCH as patchIncidentByIdRoute } from "../src/app/api/v1/incidents/[id]/route";
import { POST as suggestPriorityRoute } from "../src/app/api/v1/incidents/suggest-priority/route";
import { NextRequest } from "next/server";

const prisma = new PrismaClient();

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
  }
}

function getErrStatus(err: unknown): number | undefined {
  if (typeof err === "object" && err !== null && "statusCode" in err) {
    return (err as { statusCode: number }).statusCode;
  }
  return undefined;
}

async function runTestSuite() {
  console.log("==================================================================");
  console.log("⚡ FieldSignal Incident Management System Integration Test Suite");
  console.log("==================================================================\n");

  // Fetch test entities
  const orgSunrise = await prisma.organization.findUniqueOrThrow({
    where: { code: "SUNRISE-SOLAR" },
  });
  const siteBhadla = await prisma.site.findUniqueOrThrow({ where: { code: "SUN-BHA-04" } });
  const sitePavagada = await prisma.site.findUniqueOrThrow({ where: { code: "SUN-PAV-02" } });

  const techRajesh = await prisma.user.findUniqueOrThrow({ where: { phone: "+919876500002" } });
  const supervisorVikram = await prisma.user.findUniqueOrThrow({
    where: { phone: "+919876500001" },
  });
  const adminPooja = await prisma.user.findUniqueOrThrow({ where: { phone: "+919876500000" } });

  const inv01 = await prisma.asset.findFirstOrThrow({
    where: { assetTag: "INV-01", siteId: siteBhadla.id },
  });

  // Issue session tokens
  const adminToken = await createSessionToken({
    userId: adminPooja.id,
    name: adminPooja.name,
    phone: adminPooja.phone,
    role: adminPooja.role,
    organizationId: adminPooja.organizationId,
    siteId: adminPooja.siteId,
  });

  const supervisorToken = await createSessionToken({
    userId: supervisorVikram.id,
    name: supervisorVikram.name,
    phone: supervisorVikram.phone,
    role: supervisorVikram.role,
    organizationId: supervisorVikram.organizationId,
    siteId: supervisorVikram.siteId,
  });

  const techToken = await createSessionToken({
    userId: techRajesh.id,
    name: techRajesh.name,
    phone: techRajesh.phone,
    role: techRajesh.role,
    organizationId: techRajesh.organizationId,
    siteId: techRajesh.siteId,
  });

  // ---------------------------------------------------------------------------
  // CONSTRAINT: AI Extraction Guard (No confirmed incident without user approval)
  // ---------------------------------------------------------------------------
  console.log("CONSTRAINT: AI Extraction Approval Enforcement");

  // 1a. Direct validator check
  try {
    assertAiExtractionApproval({ isAiExtracted: true, userConfirmed: false, targetStatus: "SUBMITTED" });
    assert(false, "Should reject unconfirmed AI extraction when status is SUBMITTED");
  } catch {
    assert(true, "assertAiExtractionApproval throws when AI result lacks user confirmation");
  }

  // 1b. Permitted if status is DRAFT
  try {
    assertAiExtractionApproval({ isAiExtracted: true, userConfirmed: false, targetStatus: "DRAFT" });
    assert(true, "Unconfirmed AI extraction permitted as DRAFT");
  } catch {
    assert(false, "Unconfirmed AI extraction should be allowed to save as DRAFT");
  }

  // 1c. Permitted when user explicitly confirms
  try {
    assertAiExtractionApproval({ isAiExtracted: true, userConfirmed: true, targetStatus: "SUBMITTED" });
    assert(true, "AI extraction permitted to become SUBMITTED when userConfirmed=true");
  } catch {
    assert(false, "User-confirmed AI extraction should be permitted");
  }

  // 1d. API route rejects unconfirmed AI extraction from creating a SUBMITTED ticket
  const aiAttemptReq = new NextRequest("http://localhost:3000/api/v1/incidents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${techToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      siteId: siteBhadla.id,
      assetId: inv01.id,
      title: "Automated Bot Trip Report",
      description: "Automated transcript parsed by model without human confirmation",
      faultCategory: "OVER_TEMPERATURE",
      priority: "HIGH",
      status: "SUBMITTED",
      isAiExtracted: true,
      userConfirmed: false, // NOT confirmed!
    }),
  });
  const aiAttemptRes = await postIncidentsRoute(aiAttemptReq);
  assert(
    aiAttemptRes.status === 422,
    "API blocks AI extraction from creating confirmed incident without user approval (422)"
  );

  // ---------------------------------------------------------------------------
  // FEATURE 6: Priority Suggestions
  // ---------------------------------------------------------------------------
  console.log("\nFEATURE 6: Priority Suggestion Engine");

  // 6a. DC Arc Fire suggests CRITICAL
  const p1 = suggestIncidentPriority({
    faultCategory: "DC_ARC_FIRE",
    assetType: "INVERTER",
    title: "Arc flash in switchgear",
  });
  assert(p1.suggestedPriority === "CRITICAL", "Suggests CRITICAL for DC_ARC_FIRE");

  // 6b. Safety keywords suggest CRITICAL
  const p2 = suggestIncidentPriority({
    faultCategory: "OTHER",
    title: "Dense black smoke pouring from combiner box",
  });
  assert(p2.suggestedPriority === "CRITICAL", "Suggests CRITICAL when smoke/fire keywords detected");

  // 6c. Inverter over-temperature suggests HIGH
  const p3 = suggestIncidentPriority({
    faultCategory: "OVER_TEMPERATURE",
    assetType: "INVERTER",
  });
  assert(p3.suggestedPriority === "HIGH", "Suggests HIGH for OVER_TEMPERATURE on INVERTER");

  // 6d. Repeat fault frequency escalation (3+ times in 30d -> CRITICAL)
  const p4 = suggestIncidentPriority({
    faultCategory: "TRACKER_FAILURE",
    repeatCount30d: 3,
  });
  assert(p4.suggestedPriority === "CRITICAL", "Escalates to CRITICAL when repeat fault >= 3");

  // 6e. API Endpoint for priority suggestion
  const suggestReq = new NextRequest("http://localhost:3000/api/v1/incidents/suggest-priority", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${techToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      faultCategory: "INSULATION_FAILURE",
      assetId: inv01.id,
      title: "Low insulation resistance test",
    }),
  });
  const suggestRes = await suggestPriorityRoute(suggestReq);
  const suggestJson = await suggestRes.json();
  assert(suggestJson.success === true, "POST /api/v1/incidents/suggest-priority succeeds");
  assert(
    suggestJson.data.suggestedPriority === "HIGH" || suggestJson.data.suggestedPriority === "CRITICAL",
    "API returns intelligent priority recommendation"
  );
  assert(Array.isArray(suggestJson.data.reasoning), "API returns transparent reasoning array");

  // ---------------------------------------------------------------------------
  // FEATURE 1: Incident Creation with User Confirmation
  // ---------------------------------------------------------------------------
  console.log("\nFEATURE 1: Incident Creation with User Approval");

  const createReq = new NextRequest("http://localhost:3000/api/v1/incidents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${techToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      siteId: siteBhadla.id,
      assetId: inv01.id,
      title: "Inverter 1 Blower Fan Bearing Seized",
      description: "Audible screeching and airflow failure warning on Inverter 1 cooling blower.",
      symptoms: "Grinding sound, thermal throttling at 2.1MW",
      errorCode: "F-042",
      faultCategory: "OVER_TEMPERATURE",
      priority: "HIGH",
      userConfirmed: true, // User approved
    }),
  });
  const createRes = await postIncidentsRoute(createReq);
  const createJson = await createRes.json();
  assert(createRes.status === 201, "Incident created with 201 Created");
  assert(createJson.data.ticketNumber.startsWith("INC-"), "Generates sequential ticket number");
  assert(createJson.data.status === "SUBMITTED", "Initial confirmed status is SUBMITTED");
  assert(createJson.data.reportedByUserId === techRajesh.id, "Attributed to reporting technician");

  const incidentId = createJson.data.id;

  // ---------------------------------------------------------------------------
  // FEATURE 2 & 4: Incident Listing, Search, and Filtering
  // ---------------------------------------------------------------------------
  console.log("\nFEATURE 2 & 4: Incident Listing, Search, and Filters");

  // 2a. List all
  const listReq = new NextRequest("http://localhost:3000/api/v1/incidents", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const listRes = await getIncidentsRoute(listReq);
  const listJson = await listRes.json();
  assert(listJson.success === true && listJson.data.length >= 1, "Lists incidents from database");

  // 4a. Filter by status SUBMITTED
  const filterStatusReq = new NextRequest("http://localhost:3000/api/v1/incidents?status=SUBMITTED", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const filterStatusRes = await getIncidentsRoute(filterStatusReq);
  const filterStatusJson = await filterStatusRes.json();
  assert(
    filterStatusJson.data.every((i: { status: string }) => i.status === "SUBMITTED"),
    "Filters incidents by status=SUBMITTED"
  );

  // 4b. Filter by priority HIGH
  const filterPriorityReq = new NextRequest("http://localhost:3000/api/v1/incidents?priority=HIGH", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const filterPriorityRes = await getIncidentsRoute(filterPriorityReq);
  const filterPriorityJson = await filterPriorityRes.json();
  assert(
    filterPriorityJson.data.every((i: { priority: string }) => i.priority === "HIGH"),
    "Filters incidents by priority=HIGH"
  );

  // 4c. Search by keyword
  const searchReq = new NextRequest("http://localhost:3000/api/v1/incidents?q=Blower", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const searchRes = await getIncidentsRoute(searchReq);
  const searchJson = await searchRes.json();
  assert(
    searchJson.data.some((i: { id: string }) => i.id === incidentId),
    "Search finds incident by keyword 'Blower'"
  );

  // ---------------------------------------------------------------------------
  // FEATURE 3 & 7: Incident Detail Page & Attribution
  // ---------------------------------------------------------------------------
  console.log("\nFEATURE 3 & 7: Incident Detail Retrieval & Personnel Attribution");

  const detailReq = new NextRequest(`http://localhost:3000/api/v1/incidents/${incidentId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const detailRes = await getIncidentByIdRoute(detailReq, {
    params: Promise.resolve({ id: incidentId }),
  });
  const detailJson = await detailRes.json();

  assert(detailJson.success === true, "GET /api/v1/incidents/[id] succeeds");
  assert(detailJson.data.reportedBy.name === techRajesh.name, "Correctly attributes reporter");
  assert(detailJson.data.asset.assetTag === "INV-01", "Includes asset context");
  assert(Array.isArray(detailJson.data.events) && detailJson.data.events.length >= 1, "Includes audit events timeline");

  // ---------------------------------------------------------------------------
  // FEATURE 5, 8, 9: Status Transitions, Audit Events, and Timeline
  // ---------------------------------------------------------------------------
  console.log("\nFEATURE 5, 8, 9: Status Management, Validation & Audit Event Logging");

  // 5a. Invalid status transition rejected (SUBMITTED -> CLOSED without resolution)
  try {
    validateIncidentTransition("SUBMITTED", "CLOSED", UserRole.SUPERVISOR);
    assert(false, "Direct transition SUBMITTED -> CLOSED should be rejected");
  } catch (err: unknown) {
    assert(getErrStatus(err) === 400, "Rejects invalid transition SUBMITTED -> CLOSED with 400 Bad Request");
  }

  // 5b. Technician unauthorized transition (SUBMITTED -> ACKNOWLEDGED is supervisor only)
  try {
    validateIncidentTransition("SUBMITTED", "ACKNOWLEDGED", UserRole.TECHNICIAN);
    assert(false, "Technician should not acknowledge ticket");
  } catch (err: unknown) {
    assert(getErrStatus(err) === 403, "Technician blocked from acknowledging ticket (403 Forbidden)");
  }

  // 5c. Supervisor acknowledges and assigns ticket (SUBMITTED -> ACKNOWLEDGED)
  const ackReq = new NextRequest(`http://localhost:3000/api/v1/incidents/${incidentId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${supervisorToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      status: "ACKNOWLEDGED",
      assignedToUserId: techRajesh.id,
    }),
  });
  const ackRes = await patchIncidentByIdRoute(ackReq, {
    params: Promise.resolve({ id: incidentId }),
  });
  const ackJson = await ackRes.json();
  assert(ackRes.status === 200, "Supervisor successfully transitions SUBMITTED -> ACKNOWLEDGED");
  assert(ackJson.data.status === "ACKNOWLEDGED", "Incident status updated in DB to ACKNOWLEDGED");
  assert(ackJson.data.assignedTo.name === techRajesh.name, "Assignee successfully attributed to technician");

  // 5d. Technician starts work (ACKNOWLEDGED -> IN_PROGRESS)
  const startWorkReq = new NextRequest(`http://localhost:3000/api/v1/incidents/${incidentId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${techToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      status: "IN_PROGRESS",
    }),
  });
  const startWorkRes = await patchIncidentByIdRoute(startWorkReq, {
    params: Promise.resolve({ id: incidentId }),
  });
  assert(startWorkRes.status === 200, "Technician successfully transitions ACKNOWLEDGED -> IN_PROGRESS");

  // 5e. Technician completes repair (IN_PROGRESS -> RESOLVED)
  const resolveReq = new NextRequest(`http://localhost:3000/api/v1/incidents/${incidentId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${techToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      status: "RESOLVED",
      resolutionNotes: "Replaced blower fan assembly bearing with SKF 6204 sealed bearing. Airflow nominal.",
    }),
  });
  const resolveRes = await patchIncidentByIdRoute(resolveReq, {
    params: Promise.resolve({ id: incidentId }),
  });
  const resolveJson = await resolveRes.json();
  assert(resolveRes.status === 200, "Technician successfully transitions IN_PROGRESS -> RESOLVED");
  assert(resolveJson.data.status === "RESOLVED", "Incident status updated in DB to RESOLVED");

  // 5f. Technician blocked from closing ticket (RESOLVED -> CLOSED is supervisor only)
  const techCloseReq = new NextRequest(`http://localhost:3000/api/v1/incidents/${incidentId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${techToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      status: "CLOSED",
    }),
  });
  const techCloseRes = await patchIncidentByIdRoute(techCloseReq, {
    params: Promise.resolve({ id: incidentId }),
  });
  assert(techCloseRes.status === 403, "Technician blocked from closing ticket (403 Forbidden)");

  // 5g. Supervisor verifies and closes ticket (RESOLVED -> CLOSED)
  const supCloseReq = new NextRequest(`http://localhost:3000/api/v1/incidents/${incidentId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${supervisorToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      status: "CLOSED",
    }),
  });
  const supCloseRes = await patchIncidentByIdRoute(supCloseReq, {
    params: Promise.resolve({ id: incidentId }),
  });
  const supCloseJson = await supCloseRes.json();
  assert(supCloseRes.status === 200, "Supervisor successfully transitions RESOLVED -> CLOSED");
  assert(supCloseJson.data.status === "CLOSED", "Incident finalized and closed");

  // 9a. Verify IncidentEvent audit trail in database
  const events = await prisma.incidentEvent.findMany({
    where: { incidentId },
    orderBy: { createdAt: "asc" },
  });
  assert(events.length >= 4, `Persisted ${events.length} audit events in IncidentEvent table`);

  const eventTypes = events.map((e) => e.eventType);
  assert(eventTypes.includes("CONFIRMATION"), "Audit trail contains CONFIRMATION event");
  assert(eventTypes.includes("STATUS_CHANGE"), "Audit trail contains STATUS_CHANGE events");
  assert(
    events.some((e) => e.fromStatus === "SUBMITTED" && e.toStatus === "ACKNOWLEDGED"),
    "Audit trail logs exact state transition SUBMITTED -> ACKNOWLEDGED"
  );
  assert(
    events.some((e) => e.fromStatus === "RESOLVED" && e.toStatus === "CLOSED"),
    "Audit trail logs exact state transition RESOLVED -> CLOSED"
  );

  // Clean up test incident and its events
  await prisma.incidentEvent.deleteMany({ where: { incidentId } });
  await prisma.incident.delete({ where: { id: incidentId } });
  console.log("\n  🧹 Test incident and audit events cleaned up from database");

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log("\n==================================================================");
  console.log(`📊 Incident Management Results: ${passedTests} Passed, ${failedTests} Failed`);
  console.log("==================================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite()
  .catch((e) => {
    console.error("Test execution failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

