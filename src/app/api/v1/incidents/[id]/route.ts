import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  requireAuth,
  assertOrgAccess,
  assertSiteAccess,
  assertTechnicianMutationAllowed,
} from "@/lib/auth-guard";
import { validateIncidentTransition } from "@/modules/incidents/state-machine";
import { handleApiError, NotFoundError } from "@/lib/errors";
import { apiSuccess } from "@/lib/api-response";
import { IncidentStatus, IncidentPriority, IncidentEventType, Prisma } from "@prisma/client";

const updateIncidentSchema = z.object({
  status: z.nativeEnum(IncidentStatus).optional(),
  assignedToUserId: z.string().uuid().optional().nullable(),
  priority: z.nativeEnum(IncidentPriority).optional(),
  resolutionNotes: z.string().optional().nullable(),
  title: z.string().min(3).optional(),
  description: z.string().optional(),
  symptoms: z.string().optional().nullable(),
  errorCode: z.string().optional().nullable(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/incidents/:id
 * Retrieves full incident details, site, asset, reporter/assignee, clarifications, and timeline audit events.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth(req);
    const { id } = await params;

    const incident = await db.incident.findUnique({
      where: { id },
      include: {
        site: { select: { id: true, name: true, code: true, organizationId: true, location: true } },
        asset: {
          select: {
            id: true,
            assetTag: true,
            name: true,
            assetType: true,
            block: true,
            row: true,
            status: true,
            manufacturer: true,
            model: true,
            ratedCapacityKw: true,
          },
        },
        reportedBy: { select: { id: true, name: true, phone: true, role: true } },
        assignedTo: { select: { id: true, name: true, phone: true, role: true } },
        events: {
          include: { user: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: "desc" },
        },
        clarifications: {
          include: {
            requestedBy: { select: { id: true, name: true, role: true } },
            respondedBy: { select: { id: true, name: true, role: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        audioRecording: true,
      },
    });

    if (!incident) {
      throw new NotFoundError("Incident ticket not found.");
    }

    // Enforce Organization and Site data isolation
    assertOrgAccess(incident.site.organizationId, session);
    assertSiteAccess(incident.siteId, session);

    return apiSuccess(incident);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/v1/incidents/:id
 * Modifies an incident ticket with strict server-side validation and audit event creation.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth(req);
    const { id } = await params;
    const body = await req.json();
    const data = updateIncidentSchema.parse(body);

    const existingIncident = await db.incident.findUnique({
      where: { id },
      include: {
        site: { select: { id: true, organizationId: true } },
      },
    });

    if (!existingIncident) {
      throw new NotFoundError("Incident ticket not found.");
    }

    // 1. Multi-tenant Isolation Check
    assertOrgAccess(existingIncident.site.organizationId, session);

    // 2. Site-level Access Check
    assertSiteAccess(existingIncident.siteId, session);

    // 3. Technician Mutation Field Protection (cannot reassign, change priority, or close tickets)
    assertTechnicianMutationAllowed(body, session);

    // 4. Status Transition Validation & Audit Event Planning
    let eventType: IncidentEventType = "FIELD_UPDATE";
    let eventTitle = "Incident Details Updated";
    let eventDescription = `Updated by ${session.name} (${session.role}).`;

    if (data.status && data.status !== existingIncident.status) {
      validateIncidentTransition(existingIncident.status, data.status, session.role);
      eventType = "STATUS_CHANGE";
      eventTitle = `Status Changed: ${existingIncident.status} → ${data.status}`;
      eventDescription =
        data.resolutionNotes ?? `Status updated from ${existingIncident.status} to ${data.status} by ${session.name}.`;
    } else if (
      data.assignedToUserId !== undefined &&
      data.assignedToUserId !== existingIncident.assignedToUserId
    ) {
      eventType = "ASSIGNMENT";
      eventTitle = data.assignedToUserId ? "Ticket Assigned" : "Ticket Unassigned";
      eventDescription = data.assignedToUserId
        ? `Assigned to user ID ${data.assignedToUserId} by ${session.name} (${session.role}).`
        : `Unassigned by ${session.name}.`;
    } else if (data.priority && data.priority !== existingIncident.priority) {
      eventType = "FIELD_UPDATE";
      eventTitle = `Priority Changed: ${existingIncident.priority} → ${data.priority}`;
      eventDescription = `Priority updated to ${data.priority} by ${session.name} (${session.role}).`;
    }

    // Prepare update payload
    const updatePayload: Prisma.IncidentUpdateInput = { ...data };

    if (data.status === IncidentStatus.SUBMITTED && !existingIncident.confirmedAt) {
      updatePayload.confirmedAt = new Date();
    }
    if (data.status === IncidentStatus.RESOLVED && !existingIncident.resolvedAt) {
      updatePayload.resolvedAt = new Date();
    }
    if (data.status === IncidentStatus.CLOSED && !existingIncident.closedAt) {
      updatePayload.closedAt = new Date();
    }

    // Update incident and create audit event atomically in transaction
    const updated = await db.$transaction(async (tx) => {
      const inc = await tx.incident.update({
        where: { id },
        data: updatePayload,
        include: {
          site: { select: { id: true, name: true, code: true } },
          asset: { select: { id: true, assetTag: true, name: true } },
          reportedBy: { select: { id: true, name: true, role: true } },
          assignedTo: { select: { id: true, name: true, role: true } },
        },
      });

      await tx.incidentEvent.create({
        data: {
          incidentId: id,
          userId: session.userId,
          eventType,
          fromStatus: existingIncident.status,
          toStatus: data.status ?? existingIncident.status,
          title: eventTitle,
          description: eventDescription,
          diff: body,
        },
      });

      return inc;
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
