import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth, assertOrgAccess, assertSiteAccess } from "@/lib/auth-guard";
import { handleApiError, NotFoundError, BadRequestError } from "@/lib/errors";
import { apiSuccess } from "@/lib/api-response";
import { IncidentStatus, ClarificationStatus } from "@prisma/client";
import { extractAlarmCodeFromText } from "@/modules/incidents/clarification-service";
import { getAssetMatcher } from "@/modules/assets/asset-matcher";

const answerClarificationSchema = z.object({
  clarificationId: z.string().uuid("Invalid clarification ID"),
  response: z.string().min(1, "Clarification response cannot be empty"),
  fromVoice: z.boolean().optional().default(false),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/incidents/:id/clarifications
 * Answers a pending incident clarification question via text or voice transcript.
 * Updates incident attributes, checks if all clarifications are resolved,
 * and maintains the immutable audit trail.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth(req);
    const { id: incidentId } = await params;
    const body = await req.json();
    const data = answerClarificationSchema.parse(body);

    // 1. Fetch incident and verify multi-tenant access
    const incident = await db.incident.findUnique({
      where: { id: incidentId },
      include: {
        site: { select: { id: true, name: true, organizationId: true } },
      },
    });

    if (!incident) {
      throw new NotFoundError("Incident ticket not found.");
    }

    assertOrgAccess(incident.site.organizationId, session);
    assertSiteAccess(incident.siteId, session);

    // 2. Fetch specific clarification record
    const clarification = await db.clarification.findFirst({
      where: {
        id: data.clarificationId,
        incidentId,
      },
    });

    if (!clarification) {
      throw new NotFoundError("Clarification request not found on this incident.");
    }

    if (clarification.status === ClarificationStatus.RESOLVED) {
      throw new BadRequestError("This clarification question has already been answered.");
    }

    const trimmedResponse = data.response.trim();

    // 3. Atomically update clarification, update incident fields, and log audit event
    const result = await db.$transaction(async (tx) => {
      // 3a. Update Clarification record
      const updatedClarification = await tx.clarification.update({
        where: { id: clarification.id },
        data: {
          response: trimmedResponse,
          status: ClarificationStatus.RESOLVED,
          respondedByUserId: session.userId,
          respondedAt: new Date(),
        },
        include: {
          requestedBy: { select: { id: true, name: true, role: true } },
          respondedBy: { select: { id: true, name: true, role: true } },
        },
      });

      // 3b. Update incident properties based on the answered field
      const incidentUpdates: Record<string, unknown> = {};

      if (clarification.missingField === "asset" || clarification.missingField === "assetId") {
        if (!incident.assetId) {
          // Attempt deterministic match against site assets
          const siteAssets = await tx.asset.findMany({
            where: { siteId: incident.siteId },
            select: { id: true, assetTag: true, name: true, assetType: true, block: true, row: true, model: true, siteId: true },
          });
          const matcher = getAssetMatcher();
          const matchResult = matcher.matchAsset(
            { extractedCode: trimmedResponse, transcript: trimmedResponse },
            {
              siteId: incident.siteId,
              siteName: incident.site.name,
              siteAssets: siteAssets.map((a) => ({ ...a, siteName: incident.site.name, confidence: 0, matchReason: "" })),
            }
          );
          if (matchResult.status === "EXACT_MATCH" && matchResult.matchedAsset) {
            incidentUpdates.assetId = matchResult.matchedAsset.id;
          }
        }
      } else if (clarification.missingField === "errorCode" || clarification.missingField === "alarm_code") {
        const parsedCode = extractAlarmCodeFromText(trimmedResponse);
        if (parsedCode) {
          incidentUpdates.errorCode = parsedCode;
        }
      } else if (clarification.missingField === "current_status") {
        const appended = incident.symptoms
          ? `${incident.symptoms} | Current status: ${trimmedResponse}`
          : `Current status: ${trimmedResponse}`;
        incidentUpdates.symptoms = appended;
      } else if (clarification.missingField === "repair_result") {
        const appended = `${incident.description}\n\n[Clarification Update - Repair Outcome]: ${trimmedResponse}`;
        incidentUpdates.description = appended;
      }

      // Check remaining pending clarifications
      const remainingPending = await tx.clarification.count({
        where: {
          incidentId,
          id: { not: clarification.id },
          status: ClarificationStatus.PENDING,
        },
      });

      // If all clarifications are resolved and incident was in NEEDS_CLARIFICATION, advance status
      let targetStatus = incident.status;
      if (remainingPending === 0 && incident.status === IncidentStatus.NEEDS_CLARIFICATION) {
        targetStatus = incident.confirmedAt ? IncidentStatus.SUBMITTED : IncidentStatus.DRAFT;
        incidentUpdates.status = targetStatus;
      }

      const updatedIncident = await tx.incident.update({
        where: { id: incidentId },
        data: incidentUpdates,
        include: {
          site: { select: { id: true, name: true, code: true } },
          asset: { select: { id: true, assetTag: true, name: true, assetType: true } },
          reportedBy: { select: { id: true, name: true, role: true } },
          assignedTo: { select: { id: true, name: true, role: true } },
          clarifications: {
            include: {
              requestedBy: { select: { id: true, name: true, role: true } },
              respondedBy: { select: { id: true, name: true, role: true } },
            },
            orderBy: { createdAt: "desc" },
          },
          events: {
            include: { user: { select: { id: true, name: true, role: true } } },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      // 3c. Record timeline audit event
      await tx.incidentEvent.create({
        data: {
          incidentId,
          userId: session.userId,
          eventType: targetStatus !== incident.status ? "STATUS_CHANGE" : "NOTE_ADDED",
          fromStatus: targetStatus !== incident.status ? incident.status : null,
          toStatus: targetStatus !== incident.status ? targetStatus : null,
          title: "Clarification Answered",
          description: `Q: "${clarification.question}"\nA: "${trimmedResponse}"${data.fromVoice ? " (via Voice Note)" : ""}`,
          diff: {
            clarificationId: clarification.id,
            question: clarification.question,
            response: trimmedResponse,
            fromVoice: data.fromVoice,
          },
        },
      });

      return {
        clarification: updatedClarification,
        incident: updatedIncident,
        allResolved: remainingPending === 0,
      };
    });

    return apiSuccess(result);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

