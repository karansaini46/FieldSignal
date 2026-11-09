import React from "react";
import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/session";
import { getShellContext } from "@/lib/shell-context";
import { AppShell } from "@/components/shell/app-shell";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Layers, MapPin, Clock, User, ShieldAlert, ArrowRight, Radio } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface IncidentsPageProps {
  searchParams?: Promise<{ siteId?: string }>;
}

export default async function IncidentsPage({ searchParams }: IncidentsPageProps) {
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

  const where: Prisma.IncidentWhereInput = {
    site: {
      organizationId: session.organizationId,
    },
  };

  // Site scoping
  if (activeSiteFilter && activeSiteFilter !== "all") {
    where.siteId = activeSiteFilter;
  } else if (session.role === "TECHNICIAN" && session.siteId) {
    where.siteId = session.siteId;
  } else if (session.role === "SUPERVISOR" && session.siteId) {
    where.siteId = session.siteId;
  }

  const incidents = await db.incident.findMany({
    where,
    include: {
      site: { select: { name: true, code: true } },
      asset: { select: { assetTag: true, name: true, block: true } },
      reportedBy: { select: { name: true, role: true } },
      assignedTo: { select: { name: true, role: true } },
      events: {
        take: 1,
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const priorityStyles: Record<string, string> = {
    CRITICAL: "bg-rose-50 text-rose-800 border-rose-200",
    HIGH: "bg-amber-50 text-amber-800 border-amber-200",
    MEDIUM: "bg-blue-50 text-blue-800 border-blue-200",
    LOW: "bg-neutral-100 text-neutral-700 border-neutral-200",
  };

  const statusStyles: Record<string, string> = {
    DRAFT: "bg-neutral-100 text-neutral-700 border-neutral-200",
    OPEN: "bg-neutral-100 text-neutral-800 border-neutral-300",
    ASSIGNED: "bg-amber-50 text-amber-800 border-amber-200",
    IN_PROGRESS: "bg-blue-50 text-blue-800 border-blue-200",
    RESOLVED: "bg-emerald-50 text-emerald-800 border-emerald-200",
    CLOSED: "bg-neutral-50 text-neutral-600 border-neutral-200",
    REJECTED: "bg-rose-50 text-rose-700 border-rose-200",
  };

  return (
    <AppShell
      session={shellData.session}
      sites={shellData.sites}
      openTicketsCount={shellData.openTicketsCount}
      criticalTicketsCount={shellData.criticalTicketsCount}
    >
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header & Site Context */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span className="text-xs font-mono font-semibold text-neutral-500 uppercase tracking-wider">
                Maintenance Intelligence
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 mt-0.5">
              Site Incident Log
            </h1>
            <p className="text-xs text-neutral-500 font-mono mt-0.5">
              Active Scope:{" "}
              <span className="text-neutral-900 font-semibold">
                {shellData.session.siteName || "All Sites (Portfolio)"}
              </span>{" "}
              • Total: <span className="text-neutral-900 font-bold">{incidents.length} Tickets</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/field"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-2xs"
            >
              <Radio className="h-3.5 w-3.5" />
              <span>Voice Report (PTT)</span>
            </Link>
          </div>
        </div>

        {/* Incidents List */}
        <div className="space-y-3">
          {incidents.length === 0 ? (
            <div className="rounded-lg border border-neutral-200 bg-white p-12 text-center text-xs text-neutral-500">
              No incidents found matching your authorized scope.
            </div>
          ) : (
            incidents.map((incident) => (
              <div
                key={incident.id}
                className="rounded-lg border border-neutral-200 bg-white p-4 space-y-3 shadow-2xs hover:border-neutral-300 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-neutral-900">
                      {incident.ticketNumber}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border",
                        priorityStyles[incident.priority] || priorityStyles.MEDIUM
                      )}
                    >
                      {incident.priority}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded border",
                        statusStyles[incident.status] || "bg-neutral-100 text-neutral-700"
                      )}
                    >
                      {incident.status}
                    </span>
                    <span className="text-[11px] text-neutral-500 flex items-center gap-1 font-mono">
                      <MapPin className="h-3 w-3 text-neutral-400" />
                      <span>{incident.site.name}</span>
                    </span>
                  </div>

                  <span className="text-[11px] text-neutral-500 font-mono flex items-center gap-1">
                    <Clock className="h-3 w-3 text-neutral-400" />
                    <span>{new Date(incident.createdAt).toLocaleDateString()}</span>
                  </span>
                </div>

                <div>
                  <h2 className="text-sm font-bold text-neutral-900">{incident.title}</h2>
                  <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
                    {incident.description}
                  </p>
                </div>

                {incident.originalTranscript && (
                  <div className="rounded border border-neutral-200 bg-neutral-50 p-2.5 text-[11px] font-mono text-neutral-700">
                    <span className="font-semibold text-neutral-900 font-sans block mb-0.5">
                      Immutable Voice Transcript:
                    </span>
                    &ldquo;{incident.originalTranscript}&rdquo;
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between pt-2 border-t border-neutral-100 gap-2 text-xs font-mono text-neutral-500">
                  <div className="flex items-center gap-4">
                    {incident.asset && (
                      <span className="flex items-center gap-1 text-neutral-700">
                        <Layers className="h-3.5 w-3.5 text-neutral-400" />
                        <span>
                          {incident.asset.assetTag}{" "}
                          {incident.asset.block ? `(${incident.asset.block})` : ""}
                        </span>
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-neutral-400" />
                      <span>Reported by: {incident.reportedBy.name}</span>
                    </span>
                  </div>

                  {incident.assignedTo ? (
                    <span className="font-medium text-neutral-900">
                      Assigned: {incident.assignedTo.name} ({incident.assignedTo.role})
                    </span>
                  ) : (
                    <span className="text-amber-700 font-semibold flex items-center gap-1">
                      <ShieldAlert className="h-3 w-3" />
                      <span>Unassigned</span>
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
