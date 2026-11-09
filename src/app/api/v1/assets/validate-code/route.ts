import { NextRequest } from "next/server";
import { requireAuth, assertSiteAccess } from "@/lib/auth-guard";
import { handleApiError } from "@/lib/errors";
import { apiSuccess } from "@/lib/api-response";
import { validateAssetCodeFormat, checkAssetCodeUniqueness } from "@/modules/assets/validation";

/**
 * GET /api/v1/assets/validate-code?siteId=...&code=...&excludeId=...
 * Validates format and checks uniqueness within the selected site.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const { searchParams } = new URL(req.url);

    const siteId = searchParams.get("siteId");
    const code = searchParams.get("code");
    const excludeId = searchParams.get("excludeId") || undefined;

    if (!siteId) {
      return apiSuccess({
        isValid: false,
        error: "Site must be selected to validate asset code uniqueness",
      });
    }

    assertSiteAccess(siteId, session);

    if (!code) {
      return apiSuccess({
        isValid: false,
        error: "Asset code is required",
      });
    }

    const formatCheck = validateAssetCodeFormat(code);
    if (!formatCheck.isValid) {
      return apiSuccess({
        isValid: false,
        error: formatCheck.error,
      });
    }

    const uniqueness = await checkAssetCodeUniqueness(siteId, code, excludeId);
    if (!uniqueness.isUnique) {
      return apiSuccess({
        isValid: false,
        isUnique: false,
        error: `Asset code "${code.trim().toUpperCase()}" is already in use at this site`,
      });
    }

    return apiSuccess({
      isValid: true,
      isUnique: true,
      sanitizedCode: code.trim().toUpperCase(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

