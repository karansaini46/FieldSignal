import { describe, it, expect } from "vitest";
import { PrismaClient, IncidentStatus, UserRole, IncidentPriority, FaultCategory } from "@prisma/client";
import { validateIncidentTransition, getAllowedTransitions } from "@/modules/incidents/state-machine";
import { POST as createIncidentHandler } from "@/app/api/v1/incidents/route";
import { createSessionToken } from "@/lib/session";
import { NextRequest } from "next/server";

const prisma = new PrismaClient();

// ponytail: test suites 8, 9, 11, 12 covering incident creation, idempotency, transitions, and audit trail
describe("Audit 8, 9, 11, 12: Incident Lifecycle, Idempotency & Audit History", () => {
  it("validates legitimate status transitions across user roles", () => {
    // Technician: SUBMITTED -> IN_PROGRESS
    expect(() => validateIncidentTransition("SUBMITTED", "IN_PROGRESS", UserRole.TECHNICIAN)).not.toThrow();

    // Technician: IN_PROGRESS -> RESOLVED
    expect(() => validateIncidentTransition("IN_PROGRESS", "RESOLVED", UserRole.TECHNICIAN)).not.toThrow();

    // Supervisor: RESOLVED -> CLOSED
    expect(() => validateIncidentTransition("RESOLVED", "CLOSED", UserRole.SUPERVISOR)).not.toThrow();

    // Supervisor: SUBMITTED -> ACKNOWLEDGED
    expect(() => validateIncidentTransition("SUBMITTED", "ACKNOWLEDGED", UserRole.SUPERVISOR)).not.toThrow();
  });

  it("rejects illegal state transitions with 400 Bad Request", () => {
    // SUBMITTED cannot jump directly to CLOSED
    expect(() => validateIncidentTransition("SUBMITTED", "CLOSED", UserRole.SUPERVISOR)).toThrow();
    try {
      validateIncidentTransition("SUBMITTED", "CLOSED", UserRole.SUPERVISOR);
    } catch (err: any) {
      expect(err.statusCode).toBe(400);
    }
  });

  it("rejects unauthorized status transitions (e.g. Technician attempting to CLOSE ticket)", () => {
    // Technician cannot transition RESOLVED -> CLOSED (Supervisor sign-off required)
    expect(() => validateIncidentTransition("RESOLVED", "CLOSED", UserRole.TECHNICIAN)).toThrow();
    try {
      validateIncidentTransition("RESOLVED", "CLOSED", UserRole.TECHNICIAN);
    } catch (err: any) {
      expect(err.statusCode).toBe(403);
    }
  });

  it("enforces idempotent incident creation (duplicate submissions return existing incident without duplication)", async () => {
    const techUser = await prisma.user.findFirst({
      where: { role: UserRole.TECHNICIAN, site: { code: "SUN-BHA-04" } },
      include: { organization: true, site: true },
    });
    expect(techUser).not.toBeNull();

    const token = await createSessionToken({
      userId: techUser!.id,
      name: techUser!.name,
      phone: techUser!.phone,
      role: techUser!.role,
      organizationId: techUser!.organizationId,
      siteId: techUser!.siteId,
    });

    const asset = await prisma.asset.findFirst({
      where: { siteId: techUser!.siteId! },
    });
    expect(asset).not.toBeNull();

    const idempotencyKey = `vitest-idem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const payload = {
      siteId: techUser!.siteId,
      assetId: asset!.id,
      title: "Vitest Idempotency Inverter Tripping Test",
      description: "Inverter tripped on overtemperature alarm during peak solar irradiance.",
      symptoms: "High inverter heat, zero power output",
      errorCode: "E04",
      faultCategory: "OVER_TEMPERATURE",
      priority: "HIGH",
      status: "SUBMITTED",
      userConfirmed: true,
      idempotencyKey,
    };

    // First submission
    const req1 = new NextRequest("http://localhost:3000/api/v1/incidents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `fs_session=${token}`,
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    const res1 = await createIncidentHandler(req1);
    const json1 = await res1.json();
    expect(res1.status).toBe(201);
    expect(json1.success).toBe(true);
    const incidentId1 = json1.data.id;
    const ticketNumber1 = json1.data.ticketNumber;

    // Second submission with identical Idempotency-Key
    const req2 = new NextRequest("http://localhost:3000/api/v1/incidents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `fs_session=${token}`,
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    const res2 = await createIncidentHandler(req2);
    const json2 = await res2.json();
    expect(res2.status).toBe(200); // 200 OK for idempotent replay
    expect(json2.success).toBe(true);
    expect(json2.data.id).toBe(incidentId1);
    expect(json2.data.ticketNumber).toBe(ticketNumber1);

    // Verify only 1 confirmation event exists for this incident
    const eventCount = await prisma.incidentEvent.count({
      where: { incidentId: incidentId1, eventType: "CONFIRMATION" },
    });
    expect(eventCount).toBe(1);

    // Clean up created test incident
    await prisma.incidentEvent.deleteMany({ where: { incidentId: incidentId1 } });
    await prisma.clarification.deleteMany({ where: { incidentId: incidentId1 } });
    await prisma.incident.delete({ where: { id: incidentId1 } });
  });

  it("creates immutable audit history event on incident creation", async () => {
    const techUser = await prisma.user.findFirst({
      where: { role: UserRole.TECHNICIAN, site: { code: "SUN-BHA-04" } },
      include: { organization: true, site: true },
    });

    const token = await createSessionToken({
      userId: techUser!.id,
      name: techUser!.name,
      phone: techUser!.phone,
      role: techUser!.role,
      organizationId: techUser!.organizationId,
      siteId: techUser!.siteId,
    });

    const asset = await prisma.asset.findFirst({ where: { siteId: techUser!.siteId! } });
    const idempotencyKey = `vitest-audit-${Date.now()}`;

    const req = new NextRequest("http://localhost:3000/api/v1/incidents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `fs_session=${token}`,
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        siteId: techUser!.siteId,
        assetId: asset!.id,
        title: "Audit Trail Verification Ticket",
        description: "Checking audit trail recording.",
        faultCategory: "OVER_TEMPERATURE",
        priority: "MEDIUM",
        status: "SUBMITTED",
        userConfirmed: true,
        idempotencyKey,
      }),
    });

    const res = await createIncidentHandler(req);
    const json = await res.json();
    expect(json.success).toBe(true);
    const incidentId = json.data.id;

    const auditEvents = await prisma.incidentEvent.findMany({
      where: { incidentId },
      include: { user: true },
    });

    expect(auditEvents.length).toBeGreaterThanOrEqual(1);
    expect(["CREATED", "CONFIRMATION"]).toContain(auditEvents[0]?.eventType);
    expect(auditEvents[0]?.userId).toBe(techUser!.id);

    // Clean up
    await prisma.incidentEvent.deleteMany({ where: { incidentId } });
    await prisma.incident.delete({ where: { id: incidentId } });
  });
});
