import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, assertSiteAccess } from "@/lib/auth-guard";
import { hasPermission } from "@/modules/auth/permissions";
import { handleApiError, NotFoundError, ForbiddenError, ValidationError } from "@/lib/errors";
import { apiSuccess, apiPaginated, apiCreated } from "@/lib/api-response";
import { AssetType, AssetStatus, Prisma } from "@prisma/client";
import {
  assetInputSchema,
  validateAssetCodeFormat,
  checkAssetCodeUniqueness,
} from "@/modules/assets/validation";

/**
 * GET /api/v1/assets
 * Lists and searches assets scoped to user's Organization and Site.
 * Supports filtering by siteId, assetType, status, and search query.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const { searchParams } = new URL(req.url);

    const targetSiteId = searchParams.get("siteId");
    const assetType = searchParams.get("assetType") as AssetType | null;
    const status = searchParams.get("status") as AssetStatus | null;
    const search = searchParams.get("q") || searchParams.get("search");
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip = (page - 1) * limit;

    if (targetSiteId && targetSiteId !== "all") {
      assertSiteAccess(targetSiteId, session);
    }

    const where: Prisma.AssetWhereInput = {
      site: {
        organizationId: session.organizationId,
      },
    };

    if (targetSiteId && targetSiteId !== "all") {
      where.siteId = targetSiteId;
    } else if (session.role === "TECHNICIAN" && session.siteId) {
      where.siteId = session.siteId;
    } else if (session.role === "SUPERVISOR" && session.siteId) {
      where.siteId = session.siteId;
    }

    if (assetType && Object.values(AssetType).includes(assetType)) {
      where.assetType = assetType;
    }

    if (status && Object.values(AssetStatus).includes(status)) {
      where.status = status;
    }

    if (search && search.trim().length > 0) {
      const q = search.trim();
      where.OR = [
        { assetTag: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { block: { contains: q, mode: "insensitive" } },
        { manufacturer: { contains: q, mode: "insensitive" } },
        { model: { contains: q, mode: "insensitive" } },
        { serialNumber: { contains: q, mode: "insensitive" } },
      ];
    }

    const [assets, totalCount] = await Promise.all([
      db.asset.findMany({
        where,
        include: {
          site: { select: { id: true, name: true, code: true } },
          parentAsset: { select: { id: true, assetTag: true, name: true } },
          _count: { select: { incidents: true } },
        },
        orderBy: [{ siteId: "asc" }, { block: "asc" }, { assetTag: "asc" }],
        skip,
        take: limit,
      }),
      db.asset.count({ where }),
    ]);

    return apiPaginated(assets, page, limit, totalCount);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/v1/assets
 * Creates a new solar asset in the registry.
 * Authorized for ADMIN and SUPERVISOR.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);

    if (!hasPermission(session.role, "MANAGE_ASSETS")) {
      throw new ForbiddenError("You are not authorized to create solar assets.");
    }

    const body = await req.json();
    const data = assetInputSchema.parse(body);

    // Enforce site-level access
    assertSiteAccess(data.siteId, session);

    // Verify site belongs to user's organization
    const site = await db.site.findFirst({
      where: {
        id: data.siteId,
        organizationId: session.organizationId,
      },
      select: { id: true, name: true },
    });

    if (!site) {
      throw new NotFoundError("Selected site not found or does not belong to your organization.");
    }

    // Validate asset code format
    const formatCheck = validateAssetCodeFormat(data.assetTag);
    if (!formatCheck.isValid) {
      throw new ValidationError(formatCheck.error || "Invalid asset code format.");
    }

    // Validate unique asset code within the site
    const uniqueness = await checkAssetCodeUniqueness(data.siteId, data.assetTag);
    if (!uniqueness.isUnique) {
      throw new ValidationError(
        `Asset code "${data.assetTag}" is already in use at ${site.name}. Asset codes must be unique within a site.`
      );
    }

    // If parentAssetId specified, verify parent belongs to the same site
    if (data.parentAssetId) {
      const parent = await db.asset.findFirst({
        where: { id: data.parentAssetId, siteId: data.siteId },
        select: { id: true },
      });
      if (!parent) {
        throw new ValidationError("Parent equipment must belong to the same site.");
      }
    }

    const createdAsset = await db.asset.create({
      data: {
        siteId: data.siteId,
        parentAssetId: data.parentAssetId,
        assetTag: data.assetTag,
        name: data.name,
        assetType: data.assetType,
        status: data.status,
        block: data.block,
        row: data.row || null,
        manufacturer: data.manufacturer || null,
        model: data.model || null,
        serialNumber: data.serialNumber || null,
        ratedCapacityKw: data.ratedCapacityKw ?? null,
        commissionDate: data.commissionDate || null,
      },
      include: {
        site: { select: { id: true, name: true, code: true } },
        parentAsset: { select: { id: true, assetTag: true, name: true } },
      },
    });

    return apiCreated(createdAsset);
  } catch (error) {
    return handleApiError(error);
  }
}

