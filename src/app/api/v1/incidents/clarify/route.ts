import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth, assertSiteAccess } from "@/lib/auth-guard";
import { handleApiError, NotFoundError, BadRequestError } from "@/lib/errors";
import { apiSuccess } from "@/lib/api-response";
import { db } from "@/lib/db";
import {
  getIncidentClarificationService,
  MissingFieldKey,
  ClarificationItem,
} from "@/modules/incidents";
import { MatchedAssetCandidate } from "@/modules/assets/asset-matcher";

const clarifyRequestSchema = z.object({
  siteId: z.string().uuid("Invalid site ID"),
  field: z.enum(["asset", "alarm_code", "current_status", "repair_result", "symptoms"]),
  response: z.string().min(1, "Clarification response cannot be empty"),
  fromVoice: z.boolean().optional().default(false),
  currentExtraction: z.any(),
  history: z
    .array(
      z.object({
        field: z.string(),
        question: z.string(),
        response: z.string().optional().nullable(),
        status: z.enum(["PENDING", "RESOLVED", "DISMISSED"]),
        createdAt: z.union([z.string(), z.date()]),
        respondedAt: z.union([z.string(), z.date()]).optional().nullable(),
        fromVoice: z.boolean().optional(),
      })
    )
    .optional()
    .default([]),
});

/**
 * POST /api/v1/incidents/clarify
 * Processes an interactive clarification response during voice reporting or draft triage.
 * Updates the extraction object, validates updated fields, preserves original transcript,
 * and returns the next single focused question (if any).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const body = await req.json();
    const data = clarifyRequestSchema.parse(body);

    assertSiteAccess(data.siteId, session);

    const site = await db.site.findFirst({
      where: {
        id: data.siteId,
        organizationId: session.organizationId,
      },
      select: { id: true, name: true },
    });

    if (!site) {
      throw new NotFoundError("Solar facility site not found or access restricted.");
    }

    // Load site assets for deterministic asset matching
    const dbAssets = await db.asset.findMany({
      where: { siteId: site.id },
      select: {
        id: true,
        assetTag: true,
        name: true,
        assetType: true,
        block: true,
        row: true,
        model: true,
        siteId: true,
      },
    });

    const siteAssets: MatchedAssetCandidate[] = dbAssets.map((a) => ({
      ...a,
      siteName: site.name,
      confidence: 0,
      matchReason: "",
    }));

    const clarificationService = getIncidentClarificationService();
    const result = clarificationService.processResponse({
      field: data.field as MissingFieldKey,
      response: data.response,
      fromVoice: data.fromVoice,
      currentExtraction: data.currentExtraction,
      history: data.history as ClarificationItem[],
      siteContext: {
        id: site.id,
        name: site.name,
        siteAssets,
      },
    });

    return apiSuccess(result);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

