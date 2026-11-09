import { db } from "@/lib/db";
import { AuthSession } from "@/modules/auth/permissions";
import { ShellUserSession, SiteSummary } from "@/components/shell/types";

export interface ShellContextData {
  session: ShellUserSession;
  sites: SiteSummary[];
  openTicketsCount: number;
  criticalTicketsCount: number;
}

/**
 * Retrieves multi-tenant scoped sites, user metadata, and incident counts
 * for the FieldSignal Application Shell.
 */
export async function getShellContext(
  session: AuthSession | null,
  activeSiteFilter?: string
): Promise<ShellContextData | null> {
  if (!session) return null;

  // 1. Fetch organization details and authorized sites
  const [org, sitesRaw] = await Promise.all([
    db.organization.findUnique({
      where: { id: session.organizationId },
      select: { id: true, name: true, code: true },
    }),
    db.site.findMany({
      where: {
        organizationId: session.organizationId,
        // If technician, scope to assigned site if present
        ...(session.role === "TECHNICIAN" && session.siteId ? { id: session.siteId } : {}),
      },
      select: {
        id: true,
        name: true,
        code: true,
        capacityMw: true,
        location: true,
        status: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const sites: SiteSummary[] = sitesRaw.map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    capacityMw: Number(s.capacityMw),
    location: s.location,
    status: s.status,
  }));

  // Resolve current site name
  const currentSite = sites.find((s) => s.id === (activeSiteFilter || session.siteId));

  // 2. Multi-tenant scoped incident counts for badge indicators
  const whereIncident: {
    site: { organizationId: string };
    siteId?: string;
    assignedToUserId?: string;
  } = {
    site: { organizationId: session.organizationId },
  };

  if (activeSiteFilter && activeSiteFilter !== "all") {
    whereIncident.siteId = activeSiteFilter;
  } else if (session.role === "TECHNICIAN") {
    whereIncident.assignedToUserId = session.userId;
  } else if (session.siteId && session.role === "SUPERVISOR") {
    whereIncident.siteId = session.siteId;
  }

  const [openTicketsCount, criticalTicketsCount] = await Promise.all([
    db.incident.count({
      where: {
        ...whereIncident,
        status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS"] },
      },
    }),
    db.incident.count({
      where: {
        ...whereIncident,
        priority: "CRITICAL",
        status: { notIn: ["RESOLVED", "CLOSED", "REJECTED"] },
      },
    }),
  ]);

  const shellSession: ShellUserSession = {
    userId: session.userId,
    name: session.name,
    phone: session.phone,
    email: session.email,
    role: session.role,
    organizationId: session.organizationId,
    organizationName: org?.name || "Sunrise Solar Operations",
    siteId: activeSiteFilter || session.siteId,
    siteName: currentSite?.name || (session.role === "ADMIN" ? "Portfolio (All Sites)" : null),
  };

  return {
    session: shellSession,
    sites,
    openTicketsCount,
    criticalTicketsCount,
  };
}
