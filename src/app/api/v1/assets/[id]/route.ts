import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, assertSiteAccess, assertOrgAccess } from "@/lib/auth-guard";
import { hasPermission } from "@/modules/auth/permissions";
import { handleApiError, NotFoundError, ForbiddenError, ValidationError } from "@/lib/errors";
import { apiSuccess } from "@/lib/api-response";
import {
  assetInputSchema,
  validateAssetCodeFormat,
  checkAssetCodeUniqueness,
} from "@/modules/assets/validation";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/assets/[id]
 * Retrieves asset details, hierarchy, and maintenance history.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth(req);
    const { id } = await params;

    const asset = await db.asset.findUnique({
      where: { id },
      include: {
        site: {
          select: { id: true, name: true, code: true, organizationId: true },
        },
        parentAsset: {
          select: { id: true, assetTag: true, name: true, assetType: true, status: true },
        },
        children: {
          select: { id: true, assetTag: true, name: true, assetType: true, status: true, block: true },
          orderBy: { assetTag: "asc" },
        },
        incidents: {
          include: {
            reportedBy: { select: { id: true, name: true, role: true } },
            assignedTo: { select: { id: true, name: true, role: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!asset) {
      throw new NotFoundError("Asset not found");
    }

    assertOrgAccess(asset.site.organizationId, session);
    assertSiteAccess(asset.siteId, session);

    return apiSuccess(asset);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/v1/assets/[id]
 * Updates asset information. Authorized for ADMIN and SUPERVISOR.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth(req);
    const { id } = await params;

    if (!hasPermission(session.role, "MANAGE_ASSETS")) {
      throw new ForbiddenError("You are not authorized to edit solar assets.");
    }

    const existingAsset = await db.asset.findUnique({
      where: { id },
      include: {
        site: { select: { id: true, name: true, organizationId: true } },
      },
    });

    if (!existingAsset) {
      throw new NotFoundError("Asset not found");
    }

    assertOrgAccess(existingAsset.site.organizationId, session);
    assertSiteAccess(existingAsset.siteId, session);

    const body = await req.json();
    const data = assetInputSchema.partial().parse(body);

    const targetSiteId = data.siteId ?? existingAsset.siteId;

    // If site is changing, verify permissions and new site access
    if (data.siteId && data.siteId !== existingAsset.siteId) {
      assertSiteAccess(data.siteId, session);
      const newSite = await db.site.findFirst({
        where: { id: data.siteId, organizationId: session.organizationId },
        select: { id: true },
      });
      if (!newSite) {
        throw new NotFoundError("Target site not found in your organization.");
      }
    }

    // If asset code is being updated, validate format & uniqueness
    if (data.assetTag && data.assetTag !== existingAsset.assetTag) {
      const formatCheck = validateAssetCodeFormat(data.assetTag);
      if (!formatCheck.isValid) {
        throw new ValidationError(formatCheck.error || "Invalid asset code format.");
      }

      const uniqueness = await checkAssetCodeUniqueness(targetSiteId, data.assetTag, id);
      if (!uniqueness.isUnique) {
        throw new ValidationError(
          `Asset code "${data.assetTag}" is already registered at this site. Asset codes must be unique within a site.`
        );
      }
    }

    // If parentAssetId is specified and changed, verify it belongs to same site
    if (data.parentAssetId !== undefined && data.parentAssetId !== null) {
      if (data.parentAssetId === id) {
        throw new ValidationError("An asset cannot be its own parent.");
      }
      const parent = await db.asset.findFirst({
        where: { id: data.parentAssetId, siteId: targetSiteId },
        select: { id: true },
      });
      if (!parent) {
        throw new ValidationError("Parent asset does not belong to the same site.");
      }
    }

    const updatedAsset = await db.asset.update({
      where: { id },
      data: {
        ...(data.siteId ? { siteId: data.siteId } : {}),
        ...(data.assetTag ? { assetTag: data.assetTag } : {}),
        ...(data.name ? { name: data.name } : {}),
        ...(data.assetType ? { assetType: data.assetType } : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(data.block ? { block: data.block } : {}),
        ...(data.row !== undefined ? { row: data.row } : {}),
        ...(data.parentAssetId !== undefined ? { parentAssetId: data.parentAssetId } : {}),
        ...(data.manufacturer !== undefined ? { manufacturer: data.manufacturer } : {}),
        ...(data.model !== undefined ? { model: data.model } : {}),
        ...(data.serialNumber !== undefined ? { serialNumber: data.serialNumber } : {}),
        ...(data.ratedCapacityKw !== undefined ? { ratedCapacityKw: data.ratedCapacityKw } : {}),
        ...(data.commissionDate !== undefined ? { commissionDate: data.commissionDate } : {}),
      },
      include: {
        site: { select: { id: true, name: true, code: true } },
        parentAsset: { select: { id: true, assetTag: true, name: true } },
      },
    });

    return apiSuccess(updatedAsset);
  } catch (error) {
    return handleApiError(error);
  }
}

