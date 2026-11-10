import { describe, it, expect } from "vitest";
import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createSessionToken, verifySessionToken } from "@/lib/session";
import {
  requireAuth,
  assertOrgAccess,
  assertSiteAccess,
  assertTechnicianMutationAllowed,
} from "@/lib/auth-guard";

const prisma = new PrismaClient();

// ponytail: test suites 1, 2, 3 covering auth, tenant isolation, and site RBAC
describe("Audit 1, 2, 3: Authentication, Organization Isolation & Site Access", () => {
  it("authenticates valid credentials and generates a valid signed JWT", async () => {
    const user = await prisma.user.findFirst({
      where: { role: UserRole.TECHNICIAN },
      include: { organization: true, site: true },
    });

    expect(user).not.toBeNull();
    const isPasswordValid = await bcrypt.compare("password123", user!.passwordHash);
    expect(isPasswordValid).toBe(true);

    const token = await createSessionToken({
      userId: user!.id,
      name: user!.name,
      phone: user!.phone,
      role: user!.role,
      organizationId: user!.organizationId,
      siteId: user!.siteId,
    });

    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(20);

    const payload = await verifySessionToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.userId).toBe(user!.id);
    expect(payload?.role).toBe(UserRole.TECHNICIAN);
    expect(payload?.organizationId).toBe(user!.organizationId);
  });

  it("rejects invalid passwords during credential validation", async () => {
    const user = await prisma.user.findFirst({
      where: { role: UserRole.TECHNICIAN },
    });
    expect(user).not.toBeNull();
    const isPasswordValid = await bcrypt.compare("wrong-password", user!.passwordHash);
    expect(isPasswordValid).toBe(false);
  });

  it("strictly enforces multi-tenant organization isolation (Sunrise vs Apex)", async () => {
    const sunriseOrg = await prisma.organization.findUnique({ where: { code: "SUNRISE-SOLAR" } });
    const apexOrg = await prisma.organization.findUnique({ where: { code: "APEX-SOLAR" } });

    expect(sunriseOrg).not.toBeNull();
    expect(apexOrg).not.toBeNull();
    expect(sunriseOrg!.id).not.toBe(apexOrg!.id);

    // Sunrise technician attempting to access Apex organization resource
    const mockSunriseSession = {
      userId: "user-1",
      name: "Sunrise Tech",
      phone: "+919876500002",
      role: UserRole.TECHNICIAN,
      organizationId: sunriseOrg!.id,
    };

    // Accessing resource from Sunrise must pass
    expect(() => assertOrgAccess(sunriseOrg!.id, mockSunriseSession)).not.toThrow();

    // Accessing resource from Apex MUST throw NotFoundError (404) to avoid tenant leakage
    expect(() => assertOrgAccess(apexOrg!.id, mockSunriseSession)).toThrowError();
    try {
      assertOrgAccess(apexOrg!.id, mockSunriseSession);
    } catch (err: any) {
      expect(err.statusCode).toBe(404);
    }
  });

  it("strictly isolates database queries between organizations", async () => {
    const sunriseOrg = await prisma.organization.findUnique({ where: { code: "SUNRISE-SOLAR" } });
    const apexOrg = await prisma.organization.findUnique({ where: { code: "APEX-SOLAR" } });

    // Query incidents scoped to Sunrise organization
    const sunriseIncidents = await prisma.incident.findMany({
      where: { site: { organizationId: sunriseOrg!.id } },
    });

    // Query incidents scoped to Apex organization
    const apexIncidents = await prisma.incident.findMany({
      where: { site: { organizationId: apexOrg!.id } },
    });

    // Ensure no overlapping IDs between organizations
    const sunriseIds = new Set(sunriseIncidents.map((i) => i.id));
    const apexIds = new Set(apexIncidents.map((i) => i.id));

    for (const id of apexIds) {
      expect(sunriseIds.has(id)).toBe(false);
    }
  });

  it("strictly enforces site-level access control for technicians", async () => {
    const bhadlaSite = await prisma.site.findFirst({ where: { code: "SUN-BHA-04" } });
    const pavagadaSite = await prisma.site.findFirst({ where: { code: "SUN-PAV-02" } });

    expect(bhadlaSite).not.toBeNull();
    expect(pavagadaSite).not.toBeNull();

    // Technician assigned strictly to Bhadla
    const bhadlaTechSession = {
      userId: "tech-bhadla",
      name: "Rajesh",
      phone: "+919876500002",
      role: UserRole.TECHNICIAN,
      organizationId: bhadlaSite!.organizationId,
      siteId: bhadlaSite!.id,
    };

    // Technician accessing their own site succeeds
    expect(() => assertSiteAccess(bhadlaSite!.id, bhadlaTechSession)).not.toThrow();

    // Technician accessing another site throws 403 Forbidden
    expect(() => assertSiteAccess(pavagadaSite!.id, bhadlaTechSession)).toThrow();
    try {
      assertSiteAccess(pavagadaSite!.id, bhadlaTechSession);
    } catch (err: any) {
      expect(err.statusCode).toBe(403);
    }
  });

  it("blocks technicians from mutating supervisor-only fields", async () => {
    const techSession = {
      userId: "tech-1",
      name: "Rajesh",
      phone: "+919876500002",
      role: UserRole.TECHNICIAN,
      organizationId: "org-1",
    };

    const supervisorSession = {
      userId: "sup-1",
      name: "Vikram",
      phone: "+919876500001",
      role: UserRole.SUPERVISOR,
      organizationId: "org-1",
    };

    // Technician attempting to reassign or change priority throws ForbiddenError
    expect(() =>
      assertTechnicianMutationAllowed(
        { assignedToUserId: "new-user-id" },
        techSession
      )
    ).toThrow();

    expect(() =>
      assertTechnicianMutationAllowed(
        { priority: "CRITICAL" },
        techSession
      )
    ).toThrow();

    // Technician modifying valid fields (status, description) is allowed
    expect(() =>
      assertTechnicianMutationAllowed(
        {
          status: "IN_PROGRESS",
          description: "Updated description after inspection",
        },
        techSession
      )
    ).not.toThrow();

    // Supervisor modifying any field is allowed
    expect(() =>
      assertTechnicianMutationAllowed(
        {
          assignedToUserId: "new-user-id",
          priority: "HIGH",
        },
        supervisorSession
      )
    ).not.toThrow();
  });
});
