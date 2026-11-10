import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, assertOrgAccess, assertSiteAccess } from "@/lib/auth-guard";
import { handleApiError, NotFoundError } from "@/lib/errors";
import { apiSuccess } from "@/lib/api-response";
import { getHistoricalIntelligenceService } from "@/modules/incidents";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/incidents/:id/historical-intelligence
 * Retrieves historical incident intelligence for an existing incident being reviewed:
 * 1. Previous incidents on the same asset.
 * 2. Similar reported symptoms using text similarity.
 * 3. Previous incidents with dates, statuses, and labels.
 * 4. Previously recorded actions and resolution notes.
 * 5. Repeated reported symptoms with occurrence frequency.
 * 6. Currently unresolved incidents.
 *
 * Invariant: Never claims two incidents have the same root cause merely because descriptions are similar.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth(req);
    const { id: incidentId } = await params;

    const incident = await db.incident.findUnique({
      where: { id: incidentId },
      include: {
        site: { select: { id: true, name: true, organizationId: true } },
        asset: { select: { id: true, assetTag: true, name: true, assetType: true } },
      },
    });

    if (!incident) {
      throw new NotFoundError("Incident ticket not found.");
    }

    assertOrgAccess(incident.site.organizationId, session);
    assertSiteAccess(incident.siteId, session);

    const service = getHistoricalIntelligenceService(db);
    const report = await service.analyzeHistoricalIntelligence({
      siteId: incident.siteId,
      currentIncidentId: incident.id,
      assetId: incident.assetId,
      assetTag: incident.asset?.assetTag || null,
      symptoms: incident.symptoms,
      description: incident.description,
      title: incident.title,
      errorCode: incident.errorCode,
    });

    return apiSuccess(report);
  } catch (err) {
    return handleApiError(err);
  }
}
