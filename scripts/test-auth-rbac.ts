/**
 * FieldSignal — Automated Integration Test Suite for Auth & RBAC
 *
 * Verifies:
 * 1. 401 Unauthorized for unauthenticated requests
 * 2. Successful Login & JWT issuance
 * 3. 403 Forbidden when Technician modifies supervisor-only fields (assignedToUserId, priority)
 * 4. 403 Forbidden when Technician attempts to close an incident
 * 5. Multi-tenant isolation: Zero cross-organization data leakage (Org A cannot see or modify Org B)
 * 6. Site-level isolation: Technician from Site 1 cannot access Site 2
 * 7. Supervisor authorized assignment & priority modification
 * 8. Admin full organization portfolio visibility
 */

import { PrismaClient, UserRole, IncidentStatus, IncidentPriority } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createSessionToken } from "../src/lib/session";
import {
  requireAuth,
  assertOrgAccess,
  assertSiteAccess,
  assertTechnicianMutationAllowed,
} from "../src/lib/auth-guard";
import { validateIncidentTransition } from "../src/modules/incidents/state-machine";

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
  console.log("🛡️  FieldSignal Authentication & RBAC Security Test Suite");
  console.log("==================================================================\n");

  // Fetch test users & entities seeded earlier
  const orgSunrise = await prisma.organization.findUniqueOrThrow({
    where: { code: "SUNRISE-SOLAR" },
  });
  const orgApex = await prisma.organization.findUniqueOrThrow({ where: { code: "APEX-SOLAR" } });

  const siteBhadla = await prisma.site.findUniqueOrThrow({ where: { code: "SUN-BHA-04" } });
  const sitePavagada = await prisma.site.findUniqueOrThrow({ where: { code: "SUN-PAV-02" } });
  const siteApex = await prisma.site.findUniqueOrThrow({ where: { code: "APEX-REW-01" } });

  const techRajesh = await prisma.user.findUniqueOrThrow({ where: { phone: "+919876500002" } });
  const supervisorVikram = await prisma.user.findUniqueOrThrow({
    where: { phone: "+919876500001" },
  });
  const adminPooja = await prisma.user.findUniqueOrThrow({ where: { phone: "+919876500000" } });

  const incidentSunrise = await prisma.incident.findUniqueOrThrow({
    where: { ticketNumber: "INC-2026-0001" },
  });
  const incidentApex = await prisma.incident.findUniqueOrThrow({
    where: { ticketNumber: "INC-APEX-0001" },
  });

  // ---------------------------------------------------------------------------
  // TEST 1: Password Verification & JWT Token Issuance
  // ---------------------------------------------------------------------------
  console.log("TEST 1: Password Hashing & JWT Token Issuance");
  const isMatch = bcrypt.compareSync("password123", techRajesh.passwordHash);
  assert(isMatch === true, "bcrypt validates correct user password");

  const isWrongMatch = bcrypt.compareSync("wrongpassword", techRajesh.passwordHash);
  assert(isWrongMatch === false, "bcrypt rejects invalid password");

  const techToken = await createSessionToken({
    userId: techRajesh.id,
    name: techRajesh.name,
    phone: techRajesh.phone,
    role: techRajesh.role,
    organizationId: techRajesh.organizationId,
    siteId: techRajesh.siteId,
  });
  assert(
    typeof techToken === "string" && techToken.length > 50,
    "JWT session token created successfully"
  );

  // ---------------------------------------------------------------------------
  // TEST 2: Unauthenticated Access Enforcement
  // ---------------------------------------------------------------------------
  console.log("\nTEST 2: Unauthenticated Access Guard");
  try {
    const fakeReq = new Request("http://localhost:3000/api/v1/incidents");
    await requireAuth(fakeReq);
    assert(false, "requireAuth should throw for unauthenticated request");
  } catch (err: unknown) {
    assert(getErrStatus(err) === 401, "Unauthenticated request throws 401 Unauthorized");
  }

  // ---------------------------------------------------------------------------
  // TEST 3: Technician Prevented From Modifying Supervisor-Only Fields
  // ---------------------------------------------------------------------------
  console.log("\nTEST 3: Server-Side Technician Field Protection");
  const techSession = {
    userId: techRajesh.id,
    name: techRajesh.name,
    phone: techRajesh.phone,
    role: UserRole.TECHNICIAN,
    organizationId: orgSunrise.id,
    siteId: siteBhadla.id,
  };

  // Attempt 3a: Technician tries to reassign ticket
  try {
    assertTechnicianMutationAllowed({ assignedToUserId: supervisorVikram.id }, techSession);
    assert(false, "Technician should not be allowed to assign tickets");
  } catch (err: unknown) {
    assert(
      getErrStatus(err) === 403,
      "Technician blocked from mutating assignedToUserId (403 Forbidden)"
    );
  }

  // Attempt 3b: Technician tries to override priority
  try {
    assertTechnicianMutationAllowed({ priority: IncidentPriority.CRITICAL }, techSession);
    assert(false, "Technician should not be allowed to change ticket priority");
  } catch (err: unknown) {
    assert(getErrStatus(err) === 403, "Technician blocked from mutating priority (403 Forbidden)");
  }

  // Attempt 3c: Technician tries to close incident directly
  try {
    assertTechnicianMutationAllowed({ status: "CLOSED" }, techSession);
    assert(false, "Technician should not be allowed to close incident");
  } catch (err: unknown) {
    assert(
      getErrStatus(err) === 403,
      "Technician blocked from setting status to CLOSED (403 Forbidden)"
    );
  }

  // Attempt 3d: Technician updates permitted fields (symptoms, description)
  try {
    assertTechnicianMutationAllowed(
      { description: "Cleaned inverter heat sink dust filter", symptoms: "Dust accumulated" },
      techSession
    );
    assert(true, "Technician permitted to update work progress and symptoms");
  } catch {
    assert(false, "Technician should be allowed to update operational description");
  }

  // ---------------------------------------------------------------------------
  // TEST 4: Multi-Tenant Organization Data Isolation
  // ---------------------------------------------------------------------------
  console.log("\nTEST 4: Multi-Tenant Organization Isolation");
  // User from Sunrise Solar attempts to access Apex incident
  try {
    assertOrgAccess(orgApex.id, techSession);
    assert(false, "Sunrise Solar technician should not access Apex Solar organization");
  } catch (err: unknown) {
    const status = getErrStatus(err);
    assert(
      status === 404 || status === 403,
      "Cross-organization access strictly blocked"
    );
  }

  // Query database scoped to Sunrise Solar
  const sunriseIncidents = await prisma.incident.findMany({
    where: { site: { organizationId: orgSunrise.id } },
  });
  const hasApexLeak = sunriseIncidents.some((i) => i.id === incidentApex.id);
  assert(hasApexLeak === false, "Scoped query returns zero incidents from another organization");

  // Apex Technician querying their incidents
  const apexIncidents = await prisma.incident.findMany({
    where: { site: { organizationId: orgApex.id } },
  });
  const hasSunriseLeak = apexIncidents.some((i) => i.id === incidentSunrise.id);
  assert(
    hasSunriseLeak === false,
    "Apex Clean Energy query returns zero incidents from Sunrise Solar"
  );

  // ---------------------------------------------------------------------------
  // TEST 5: Site-Level Access Restrictions
  // ---------------------------------------------------------------------------
  console.log("\nTEST 5: Site-Level Access Restrictions for Field Personnel");
  // Bhadla technician attempts to access Pavagada site
  try {
    assertSiteAccess(sitePavagada.id, techSession);
    assert(false, "Bhadla technician should not access Pavagada site");
  } catch (err: unknown) {
    assert(
      getErrStatus(err) === 403,
      "Bhadla technician accessing Pavagada site blocked (403 Forbidden)"
    );
  }

  // Bhadla technician accesses Bhadla site
  try {
    assertSiteAccess(siteBhadla.id, techSession);
    assert(true, "Bhadla technician authorized for their assigned Bhadla site");
  } catch {
    assert(false, "Bhadla technician should access their assigned site");
  }

  // ---------------------------------------------------------------------------
  // TEST 6: Supervisor Role Permissions & Transition Rules
  // ---------------------------------------------------------------------------
  console.log("\nTEST 6: Supervisor Authorization & Lifecycle Transitions");
  const supervisorSession = {
    userId: supervisorVikram.id,
    name: supervisorVikram.name,
    phone: supervisorVikram.phone,
    role: UserRole.SUPERVISOR,
    organizationId: orgSunrise.id,
    siteId: siteBhadla.id,
  };

  // Supervisor assigns ticket and changes priority
  try {
    assertTechnicianMutationAllowed(
      { assignedToUserId: techRajesh.id, priority: IncidentPriority.CRITICAL },
      supervisorSession
    );
    assert(true, "Supervisor authorized to modify assignedToUserId and priority");
  } catch {
    assert(false, "Supervisor should be authorized to modify supervisor fields");
  }

  // Supervisor verifies and closes resolved incident
  try {
    validateIncidentTransition(IncidentStatus.RESOLVED, IncidentStatus.CLOSED, UserRole.SUPERVISOR);
    assert(true, "Supervisor authorized to transition RESOLVED -> CLOSED");
  } catch {
    assert(false, "Supervisor should be allowed to close ticket");
  }

  // Technician attempts to transition RESOLVED -> CLOSED
  try {
    validateIncidentTransition(IncidentStatus.RESOLVED, IncidentStatus.CLOSED, UserRole.TECHNICIAN);
    assert(false, "Technician should not transition RESOLVED -> CLOSED");
  } catch (err: unknown) {
    assert(getErrStatus(err) === 403, "Technician blocked from closing ticket (403 Forbidden)");
  }

  // ---------------------------------------------------------------------------
  // TEST 7: Admin Portfolio Organization Access
  // ---------------------------------------------------------------------------
  console.log("\nTEST 7: Admin Portfolio Organization Access");
  const adminSession = {
    userId: adminPooja.id,
    name: adminPooja.name,
    phone: adminPooja.phone,
    role: UserRole.ADMIN,
    organizationId: orgSunrise.id,
    siteId: null, // Portfolio manager
  };

  try {
    assertSiteAccess(siteBhadla.id, adminSession);
    assertSiteAccess(sitePavagada.id, adminSession);
    assert(true, "Admin authorized to access all sites within their organization");
  } catch {
    assert(false, "Admin should access all sites in organization");
  }

  // Admin blocked from cross-org site
  try {
    assertOrgAccess(siteApex.organizationId, adminSession);
    assert(false, "Admin from Sunrise Solar cannot access Apex Clean Energy");
  } catch (err: unknown) {
    const status = getErrStatus(err);
    assert(
      status === 404 || status === 403,
      "Admin strictly blocked from other organizations"
    );
  }

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log("\n==================================================================");
  console.log(`📊 Test Results: ${passedTests} Passed, ${failedTests} Failed`);
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
