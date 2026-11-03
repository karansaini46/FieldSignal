import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-guard";
import { ROLE_PERMISSIONS } from "@/modules/auth/permissions";
import { handleApiError, NotFoundError } from "@/lib/errors";
import { apiSuccess } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);

    const user = await db.user.findUnique({
      where: { id: session.userId },
      include: {
        organization: true,
        site: true,
      },
    });

    if (!user || !user.isActive) {
      throw new NotFoundError("User account not found or is inactive.");
    }

    return apiSuccess({
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        organization: {
          id: user.organization.id,
          name: user.organization.name,
          code: user.organization.code,
        },
        site: user.site
          ? {
              id: user.site.id,
              name: user.site.name,
              code: user.site.code,
              capacityMw: Number(user.site.capacityMw),
            }
          : null,
      },
      permissions: ROLE_PERMISSIONS[user.role],
    });
  } catch (error) {
    return handleApiError(error);
  }
}
