import React from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSessionFromCookies } from "@/lib/session";
import { getShellContext } from "@/lib/shell-context";
import { AppShell } from "@/components/shell/app-shell";
import { db } from "@/lib/db";
import { assertOrgAccess, assertSiteAccess } from "@/lib/auth-guard";
import {
  INCIDENT_STATUS_META,
  INCIDENT_PRIORITY_META,
  FAULT_CATEGORY_LABELS,
} from "@/modules/incidents/types";
import { IncidentStatusActions } from "@/modules/incidents/components/incident-status-actions";
import { IncidentTimeline } from "@/modules/incidents/components/incident-timeline";
import {
  ChevronLeft,
  MapPin,
  Cpu,
  Clock,
  User,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Activity,
  Layers,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface IncidentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function IncidentDetailPage({ params }: IncidentDetailPageProps) {
  const session = await getSessionFromCookies();

  if (!session) {
    redirect("/login");
  }

  const { id } = await params;

  const incident = await db.incident.findUnique({
    where: { id },
    include: {
      site: { select: { id: true, name: true, code: true, organizationId: true, location: true } },
      asset: {
        select: {
          id: true,
          assetTag: true,
          name: true,
          assetType: true,
          status: true,
          block: true,
          row: true,
          manufacturer: true,
          model: true,
          ratedCapacityKw: true,
        },
      },
      reportedBy: { select: { id: true, name: true, phone: true, role: true } },
      assignedTo: { select: { id: true, name: true, phone: true, role: true } },
      events: {
        include: { user: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: "desc" },
      },
      clarifications: {
        include: {
          requestedBy: { select: { id: true, name: true, role: true } },
          respondedBy: { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      audioRecording: true,
    },
  });

  if (!incident) {
    notFound();
  }

  // Multi-tenant & Site security isolation
  try {
    assertOrgAccess(incident.site.organizationId, session);
    assertSiteAccess(incident.siteId, session);
  } catch {
    notFound();
  }

  const shellData = await getShellContext(session, incident.siteId);

  if (!shellData) {
    redirect("/login");
  }

  // Available technicians at this site for assignment
  const technicians = await db.user.findMany({
    where: {
      organizationId: session.organizationId,
      isActive: true,
      OR: [{ siteId: incident.siteId }, { siteId: null }],
    },
    select: {
      id: true,
      name: true,
      role: true,
    },
    orderBy: { name: "asc" },
  });

  const statusMeta =
    INCIDENT_STATUS_META[incident.status] || INCIDENT_STATUS_META.SUBMITTED;
  const priorityMeta =
    INCIDENT_PRIORITY_META[incident.priority] || INCIDENT_PRIORITY_META.MEDIUM;

  return (
    <AppShell
      session={shellData.session}
      sites={shellData.sites}
      openTicketsCount={shellData.openTicketsCount}
      criticalTicketsCount={shellData.criticalTicketsCount}
    >
      <div className="max-w-5xl mx-auto space-y-6">
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
          <span className="text-neutral-900 font-bold">{incident.ticketNumber}</span>
        </div>

        {/* Hero Ticket Header */}
        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-lg sm:text-xl font-bold text-neutral-900">
                  {incident.ticketNumber}
                </span>
                <span
                  className={cn(
                    "px-2 py-0.5 rounded text-xs font-mono font-bold border flex items-center gap-1.5",
                    priorityMeta.badge
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", priorityMeta.dot)} />
                  {incident.priority}
                </span>
                <span
                  className={cn(
                    "px-2 py-0.5 rounded text-xs font-mono font-bold border flex items-center gap-1.5",
                    statusMeta.badge
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", statusMeta.dot)} />
                  {statusMeta.label}
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200">
                  {FAULT_CATEGORY_LABELS[incident.faultCategory] || incident.faultCategory}
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-bold text-neutral-900">{incident.title}</h1>
              <p className="text-xs font-mono text-neutral-500 flex items-center gap-1.5 pt-1">
                <MapPin className="h-3.5 w-3.5 text-neutral-400" />
                <span>
                  {incident.site.name} ({incident.site.code}) •{" "}
                  {incident.asset ? `${incident.asset.assetTag} (${incident.asset.block})` : "Site-Wide"}
                </span>
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/field"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold shadow-2xs transition-colors"
              >
                <Radio className="h-3.5 w-3.5" />
                <span>Voice Follow-up</span>
              </Link>
            </div>
          </div>

          {/* Repeat Fault Warning Banner if applicable */}
          {(incident.isRepeatFault || incident.repeatCount30d > 0) && (
            <div className="p-3 rounded-md border border-amber-200 bg-amber-50/80 flex items-start gap-2.5 text-xs text-amber-900">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Repeat Fault Warning: </span>
                <span>
                  This equipment has logged {incident.repeatCount30d} previous failure
                  {incident.repeatCount30d === 1 ? "" : "s"} within the last 30 days. Investigate for recurrent thermal or insulation degradation.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Feature 5: Status Management & Transition Controls */}
        <IncidentStatusActions
          incidentId={incident.id}
          currentStatus={incident.status}
          currentPriority={incident.priority}
          assignedToUserId={incident.assignedToUserId}
          userRole={session.role}
          technicians={technicians}
        />

        {/* Two-Column Grid: Details & Attributions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Technician & Supervisor Attribution */}
          <div className="rounded-lg border border-neutral-200 bg-white p-4 space-y-3 shadow-2xs">
            <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
              <User className="h-4 w-4 text-blue-600" />
              <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-800">
                Personnel & Attribution
              </h2>
            </div>

            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-neutral-50">
                <span className="text-neutral-500">Reported By</span>
                <span className="font-semibold text-neutral-900">
                  {incident.reportedBy.name} ({incident.reportedBy.role})
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-neutral-50">
                <span className="text-neutral-500">Assigned Technician</span>
                <span className="font-semibold text-neutral-900">
                  {incident.assignedTo ? (
                    `${incident.assignedTo.name} (${incident.assignedTo.role})`
                  ) : (
                    <span className="text-neutral-400 italic font-normal">Unassigned</span>
                  )}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-neutral-50">
                <span className="text-neutral-500">Confirmed & Submitted</span>
                <span className="text-neutral-900">
                  {incident.confirmedAt ? new Date(incident.confirmedAt).toLocaleString() : "Pending"}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-neutral-50">
                <span className="text-neutral-500">Work Resolved</span>
                <span className="text-neutral-900">
                  {incident.resolvedAt ? new Date(incident.resolvedAt).toLocaleString() : "Incomplete"}
                </span>
              </div>

              <div className="flex justify-between py-1">
                <span className="text-neutral-500">Supervisor Verified & Closed</span>
                <span className="text-neutral-900">
                  {incident.closedAt ? new Date(incident.closedAt).toLocaleString() : "Open"}
                </span>
              </div>

              {incident.resolutionNotes && (
                <div className="pt-2 border-t border-neutral-100">
                  <span className="text-[10px] text-neutral-400 uppercase tracking-wider block mb-1">
                    Resolution Documentation
                  </span>
                  <div className="bg-emerald-50 p-2 rounded border border-emerald-200 text-[11px] text-emerald-950 leading-relaxed">
                    {incident.resolutionNotes}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Affected Equipment Context */}
          <div className="rounded-lg border border-neutral-200 bg-white p-4 space-y-3 shadow-2xs">
            <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
              <Cpu className="h-4 w-4 text-blue-600" />
              <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-800">
                Equipment Context
              </h2>
            </div>

            {incident.asset ? (
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between py-1 border-b border-neutral-50">
                  <span className="text-neutral-500">Asset Code (Tag)</span>
                  <Link
                    href={`/assets/${incident.asset.id}`}
                    className="font-bold text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <span>{incident.asset.assetTag}</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>

                <div className="flex justify-between py-1 border-b border-neutral-50">
                  <span className="text-neutral-500">Equipment Name</span>
                  <span className="text-neutral-900 truncate max-w-[200px]">
                    {incident.asset.name}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-neutral-50">
                  <span className="text-neutral-500">Equipment Type</span>
                  <span className="text-neutral-900 font-semibold">{incident.asset.assetType}</span>
                </div>

                <div className="flex justify-between py-1 border-b border-neutral-50">
                  <span className="text-neutral-500">Location</span>
                  <span className="text-neutral-900">
                    {incident.asset.block}
                    {incident.asset.row ? ` • ${incident.asset.row}` : ""}
                  </span>
                </div>

                <div className="flex justify-between py-1">
                  <span className="text-neutral-500">Manufacturer & Rating</span>
                  <span className="text-neutral-900">
                    {incident.asset.manufacturer || "OEM"}{" "}
                    {incident.asset.ratedCapacityKw ? `(${incident.asset.ratedCapacityKw} kW)` : ""}
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-neutral-400 font-mono">
                This ticket is scoped as a Site-Wide maintenance action with no single component assigned.
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Observation & Technical Symptoms */}
        <div className="rounded-lg border border-neutral-200 bg-white p-5 space-y-3 shadow-2xs">
          <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
            <FileText className="h-4 w-4 text-blue-600" />
            <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-800">
              Observation & Symptoms
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-[11px] font-mono text-neutral-400 block mb-0.5">Description</span>
              <p className="text-neutral-800 leading-relaxed">{incident.description}</p>
            </div>

            {(incident.symptoms || incident.errorCode) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-neutral-100 font-mono text-[11px]">
                {incident.symptoms && (
                  <div>
                    <span className="text-neutral-400 block mb-0.5">Reported Symptoms</span>
                    <span className="text-neutral-800 font-semibold">{incident.symptoms}</span>
                  </div>
                )}
                {incident.errorCode && (
                  <div>
                    <span className="text-neutral-400 block mb-0.5">OEM Alarm / Error Code</span>
                    <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                      {incident.errorCode}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Original Audio / Voice Transcript if present */}
            {incident.originalTranscript && (
              <div className="pt-2 border-t border-neutral-100">
                <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider block mb-1">
                  Original Voice Transcript (Immutable ASR Snapshot)
                </span>
                <div className="bg-neutral-50 p-3 rounded border border-neutral-200 font-mono text-[11px] text-neutral-700 leading-relaxed italic">
                  &ldquo;{incident.originalTranscript}&rdquo;
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Feature 8 & 9: Incident Timeline & Audit Trail */}
        <div className="rounded-lg border border-neutral-200 bg-white p-5 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-neutral-900">
                Incident Timeline & Immutable Audit Trail
              </h2>
            </div>
            <span className="text-xs font-mono text-neutral-500">
              {incident.events.length} audit events logged
            </span>
          </div>

          <IncidentTimeline events={incident.events} />
        </div>
      </div>
    </AppShell>
  );
}

