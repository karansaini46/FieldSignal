import React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionFromCookies } from "@/lib/session";
import { getShellContext } from "@/lib/shell-context";
import { AppShell } from "@/components/shell/app-shell";
import { db } from "@/lib/db";
import { Prisma, IncidentStatus, IncidentPriority, FaultCategory } from "@prisma/client";
import {
  INCIDENT_STATUS_META,
  INCIDENT_PRIORITY_META,
  FAULT_CATEGORY_LABELS,
} from "@/modules/incidents/types";
import {
  Search,
  Plus,
  Radio,
  Filter,
  X,
  ArrowRight,
  AlertTriangle,
  User,
  Clock,
  MapPin,
  Cpu,
  Layers,
  Activity,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface IncidentsPageProps {
  searchParams?: Promise<{
    siteId?: string;
    status?: string;
    priority?: string;
    category?: string;
    q?: string;
    ticket?: string;
  }>;
}

export default async function IncidentsPage({ searchParams }: IncidentsPageProps) {
  const session = await getSessionFromCookies();

  if (!session) {
    redirect("/login");
  }

  const resolvedParams = searchParams ? await searchParams : {};
  const activeSiteFilter = resolvedParams.siteId;
  const activeStatusFilter = resolvedParams.status as IncidentStatus | undefined;
  const activePriorityFilter = resolvedParams.priority as IncidentPriority | undefined;
  const activeCategoryFilter = resolvedParams.category as FaultCategory | undefined;
  const searchQuery = (resolvedParams.q || resolvedParams.ticket || "").trim();

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

  // Status filter
  if (activeStatusFilter && Object.values(IncidentStatus).includes(activeStatusFilter)) {
    where.status = activeStatusFilter;
  }

  // Priority filter
  if (activePriorityFilter && Object.values(IncidentPriority).includes(activePriorityFilter)) {
    where.priority = activePriorityFilter;
  }

  // Fault category filter
  if (activeCategoryFilter && Object.values(FaultCategory).includes(activeCategoryFilter)) {
    where.faultCategory = activeCategoryFilter;
  }

  // Search keyword filter
  if (searchQuery) {
    where.OR = [
      { ticketNumber: { contains: searchQuery, mode: "insensitive" } },
      { title: { contains: searchQuery, mode: "insensitive" } },
      { description: { contains: searchQuery, mode: "insensitive" } },
      { symptoms: { contains: searchQuery, mode: "insensitive" } },
      { errorCode: { contains: searchQuery, mode: "insensitive" } },
      { asset: { assetTag: { contains: searchQuery, mode: "insensitive" } } },
      { asset: { name: { contains: searchQuery, mode: "insensitive" } } },
      { reportedBy: { name: { contains: searchQuery, mode: "insensitive" } } },
      { assignedTo: { name: { contains: searchQuery, mode: "insensitive" } } },
    ];
  }

  const [incidents, statusCounts] = await Promise.all([
    db.incident.findMany({
      where,
      include: {
        site: { select: { name: true, code: true } },
        asset: { select: { id: true, assetTag: true, name: true, block: true } },
        reportedBy: { select: { id: true, name: true, role: true } },
        assignedTo: { select: { id: true, name: true, role: true } },
        _count: { select: { events: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.incident.groupBy({
      by: ["status"],
      where: {
        site: {
          organizationId: session.organizationId,
          ...(activeSiteFilter && activeSiteFilter !== "all"
            ? { id: activeSiteFilter }
            : session.siteId
            ? { id: session.siteId }
            : {}),
        },
      },
      _count: true,
    }),
  ]);

  const countByStatus = statusCounts.reduce(
    (acc, cur) => {
      acc[cur.status] = cur._count;
      return acc;
    },
    {} as Record<IncidentStatus, number>
  );

  const hasActiveFilters = Boolean(
    (activeSiteFilter && activeSiteFilter !== "all") ||
      activeStatusFilter ||
      activePriorityFilter ||
      activeCategoryFilter ||
      searchQuery
  );

  return (
    <AppShell
      session={shellData.session}
      sites={shellData.sites}
      openTicketsCount={shellData.openTicketsCount}
      criticalTicketsCount={shellData.criticalTicketsCount}
    >
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header & Primary Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-rose-600 animate-pulse" />
              <span className="text-xs font-mono font-semibold text-neutral-500 uppercase tracking-wider">
                Field Operations & Dispatch
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 mt-0.5">
              Incident Management & Triage
            </h1>
            <p className="text-xs text-neutral-500 font-mono mt-0.5">
              Scope:{" "}
              <span className="text-neutral-900 font-semibold">
                {shellData.session.siteName || "All Sites (Portfolio)"}
              </span>{" "}
              • Total: <span className="text-neutral-900 font-bold">{incidents.length} Work Orders</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/incidents/new"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-2xs transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Report Incident</span>
            </Link>
            <Link
              href="/field"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold shadow-2xs transition-colors"
            >
              <Radio className="h-3.5 w-3.5" />
              <span>Voice PTT Console</span>
            </Link>
          </div>
        </div>

        {/* Status Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 text-xs font-mono">
          <Link
            href="/incidents"
            className={cn(
              "p-2.5 rounded-lg border bg-white shadow-2xs transition-colors hover:border-neutral-300",
              !activeStatusFilter ? "border-blue-600 ring-1 ring-blue-600" : "border-neutral-200"
            )}
          >
            <span className="text-[10px] text-neutral-500 uppercase block">All Tickets</span>
            <span className="text-base font-bold text-neutral-900">{incidents.length}</span>
          </Link>

          <Link
            href="/incidents?status=SUBMITTED"
            className={cn(
              "p-2.5 rounded-lg border bg-white shadow-2xs transition-colors hover:border-neutral-300",
              activeStatusFilter === "SUBMITTED" ? "border-amber-600 ring-1 ring-amber-600" : "border-neutral-200"
            )}
          >
            <span className="text-[10px] text-amber-700 uppercase block">Submitted</span>
            <span className="text-base font-bold text-amber-700">{countByStatus.SUBMITTED || 0}</span>
          </Link>

          <Link
            href="/incidents?status=ACKNOWLEDGED"
            className={cn(
              "p-2.5 rounded-lg border bg-white shadow-2xs transition-colors hover:border-neutral-300",
              activeStatusFilter === "ACKNOWLEDGED" ? "border-blue-600 ring-1 ring-blue-600" : "border-neutral-200"
            )}
          >
            <span className="text-[10px] text-blue-700 uppercase block">Acknowledged</span>
            <span className="text-base font-bold text-blue-700">{countByStatus.ACKNOWLEDGED || 0}</span>
          </Link>

          <Link
            href="/incidents?status=IN_PROGRESS"
            className={cn(
              "p-2.5 rounded-lg border bg-white shadow-2xs transition-colors hover:border-neutral-300",
              activeStatusFilter === "IN_PROGRESS" ? "border-indigo-600 ring-1 ring-indigo-600" : "border-neutral-200"
            )}
          >
            <span className="text-[10px] text-indigo-700 uppercase block">In Progress</span>
            <span className="text-base font-bold text-indigo-700">{countByStatus.IN_PROGRESS || 0}</span>
          </Link>

          <Link
            href="/incidents?status=RESOLVED"
            className={cn(
              "p-2.5 rounded-lg border bg-white shadow-2xs transition-colors hover:border-neutral-300",
              activeStatusFilter === "RESOLVED" ? "border-emerald-600 ring-1 ring-emerald-600" : "border-neutral-200"
            )}
          >
            <span className="text-[10px] text-emerald-700 uppercase block">Resolved</span>
            <span className="text-base font-bold text-emerald-700">{countByStatus.RESOLVED || 0}</span>
          </Link>

          <Link
            href="/incidents?status=NEEDS_CLARIFICATION"
            className={cn(
              "p-2.5 rounded-lg border bg-white shadow-2xs transition-colors hover:border-neutral-300",
              activeStatusFilter === "NEEDS_CLARIFICATION" ? "border-purple-600 ring-1 ring-purple-600" : "border-neutral-200"
            )}
          >
            <span className="text-[10px] text-purple-700 uppercase block">Clarification</span>
            <span className="text-base font-bold text-purple-700">{countByStatus.NEEDS_CLARIFICATION || 0}</span>
          </Link>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="rounded-lg border border-neutral-200 bg-white p-3.5 shadow-2xs space-y-3">
          <form method="GET" action="/incidents" className="flex flex-col md:flex-row gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                name="q"
                defaultValue={searchQuery}
                placeholder="Search ticket #, title, symptoms, asset tag, or reporter..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600"
              />
            </div>

            {/* Site Filter (Admin) */}
            {session.role === "ADMIN" && (
              <select
                name="siteId"
                defaultValue={activeSiteFilter || "all"}
                className="px-2.5 py-1.5 text-xs rounded border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600"
              >
                <option value="all">All Solar Plants</option>
                {shellData.sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name} ({site.code})
                  </option>
                ))}
              </select>
            )}

            {/* Status Filter */}
            <select
              name="status"
              defaultValue={activeStatusFilter || ""}
              className="px-2.5 py-1.5 text-xs rounded border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="NEEDS_CLARIFICATION">Needs Clarification</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>

            {/* Priority Filter */}
            <select
              name="priority"
              defaultValue={activePriorityFilter || ""}
              className="px-2.5 py-1.5 text-xs rounded border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600"
            >
              <option value="">All Priorities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

            {/* Fault Category Filter */}
            <select
              name="category"
              defaultValue={activeCategoryFilter || ""}
              className="px-2.5 py-1.5 text-xs rounded border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600"
            >
              <option value="">All Fault Categories</option>
              {Object.entries(FAULT_CATEGORY_LABELS).map(([cat, label]) => (
                <option key={cat} value={cat}>
                  {label}
                </option>
              ))}
            </select>

            <button
              type="submit"
              className="px-3.5 py-1.5 rounded bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold shrink-0 cursor-pointer transition-colors"
            >
              Filter
            </button>

            {hasActiveFilters && (
              <Link
                href="/incidents"
                className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded border border-neutral-200 bg-white text-xs text-neutral-600 hover:text-neutral-900 transition-colors"
                title="Reset filters"
              >
                <X className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Reset</span>
              </Link>
            )}
          </form>

          {/* Active Filter Badges */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-neutral-100 text-[11px] font-mono text-neutral-500">
              <span className="font-sans text-neutral-400">Active filters:</span>
              {searchQuery && (
                <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  Search: &ldquo;{searchQuery}&rdquo;
                </span>
              )}
              {activeStatusFilter && (
                <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200">
                  Status: {INCIDENT_STATUS_META[activeStatusFilter]?.label || activeStatusFilter}
                </span>
              )}
              {activePriorityFilter && (
                <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200">
                  Priority: {activePriorityFilter}
                </span>
              )}
              {activeCategoryFilter && (
                <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200">
                  Category: {FAULT_CATEGORY_LABELS[activeCategoryFilter]}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Incidents List */}
        <div className="space-y-3">
          {incidents.length === 0 ? (
            <div className="rounded-lg border border-neutral-200 bg-white p-12 text-center space-y-3">
              <div className="h-10 w-10 rounded-full bg-neutral-100 text-neutral-400 flex items-center justify-center mx-auto">
                <Activity className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-neutral-800">No incident tickets found</p>
                <p className="text-xs text-neutral-500">
                  {hasActiveFilters
                    ? "Try adjusting your filter criteria or clearing search keywords."
                    : "All equipment parameters nominal. Zero active maintenance tickets."}
                </p>
              </div>
              {hasActiveFilters && (
                <Link
                  href="/incidents"
                  className="inline-block px-3 py-1.5 rounded border border-neutral-200 bg-white text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                >
                  Clear all filters
                </Link>
              )}
            </div>
          ) : (
            incidents.map((incident) => {
              const statusMeta =
                INCIDENT_STATUS_META[incident.status] || INCIDENT_STATUS_META.SUBMITTED;
              const priorityMeta =
                INCIDENT_PRIORITY_META[incident.priority] || INCIDENT_PRIORITY_META.MEDIUM;

              return (
                <Link
                  key={incident.id}
                  href={`/incidents/${incident.id}`}
                  className="block group rounded-lg border border-neutral-200 bg-white p-4 space-y-3 shadow-2xs hover:border-blue-400 hover:shadow-xs transition-all"
                >
                  {/* Top Bar: Ticket Number, Badges, Created Time */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-blue-600 group-hover:underline">
                        {incident.ticketNumber}
                      </span>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-mono font-bold border flex items-center gap-1",
                          priorityMeta.badge
                        )}
                      >
                        <span className={cn("h-1.5 w-1.5 rounded-full", priorityMeta.dot)} />
                        {incident.priority}
                      </span>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-mono font-bold border flex items-center gap-1",
                          statusMeta.badge
                        )}
                      >
                        <span className={cn("h-1.5 w-1.5 rounded-full", statusMeta.dot)} />
                        {statusMeta.label}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200">
                        {FAULT_CATEGORY_LABELS[incident.faultCategory] || incident.faultCategory}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-neutral-400">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(incident.createdAt).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h2 className="text-xs sm:text-sm font-bold text-neutral-900 group-hover:text-blue-600 transition-colors">
                      {incident.title}
                    </h2>
                    <p className="text-xs text-neutral-600 mt-1 line-clamp-2 leading-relaxed">
                      {incident.description}
                    </p>
                  </div>

                  {/* Plant Location & Asset Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono text-neutral-500 pt-2 border-t border-neutral-100">
                    <div className="flex items-center gap-1.5 truncate">
                      <MapPin className="h-3 w-3 text-neutral-400 shrink-0" />
                      <span className="truncate">{incident.site.name}</span>
                    </div>

                    <div className="flex items-center justify-start sm:justify-end gap-1.5 truncate">
                      <Cpu className="h-3 w-3 text-neutral-400 shrink-0" />
                      {incident.asset ? (
                        <span className="truncate">
                          {incident.asset.assetTag} ({incident.asset.name}) • {incident.asset.block}
                        </span>
                      ) : (
                        <span className="text-neutral-400">Site-Wide Component</span>
                      )}
                    </div>
                  </div>

                  {/* Feature 7 Attribution: Reporter & Assignee */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-100 text-[11px] font-mono text-neutral-500">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3 text-neutral-400" />
                      <span>
                        Reported by: <span className="text-neutral-800 font-semibold">{incident.reportedBy.name}</span>{" "}
                        ({incident.reportedBy.role})
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span>
                        Assignee:{" "}
                        <span className="text-neutral-800 font-semibold">
                          {incident.assignedTo ? `${incident.assignedTo.name} (${incident.assignedTo.role})` : "Unassigned"}
                        </span>
                      </span>

                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-100 text-neutral-600 border border-neutral-200">
                        {incident._count.events} events
                      </span>

                      <span className="inline-flex items-center text-blue-600 font-semibold text-xs gap-0.5">
                        <span>Details</span>
                        <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </AppShell>
  );
}
