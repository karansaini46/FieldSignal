import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-guard";
import { handleApiError } from "@/lib/errors";
import { apiSuccess } from "@/lib/api-response";
import { FaultCategory, AssetType } from "@prisma/client";
import { suggestIncidentPriority } from "@/modules/incidents/priority-suggester";
import { db } from "@/lib/db";

const suggestSchema = z.object({
  faultCategory: z.nativeEnum(FaultCategory),
  assetId: z.string().uuid().optional().nullable(),
  assetType: z.nativeEnum(AssetType).optional().nullable(),
  title: z.string().optional(),
  symptoms: z.string().optional().nullable(),
  errorCode: z.string().optional().nullable(),
});

/**
 * POST /api/v1/incidents/suggest-priority
 * Returns intelligent priority recommendation based on equipment type, fault category, and 30-day recurrence.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);
    const body = await req.json();
    const data = suggestSchema.parse(body);

    let repeatCount30d = 0;
    let resolvedAssetType = data.assetType;

    if (data.assetId) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const [count, asset] = await Promise.all([
        db.incident.count({
          where: {
            assetId: data.assetId,
            createdAt: { gte: thirtyDaysAgo },
          },
        }),
        db.asset.findUnique({
          where: { id: data.assetId },
          select: { assetType: true },
        }),
      ]);
      repeatCount30d = count;
      if (asset) {
        resolvedAssetType = asset.assetType;
      }
    }

    const suggestion = suggestIncidentPriority({
      faultCategory: data.faultCategory,
      assetType: resolvedAssetType,
      repeatCount30d,
      title: data.title,
      symptoms: data.symptoms,
      errorCode: data.errorCode,
    });

    return apiSuccess({
      ...suggestion,
      repeatCount30d,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

