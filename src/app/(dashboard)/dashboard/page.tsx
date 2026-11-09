import React from "react";
import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/session";
import { getShellContext } from "@/lib/shell-context";
import { AppShell } from "@/components/shell/app-shell";
import { TechnicianDashboard } from "@/components/dashboard/technician-dashboard";
import { SupervisorDashboard } from "@/components/dashboard/supervisor-dashboard";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

interface DashboardPageProps {
  searchParams?: Promise<{ siteId?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await getSessionFromCookies();

  if (!session) {
    redirect("/login");
  }

  const resolvedParams = searchParams ? await searchParams : {};
  const activeSiteFilter = resolvedParams.siteId;

  const shellData = await getShellContext(session, activeSiteFilter);

  if (!shellData) {
    redirect("/login");
  }

  // 1. TECHNICIAN VIEW
  if (session.role === "TECHNICIAN") {
    const assignedIncidents = await db.incident.findMany({
      where: {
        assignedToUserId: session.userId,
        status: { in: ["ACKNOWLEDGED", "IN_PROGRESS", "SUBMITTED"] },
      },
      include: {
        asset: { select: { assetTag: true, block: true } },
        site: { select: { name: true, code: true } },
      },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    });

    const activeSite = shellData.sites.find((s) => s.id === (activeSiteFilter || session.siteId)) || shellData.sites[0];

    return (
      <AppShell
        session={shellData.session}
        sites={shellData.sites}
        openTicketsCount={shellData.openTicketsCount}
        criticalTicketsCount={shellData.criticalTicketsCount}
      >
        <TechnicianDashboard
          technicianName={session.name}
          siteName={activeSite?.name || "Bhadla Solar Park"}
          siteCode={activeSite?.code || "SUN-BHA-04"}
          assignedIncidents={assignedIncidents}
        />
      </AppShell>
    );
  }

  // Common where clause for Supervisor / Admin scoped queries
  const whereIncident: Prisma.IncidentWhereInput = {
    site: { organizationId: session.organizationId },
  };

  const whereAsset: Prisma.AssetWhereInput = {
    site: { organizationId: session.organizationId },
  };

  if (activeSiteFilter && activeSiteFilter !== "all") {
    whereIncident.siteId = activeSiteFilter;
    whereAsset.siteId = activeSiteFilter;
  } else if (session.role === "SUPERVISOR" && session.siteId) {
    whereIncident.siteId = session.siteId;
    whereAsset.siteId = session.siteId;
  }

  // 2. SUPERVISOR VIEW
  if (session.role === "SUPERVISOR") {
    const [openCount, inProgressCount, criticalCount, totalAssets, faultedAssets, recentIncidents] =
      await Promise.all([
        db.incident.count({ where: { ...whereIncident, status: "SUBMITTED" } }),
        db.incident.count({ where: { ...whereIncident, status: "IN_PROGRESS" } }),
        db.incident.count({ where: { ...whereIncident, priority: "CRITICAL" } }),
        db.asset.count({ where: whereAsset }),
        db.asset.count({
          where: { ...whereAsset, status: { in: ["FAULTED", "DEGRADED"] } },
        }),
        db.incident.findMany({
          where: whereIncident,
          include: {
            site: { select: { name: true, code: true } },
            asset: { select: { assetTag: true, name: true } },
            reportedBy: { select: { name: true, role: true } },
            assignedTo: { select: { name: true, role: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 6,
        }),
      ]);

    const activeSite = shellData.sites.find((s) => s.id === (activeSiteFilter || session.siteId)) || shellData.sites[0];

    return (
      <AppShell
        session={shellData.session}
        sites={shellData.sites}
        openTicketsCount={shellData.openTicketsCount}
        criticalTicketsCount={shellData.criticalTicketsCount}
      >
        <SupervisorDashboard
          supervisorName={session.name}
          siteName={activeSite?.name || "Bhadla Solar Operations"}
          siteCode={activeSite?.code || "SUN-BHA-04"}
          capacityMw={activeSite?.capacityMw || 50}
          openCount={openCount}
          inProgressCount={inProgressCount}
          criticalCount={criticalCount}
          totalAssetsCount={totalAssets}
          faultedAssetsCount={faultedAssets}
          recentIncidents={recentIncidents}
        />
      </AppShell>
    );
  }

  // 3. ADMIN VIEW
  const [sitesWithStats, allUsers, totalIncidents, totalAssets] = await Promise.all([
    db.site.findMany({
      where: { organizationId: session.organizationId },
      include: {
        _count: {
          select: {
            assets: true,
            incidents: {
              where: { status: { notIn: ["RESOLVED", "CLOSED"] } },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({
      where: { organizationId: session.organizationId },
      include: { site: { select: { name: true } } },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
    db.incident.count({ where: { site: { organizationId: session.organizationId } } }),
    db.asset.count({ where: { site: { organizationId: session.organizationId } } }),
  ]);

  const formattedSites = sitesWithStats.map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    capacityMw: Number(s.capacityMw),
    location: s.location,
    status: s.status,
    assetsCount: s._count.assets,
    openIncidentsCount: s._count.incidents,
  }));

  const formattedUsers = allUsers.map((u) => ({
    id: u.id,
    name: u.name,
    phone: u.phone,
    email: u.email,
    role: u.role,
    siteName: u.site?.name ?? null,
    isActive: u.isActive,
  }));

  return (
    <AppShell
      session={shellData.session}
      sites={shellData.sites}
      openTicketsCount={shellData.openTicketsCount}
      criticalTicketsCount={shellData.criticalTicketsCount}
    >
      <AdminDashboard
        adminName={session.name}
        organizationName={shellData.session.organizationName || "Sunrise Solar Operations"}
        sites={formattedSites}
        users={formattedUsers}
        totalIncidents={totalIncidents}
        totalAssets={totalAssets}
      />
    </AppShell>
  );
}
