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
  searchParams?: Promise<{ siteId?: string; view?: string }>;
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

  // 2. SUPERVISOR VIEW (or Admin requesting supervisor operations view)
  if (session.role === "SUPERVISOR" || (session.role === "ADMIN" && resolvedParams.view === "supervisor")) {
    const activeSite =
      shellData.sites.find((s) => s.id === (activeSiteFilter || session.siteId)) || shellData.sites[0];

    const currentSiteId = activeSite?.id || session.siteId || undefined;
    const scopedWhereIncident: Prisma.IncidentWhereInput = {
      site: { organizationId: session.organizationId },
      ...(currentSiteId ? { siteId: currentSiteId } : {}),
    };
    const scopedWhereAsset: Prisma.AssetWhereInput = {
      site: { organizationId: session.organizationId },
      ...(currentSiteId ? { siteId: currentSiteId } : {}),
    };

    const [
      openCount,
      awaitingReviewCount,
      inProgressCount,
      criticalCount,
      highPriorityCount,
      totalAssets,
      operationalAssets,
      faultedAssets,
      incidentsRaw,
      recentActivitiesRaw,
      recurringAssetsRaw,
      techniciansRaw,
    ] = await Promise.all([
      // 1. Open incidents (not resolved and not closed)
      db.incident.count({
        where: { ...scopedWhereIncident, status: { notIn: ["RESOLVED", "CLOSED"] } },
      }),
      // 2. Awaiting review (SUBMITTED)
      db.incident.count({
        where: { ...scopedWhereIncident, status: "SUBMITTED" },
      }),
      // 3. In Progress
      db.incident.count({
        where: { ...scopedWhereIncident, status: "IN_PROGRESS" },
      }),
      // 4. Critical alarms
      db.incident.count({
        where: {
          ...scopedWhereIncident,
          priority: "CRITICAL",
          status: { notIn: ["RESOLVED", "CLOSED"] },
        },
      }),
      // 5. High & Critical priority
      db.incident.count({
        where: {
          ...scopedWhereIncident,
          priority: { in: ["CRITICAL", "HIGH"] },
          status: { notIn: ["RESOLVED", "CLOSED"] },
        },
      }),
      // 6. Total assets
      db.asset.count({ where: scopedWhereAsset }),
      // 7. Operational assets
      db.asset.count({ where: { ...scopedWhereAsset, status: "OPERATIONAL" } }),
      // 8. Faulted / degraded / maintenance assets
      db.asset.count({
        where: { ...scopedWhereAsset, status: { in: ["FAULTED", "DEGRADED", "MAINTENANCE"] } },
      }),
      // 9. All incidents for site
      db.incident.findMany({
        where: scopedWhereIncident,
        include: {
          site: { select: { id: true, name: true, code: true } },
          asset: {
            select: {
              id: true,
              assetTag: true,
              name: true,
              assetType: true,
              block: true,
              row: true,
              status: true,
            },
          },
          reportedBy: { select: { id: true, name: true, role: true, phone: true } },
          assignedTo: { select: { id: true, name: true, role: true, phone: true } },
          events: {
            include: { user: { select: { id: true, name: true, role: true } } },
            orderBy: { createdAt: "desc" },
          },
          clarifications: {
            include: {
              requestedBy: { select: { name: true } },
              respondedBy: { select: { name: true } },
            },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      // 10. Recent activity stream across site incidents
      db.incidentEvent.findMany({
        where: { incident: scopedWhereIncident },
        include: {
          incident: {
            select: {
              id: true,
              ticketNumber: true,
              title: true,
              priority: true,
              status: true,
            },
          },
          user: { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      // 11. Recurring asset reports from database
      db.asset.findMany({
        where: { ...scopedWhereAsset, incidents: { some: {} } },
        select: {
          id: true,
          assetTag: true,
          name: true,
          assetType: true,
          block: true,
          row: true,
          status: true,
          _count: { select: { incidents: true } },
          incidents: {
            select: {
              id: true,
              ticketNumber: true,
              status: true,
              priority: true,
              title: true,
              createdAt: true,
              isRepeatFault: true,
            },
            orderBy: { createdAt: "desc" },
            take: 3,
          },
        },
        orderBy: { incidents: { _count: "desc" } },
        take: 12,
      }),
      // 12. Real on-site technician roster with active workload
      db.user.findMany({
        where: {
          organizationId: session.organizationId,
          role: "TECHNICIAN",
          isActive: true,
          ...(currentSiteId ? { siteId: currentSiteId } : {}),
        },
        select: {
          id: true,
          name: true,
          phone: true,
          role: true,
          site: { select: { name: true, code: true } },
          assignedIncidents: {
            where: { status: { in: ["SUBMITTED", "ACKNOWLEDGED", "IN_PROGRESS"] } },
            select: { id: true, ticketNumber: true, priority: true, status: true },
          },
        },
        orderBy: { name: "asc" },
      }),
    ]);

    // Fallback: If no technician is bound strictly to this site, include all organization technicians
    let techniciansList = techniciansRaw;
    if (techniciansList.length === 0) {
      techniciansList = await db.user.findMany({
        where: {
          organizationId: session.organizationId,
          role: "TECHNICIAN",
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          phone: true,
          role: true,
          site: { select: { name: true, code: true } },
          assignedIncidents: {
            where: { status: { in: ["SUBMITTED", "ACKNOWLEDGED", "IN_PROGRESS"] } },
            select: { id: true, ticketNumber: true, priority: true, status: true },
          },
        },
        orderBy: { name: "asc" },
      });
    }

    const recurringAssets = recurringAssetsRaw.map((a) => ({
      id: a.id,
      assetTag: a.assetTag,
      name: a.name,
      assetType: a.assetType,
      block: a.block,
      row: a.row,
      status: a.status,
      incidentCount: a._count.incidents,
      hasRepeatFaultFlag: a.incidents.some((i) => i.isRepeatFault),
      latestIncident: a.incidents[0]
        ? {
            id: a.incidents[0].id,
            ticketNumber: a.incidents[0].ticketNumber,
            status: a.incidents[0].status,
            priority: a.incidents[0].priority,
            title: a.incidents[0].title,
            createdAt: a.incidents[0].createdAt.toISOString(),
          }
        : null,
    }));

    return (
      <AppShell
        session={shellData.session}
        sites={shellData.sites}
        openTicketsCount={shellData.openTicketsCount}
        criticalTicketsCount={shellData.criticalTicketsCount}
      >
        <SupervisorDashboard
          supervisorName={session.name}
          supervisorRole={session.role}
          supervisorUserId={session.userId}
          siteName={activeSite?.name || "Bhadla Solar Operations"}
          siteCode={activeSite?.code || "SUN-BHA-04"}
          siteId={activeSite?.id}
          capacityMw={activeSite?.capacityMw ? Number(activeSite.capacityMw) : 50}
          openCount={openCount}
          awaitingReviewCount={awaitingReviewCount}
          inProgressCount={inProgressCount}
          criticalCount={criticalCount}
          highPriorityCount={highPriorityCount}
          totalAssetsCount={totalAssets}
          operationalAssetsCount={operationalAssets}
          faultedAssetsCount={faultedAssets}
          incidents={JSON.parse(JSON.stringify(incidentsRaw))}
          recentActivities={JSON.parse(JSON.stringify(recentActivitiesRaw))}
          recurringAssets={recurringAssets}
          technicians={JSON.parse(JSON.stringify(techniciansList))}
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
