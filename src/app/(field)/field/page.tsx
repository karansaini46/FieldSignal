import React from "react";
import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/session";
import { getShellContext } from "@/lib/shell-context";
import { AppShell } from "@/components/shell/app-shell";
import { TechnicianDashboard } from "@/components/dashboard/technician-dashboard";
import { db } from "@/lib/db";

interface FieldPageProps {
  searchParams?: Promise<{ siteId?: string }>;
}

export default async function FieldPage({ searchParams }: FieldPageProps) {
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

  // Fetch technician's active assignments
  const assignedIncidents = await db.incident.findMany({
    where: {
      site: { organizationId: session.organizationId },
      ...(activeSiteFilter && activeSiteFilter !== "all"
        ? { siteId: activeSiteFilter }
        : session.siteId
        ? { siteId: session.siteId }
        : {}),
      ...(session.role === "TECHNICIAN" ? { assignedToUserId: session.userId } : {}),
      status: { in: ["ACKNOWLEDGED", "IN_PROGRESS", "SUBMITTED"] },
    },
    include: {
      asset: { select: { assetTag: true, block: true } },
      site: { select: { name: true, code: true } },
    },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
  });

  const activeSite =
    shellData.sites.find((s) => s.id === (activeSiteFilter || session.siteId)) ||
    shellData.sites[0];

  return (
    <AppShell
      session={shellData.session}
      sites={shellData.sites}
      openTicketsCount={shellData.openTicketsCount}
      criticalTicketsCount={shellData.criticalTicketsCount}
    >
      <TechnicianDashboard
        technicianName={session.name}
        siteName={activeSite?.name || "Bhadla Solar Operations"}
        siteCode={activeSite?.code || "SUN-BHA-04"}
        assignedIncidents={assignedIncidents}
      />
    </AppShell>
  );
}
