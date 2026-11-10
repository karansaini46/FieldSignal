import { describe, it, expect } from "vitest";
import { PrismaClient } from "@prisma/client";
import { GET as getIncidentByIdHandler } from "@/app/api/v1/incidents/[id]/route";
import { POST as createIncidentHandler } from "@/app/api/v1/incidents/route";
import { POST as transcribeHandler } from "@/app/api/v1/speech/transcribe/route";
import { createSessionToken } from "@/lib/session";
import { NextRequest } from "next/server";

const prisma = new PrismaClient();

// ponytail: test suite 14 covering API failure handling, defensive validation, and unified error envelopes
describe("Audit 14: API Failure & Error Handling Envelopes", () => {
  it("returns 401 UNAUTHORIZED when no session token is provided", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await createIncidentHandler(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toBeDefined();
    expect(
      json.error.message.toLowerCase().includes("authentication required") ||
        json.error.message.toLowerCase().includes("unauthorized")
    ).toBe(true);
  });

  it("returns 404 NOT_FOUND for non-existent incident UUIDs", async () => {
    const adminUser = await prisma.user.findFirst({
      where: { role: "ADMIN" },
      include: { organization: true, site: true },
    });
    expect(adminUser).not.toBeNull();

    const token = await createSessionToken({
      userId: adminUser!.id,
      name: adminUser!.name,
      phone: adminUser!.phone,
      role: adminUser!.role,
      organizationId: adminUser!.organizationId,
    });

    const nonExistentUuid = "00000000-0000-0000-0000-000000000000";
    const req = new NextRequest(`http://localhost:3000/api/v1/incidents/${nonExistentUuid}`, {
      method: "GET",
      headers: { Cookie: `fs_session=${token}` },
    });

    const res = await getIncidentByIdHandler(req, {
      params: Promise.resolve({ id: nonExistentUuid }),
    });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.message.toLowerCase()).toContain("not found");
  });

  it("returns 404 NOT_FOUND without tenant leakage when user queries incident belonging to another organization", async () => {
    const sunriseOrg = await prisma.organization.findUnique({ where: { code: "SUNRISE-SOLAR" } });
    const apexOrg = await prisma.organization.findUnique({ where: { code: "APEX-SOLAR" } });

    // Find an incident belonging to Apex
    const apexIncident = await prisma.incident.findFirst({
      where: { site: { organizationId: apexOrg!.id } },
    });
    expect(apexIncident).not.toBeNull();

    // Login as Sunrise Admin
    const sunriseAdmin = await prisma.user.findFirst({
      where: { organizationId: sunriseOrg!.id, role: "ADMIN" },
      include: { organization: true },
    });
    expect(sunriseAdmin).not.toBeNull();

    const token = await createSessionToken({
      userId: sunriseAdmin!.id,
      name: sunriseAdmin!.name,
      phone: sunriseAdmin!.phone,
      role: sunriseAdmin!.role,
      organizationId: sunriseAdmin!.organizationId,
    });

    const req = new NextRequest(`http://localhost:3000/api/v1/incidents/${apexIncident!.id}`, {
      method: "GET",
      headers: { Cookie: `fs_session=${token}` },
    });

    const res = await getIncidentByIdHandler(req, {
      params: Promise.resolve({ id: apexIncident!.id }),
    });

    // Multi-tenant security rule: Returns 404 to avoid leaking whether ID exists in another tenant
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it("returns 400 BAD_REQUEST when audio upload is missing or malformed", async () => {
    const techUser = await prisma.user.findFirst({
      where: { role: "TECHNICIAN" },
      include: { organization: true },
    });
    const token = await createSessionToken({
      userId: techUser!.id,
      name: techUser!.name,
      phone: techUser!.phone,
      role: techUser!.role,
      organizationId: techUser!.organizationId,
    });

    // Form data with empty body
    const formData = new FormData();
    const req = new NextRequest("http://localhost:3000/api/v1/speech/transcribe", {
      method: "POST",
      headers: { Cookie: `fs_session=${token}` },
      body: formData,
    });

    const res = await transcribeHandler(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.message.toLowerCase()).toContain("audio");
  });
});
