import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-guard";
import { handleApiError, NotFoundError, BadRequestError } from "@/lib/errors";
import { apiSuccess } from "@/lib/api-response";
import { db } from "@/lib/db";
import { getIncidentExtractionEngine } from "@/modules/extraction";

const extractRequestSchema = z.object({
  transcript: z.string().min(1, "Transcript cannot be empty"),
  siteId: z.string().uuid("Invalid site ID").optional().nullable(),
  assetId: z.string().uuid("Invalid asset ID").optional().nullable(),
});

/**
 * POST /api/v1/incidents/extract
 * Extracts a structured incident from spoken transcript, grounded in site assets and history.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();
    const data = extractRequestSchema.parse(body);

    // 1. Resolve site context (strictly isolated to user's organization)
    let siteId = data.siteId || session.siteId;
    if (!siteId) {
      const defaultSite = await db.site.findFirst({
        where: { organizationId: session.organizationId },
        select: { id: true },
      });
      siteId = defaultSite?.id || null;
    }

    if (!siteId) {
      throw new BadRequestError("No valid site associated with user organization");
    }

    const site = await db.site.findFirst({
      where: {
        id: siteId,
        organizationId: session.organizationId,
      },
      select: {
        id: true,
        name: true,
        code: true,
        location: true,
      },
    });

    if (!site) {
      throw new NotFoundError("Solar plant site not found or access restricted");
    }

    // 2. Fetch selected asset if requested
    let selectedAsset = null;
    if (data.assetId) {
      selectedAsset = await db.asset.findFirst({
        where: {
          id: data.assetId,
          siteId: site.id,
        },
        select: {
          id: true,
          assetTag: true,
          name: true,
          assetType: true,
          block: true,
          row: true,
          manufacturer: true,
          model: true,
          ratedCapacityKw: true,
        },
      });
    }

    // 3. Fetch known site assets to prevent hallucination
    const knownSiteAssets = await db.asset.findMany({
      where: { siteId: site.id },
      select: {
        id: true,
        assetTag: true,
        name: true,
        assetType: true,
        block: true,
        model: true,
      },
      take: 100,
      orderBy: [{ block: "asc" }, { assetTag: "asc" }],
    });

    // 4. Fetch previous incidents for recurrence detection
    const previousIncidents = await db.incident.findMany({
      where: {
        siteId: site.id,
        ...(data.assetId ? { assetId: data.assetId } : {}),
      },
      select: {
        id: true,
        ticketNumber: true,
        title: true,
        faultCategory: true,
        priority: true,
        createdAt: true,
        errorCode: true,
      },
      take: 5,
      orderBy: { createdAt: "desc" },
    });

    // 5. Execute extraction engine
    const engine = getIncidentExtractionEngine();
    const extracted = await engine.extractIncident({
      transcript: data.transcript,
      site,
      selectedAsset,
      knownSiteAssets,
      previousIncidents,
    });

    return apiSuccess(extracted);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

