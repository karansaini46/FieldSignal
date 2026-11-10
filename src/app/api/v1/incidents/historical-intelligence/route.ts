import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth, assertSiteAccess } from "@/lib/auth-guard";
import { handleApiError, NotFoundError } from "@/lib/errors";
import { apiSuccess } from "@/lib/api-response";
import { getHistoricalIntelligenceService } from "@/modules/incidents";

const queryHistoricalSchema = z.object({
  siteId: z.string().uuid("Invalid site ID"),
  currentIncidentId: z.string().uuid().optional().nullable(),
  assetId: z.string().uuid().optional().nullable(),
  assetTag: z.string().optional().nullable(),
  symptoms: z.union([z.string(), z.array(z.string())]).optional().nullable(),
  description: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  errorCode: z.string().optional().nullable(),
  limit: z.number().int().min(1).max(50).optional().default(20),
});

/**
 * POST /api/v1/incidents/historical-intelligence
 * Retrieves historical incident intelligence for a draft or specified equipment context.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const body = await req.json();
    const data = queryHistoricalSchema.parse(body);

    assertSiteAccess(data.siteId, session);

    const site = await db.site.findUnique({
      where: { id: data.siteId },
      select: { id: true, name: true, organizationId: true },
    });

    if (!site) {
      throw new NotFoundError("Site not found.");
    }

    const service = getHistoricalIntelligenceService(db);
    const report = await service.analyzeHistoricalIntelligence({
      siteId: data.siteId,
      currentIncidentId: data.currentIncidentId,
      assetId: data.assetId,
      assetTag: data.assetTag,
      symptoms: data.symptoms,
      description: data.description,
      title: data.title,
      errorCode: data.errorCode,
      limit: data.limit,
    });

    return apiSuccess(report);
  } catch (err) {
    return handleApiError(err);
  }
}
