import { NextRequest } from "next/server";
import { UserRole } from "@prisma/client";
import { AuthSession, SUPERVISOR_ONLY_FIELDS } from "@/modules/auth/permissions";
import { verifySessionToken, SESSION_COOKIE_NAME, getSessionFromCookies } from "@/lib/session";
import { UnauthorizedError, ForbiddenError, NotFoundError } from "@/lib/errors";

/**
 * Extracts and verifies the current AuthSession from an incoming request.
 * Supports both HttpOnly cookies (browser) and Authorization: Bearer headers (API/CLI/Tests).
 */
export async function getAuthUser(req?: Request | NextRequest): Promise<AuthSession | null> {
  // 1. Check Bearer token in Authorization header first (useful for API clients & tests)
  if (req) {
    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      const session = await verifySessionToken(token);
      if (session) return session;
    }

    // 2. Check Cookie in Request headers
    const cookieHeader = req.headers.get("cookie");
    if (cookieHeader) {
      const match = cookieHeader
        .split(";")
        .map((c) => c.trim())
        .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));

      if (match) {
        const token = match.substring(SESSION_COOKIE_NAME.length + 1);
        const session = await verifySessionToken(token);
        if (session) return session;
      }
    }
  }

  // 3. Fallback to Next.js cookies() helper (for Server Components & Route Handlers)
  try {
    return await getSessionFromCookies();
  } catch {
    return null;
  }
}

/**
 * Enforces authentication. Throws 401 Unauthorized if no valid session is present.
 */
export async function requireAuth(req?: Request | NextRequest): Promise<AuthSession> {
  const session = await getAuthUser(req);
  if (!session) {
    throw new UnauthorizedError("Authentication required. Please sign in.");
  }
  return session;
}

/**
 * Enforces role-based permissions. Throws 403 Forbidden if user role is not authorized.
 */
export function requireRole(allowedRoles: UserRole[], session: AuthSession): void {
  if (!allowedRoles.includes(session.role)) {
    throw new ForbiddenError(
      `Access denied. Required role: ${allowedRoles.join(" or ")}. Your current role is ${session.role}.`
    );
  }
}

/**
 * Enforces Organization-level multi-tenant data isolation.
 * Prevents any user from reading or mutating records belonging to another organization.
 */
export function assertOrgAccess(entityOrgId: string, session: AuthSession): void {
  if (entityOrgId !== session.organizationId) {
    // Ponytail note: Throw NotFoundError to avoid leaking the existence of other tenants' entity IDs
    throw new NotFoundError("Resource not found or does not belong to your organization.");
  }
}

/**
 * Enforces Site-level access restrictions:
 * - ADMIN: Unrestricted access to all sites within their organization.
 * - SUPERVISOR: Access to their assigned site, or all sites if unassigned (portfolio supervisor).
 * - TECHNICIAN: Strictly restricted to their assigned site. Cannot view or modify assets/incidents from other sites.
 */
export function assertSiteAccess(
  targetSiteId: string | null | undefined,
  session: AuthSession
): void {
  if (!targetSiteId) return;

  if (session.role === "ADMIN") {
    return; // Full access within organization
  }

  if (session.role === "SUPERVISOR") {
    // If supervisor is specifically scoped to a site, enforce that site
    if (session.siteId && session.siteId !== targetSiteId) {
      throw new ForbiddenError(
        `Site access restricted: You are assigned to site ${session.siteId} and cannot manage site ${targetSiteId}.`
      );
    }
    return;
  }

  if (session.role === "TECHNICIAN") {
    if (!session.siteId || session.siteId !== targetSiteId) {
      throw new ForbiddenError(
        `Site access restricted: Technicians may only access equipment and tickets for their assigned site.`
      );
    }
  }
}

/**
 * Enforces Field-Level Mutation Protection (Requirement 7):
 * Technicians are prohibited from mutating supervisor-only fields (e.g. assignedToUserId, priority, closed status).
 */
export function assertTechnicianMutationAllowed(
  mutationPayload: Record<string, unknown>,
  session: AuthSession
): void {
  if (session.role !== "TECHNICIAN") {
    return; // Supervisors and Admins may modify all fields
  }

  const modifiedKeys = Object.keys(mutationPayload);
  const attemptedForbiddenFields = modifiedKeys.filter((key) =>
    (SUPERVISOR_ONLY_FIELDS as readonly string[]).includes(key)
  );

  if (attemptedForbiddenFields.length > 0) {
    throw new ForbiddenError(
      `Technicians are not authorized to modify supervisor-only fields: ${attemptedForbiddenFields.join(", ")}.`
    );
  }

  // Prevent technician from directly setting status to CLOSED
  if ("status" in mutationPayload) {
    const targetStatus = mutationPayload.status as string;
    if (targetStatus === "CLOSED") {
      throw new ForbiddenError(
        `Technicians cannot directly close incidents. Only supervisors can verify and close incidents.`
      );
    }
  }
}

/**
 * Helper to construct Prisma WHERE clauses enforcing organization and site scoping.
 */
export function getScopedWhere(session: AuthSession, targetSiteId?: string) {
  const where: {
    site: { organizationId: string; id?: string };
  } = {
    site: {
      organizationId: session.organizationId,
    },
  };

  if (targetSiteId) {
    assertSiteAccess(targetSiteId, session);
    where.site.id = targetSiteId;
  } else if (session.role === "TECHNICIAN" && session.siteId) {
    where.site.id = session.siteId;
  } else if (session.role === "SUPERVISOR" && session.siteId) {
    where.site.id = session.siteId;
  }

  return where;
}
