import React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionFromCookies } from "@/lib/session";
import { getShellContext } from "@/lib/shell-context";
import { AppShell } from "@/components/shell/app-shell";
import { db } from "@/lib/db";
import { IncidentCreateForm } from "@/modules/incidents/components/incident-create-form";
import { ChevronLeft } from "lucide-react";

interface NewIncidentPageProps {
  searchParams?: Promise<{
    transcript?: string;
    recordingId?: string;
    siteId?: string;
  }>;
}

export default async function NewIncidentPage({ searchParams }: NewIncidentPageProps) {
  const session = await getSessionFromCookies();

  if (!session) {
    redirect("/login");
  }

  const resolvedParams = searchParams ? await searchParams : {};
  const shellData = await getShellContext(session);

  if (!shellData) {
    redirect("/login");
  }

  // Multi-tenant site options
  const sites = await db.site.findMany({
    where: {
      organizationId: session.organizationId,
      ...(session.role === "TECHNICIAN" && session.siteId ? { id: session.siteId } : {}),
      ...(session.role === "SUPERVISOR" && session.siteId ? { id: session.siteId } : {}),
    },
    select: {
      id: true,
      name: true,
      code: true,
    },
    orderBy: { name: "asc" },
  });

  const siteIds = sites.map((s) => s.id);

  // Accessible assets for these sites
  const assets = await db.asset.findMany({
    where: {
      siteId: { in: siteIds },
    },
    select: {
      id: true,
      assetTag: true,
      name: true,
      assetType: true,
      siteId: true,
    },
    orderBy: [{ block: "asc" }, { assetTag: "asc" }],
  });

  // Accessible users for assignment
  const users = await db.user.findMany({
    where: {
      organizationId: session.organizationId,
      isActive: true,
      ...(session.siteId ? { OR: [{ siteId: session.siteId }, { siteId: null }] } : {}),
    },
    select: {
      id: true,
      name: true,
      role: true,
      siteId: true,
    },
    orderBy: { name: "asc" },
  });

  const isSiteLocked = Boolean(session.role === "TECHNICIAN" || (session.role === "SUPERVISOR" && session.siteId));
  const defaultSiteId = session.siteId || sites[0]?.id;

  return (
    <AppShell
      session={shellData.session}
      sites={shellData.sites}
      openTicketsCount={shellData.openTicketsCount}
      criticalTicketsCount={shellData.criticalTicketsCount}
    >
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-mono text-neutral-500">
          <Link
            href="/incidents"
            className="inline-flex items-center gap-1 hover:text-neutral-900 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>Incident Triage</span>
          </Link>
          <span>/</span>
          <span className="text-neutral-900 font-bold">Log New Incident</span>
        </div>

        {/* Page Header */}
        <div className="pb-4 border-b border-neutral-200">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-600" />
            <span className="text-xs font-mono font-semibold text-neutral-500 uppercase tracking-wider">
              Maintenance Work Order Dispatch
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 mt-0.5">
            Log Solar Plant Incident
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Create an official maintenance ticket. Priority suggestions are automatically calculated based on fault severity and asset capacity.
          </p>
        </div>

        {/* Creation Form */}
        <IncidentCreateForm
          sites={sites}
          defaultSiteId={defaultSiteId}
          isSiteLocked={isSiteLocked}
          assets={assets}
          users={users}
          userRole={session.role}
          cancelHref="/incidents"
          initialTranscript={resolvedParams.transcript}
          initialAudioRecordingId={resolvedParams.recordingId}
        />
      </div>
    </AppShell>
  );
}

