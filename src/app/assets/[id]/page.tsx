import React from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSessionFromCookies } from "@/lib/session";
import { getShellContext } from "@/lib/shell-context";
import { AppShell } from "@/components/shell/app-shell";
import { db } from "@/lib/db";
import { hasPermission } from "@/modules/auth/permissions";
import { assertOrgAccess, assertSiteAccess } from "@/lib/auth-guard";
import { AssetType, AssetStatus } from "@prisma/client";
import {
  ChevronLeft,
  MapPin,
  Cpu,
  Layers,
  Pencil,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Radio,
  CornerDownRight,
  ShieldAlert,
  Calendar,
  Hash,
  Activity,
  FileText,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AssetDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AssetDetailPage({ params }: AssetDetailPageProps) {
  const session = await getSessionFromCookies();

  if (!session) {
    redirect("/login");
  }

  const { id } = await params;

  const asset = await db.asset.findUnique({
    where: { id },
    include: {
      site: {
        select: { id: true, name: true, code: true, location: true, organizationId: true },
      },
      parentAsset: {
        select: { id: true, assetTag: true, name: true, assetType: true, status: true },
      },
      children: {
        select: {
          id: true,
          assetTag: true,
          name: true,
          assetType: true,
          status: true,
          block: true,
          row: true,
        },
        orderBy: { assetTag: "asc" },
      },
      incidents: {
        include: {
          reportedBy: { select: { id: true, name: true, role: true } },
          assignedTo: { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!asset) {
    notFound();
  }

  // Multi-tenant and site security check
  try {
    assertOrgAccess(asset.site.organizationId, session);
    assertSiteAccess(asset.siteId, session);
  } catch {
    notFound();
  }

  const shellData = await getShellContext(session, asset.siteId);

  if (!shellData) {
    redirect("/login");
  }

  const canManageAssets = hasPermission(session.role, "MANAGE_ASSETS");

  const statusStyles: Record<string, { badge: string; dot: string; label: string; bg: string }> = {
    OPERATIONAL: {
      badge: "bg-emerald-50 text-emerald-800 border-emerald-200",
      dot: "bg-emerald-500",
      label: "Operational",
      bg: "bg-emerald-500/10 text-emerald-700",
    },
    DEGRADED: {
      badge: "bg-amber-50 text-amber-800 border-amber-200",
      dot: "bg-amber-500",
      label: "Degraded",
      bg: "bg-amber-500/10 text-amber-700",
    },
    FAULTED: {
      badge: "bg-rose-50 text-rose-800 border-rose-200",
      dot: "bg-rose-500",
      label: "Faulted",
      bg: "bg-rose-500/10 text-rose-700",
    },
    MAINTENANCE: {
      badge: "bg-blue-50 text-blue-800 border-blue-200",
      dot: "bg-blue-500",
      label: "Maintenance",
      bg: "bg-blue-500/10 text-blue-700",
    },
    DECOMMISSIONED: {
      badge: "bg-neutral-100 text-neutral-600 border-neutral-200",
      dot: "bg-neutral-400",
      label: "Decommissioned",
      bg: "bg-neutral-500/10 text-neutral-600",
    },
  };

  const priorityStyles: Record<string, string> = {
    CRITICAL: "bg-rose-100 text-rose-800 border-rose-200",
    HIGH: "bg-amber-100 text-amber-800 border-amber-200",
    MEDIUM: "bg-blue-100 text-blue-800 border-blue-200",
    LOW: "bg-neutral-100 text-neutral-700 border-neutral-200",
  };

  const incidentStatusStyles: Record<string, string> = {
    DRAFT: "bg-neutral-100 text-neutral-600 border-neutral-200",
    NEEDS_CLARIFICATION: "bg-purple-50 text-purple-800 border-purple-200",
    SUBMITTED: "bg-amber-50 text-amber-800 border-amber-200",
    ACKNOWLEDGED: "bg-blue-50 text-blue-800 border-blue-200",
    IN_PROGRESS: "bg-indigo-50 text-indigo-800 border-indigo-200",
    RESOLVED: "bg-emerald-50 text-emerald-800 border-emerald-200",
    CLOSED: "bg-neutral-50 text-neutral-700 border-neutral-200",
  };

  const equipmentTypeDisplay: Record<AssetType, string> = {
    INVERTER: "Inverter",
    SOLAR_MODULE: "Solar Module",
    COMBINER_BOX: "Combiner Box",
    TRANSFORMER: "Transformer",
    OTHER: "Other Equipment",
  };

  const currentStatus = statusStyles[asset.status] || {
    badge: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
    label: "Operational",
    bg: "bg-emerald-500/10 text-emerald-700",
  };
  const activeFaults = asset.incidents.filter((i) =>
    ["NEEDS_CLARIFICATION", "SUBMITTED", "ACKNOWLEDGED", "IN_PROGRESS"].includes(i.status)
  );
  const resolvedFaults = asset.incidents.filter((i) =>
    ["RESOLVED", "CLOSED"].includes(i.status)
  );

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
            href="/assets"
            className="inline-flex items-center gap-1 hover:text-neutral-900 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>Equipment Registry</span>
          </Link>
          <span>/</span>
          <span className="text-neutral-900 font-bold">{asset.assetTag}</span>
        </div>

        {/* Hero Header */}
        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg sm:text-xl font-bold text-neutral-900">
                  {asset.assetTag}
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200 font-semibold">
                  {equipmentTypeDisplay[asset.assetType] || asset.assetType}
                </span>
                <span
                  className={cn(
                    "px-2 py-0.5 rounded text-xs font-mono font-bold border flex items-center gap-1.5",
                    currentStatus.badge
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", currentStatus.dot)} />
                  {currentStatus.label}
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-bold text-neutral-900">{asset.name}</h1>
              <p className="text-xs font-mono text-neutral-500 flex items-center gap-1.5 pt-1">
                <MapPin className="h-3.5 w-3.5 text-neutral-400" />
                <span>
                  {asset.site.name} ({asset.site.code}) • {asset.block}
                  {asset.row ? ` • ${asset.row}` : ""}
                </span>
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              {canManageAssets && (
                <Link
                  href={`/assets/${asset.id}/edit`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800 text-xs font-semibold shadow-2xs transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5 text-neutral-500" />
                  <span>Edit Equipment</span>
                </Link>
              )}
              <Link
                href="/field"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold shadow-2xs transition-colors"
              >
                <Radio className="h-3.5 w-3.5" />
                <span>Voice Report</span>
              </Link>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-neutral-100 text-xs font-mono">
            <div>
              <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">
                Total Faults Logged
              </span>
              <span className="text-base font-bold text-neutral-900">
                {asset.incidents.length}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">
                Active Issues
              </span>
              <span
                className={cn(
                  "text-base font-bold",
                  activeFaults.length > 0 ? "text-rose-600" : "text-emerald-600"
                )}
              >
                {activeFaults.length}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">
                Resolved / Closed
              </span>
              <span className="text-base font-bold text-neutral-900">
                {resolvedFaults.length}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">
                Rated Power
              </span>
              <span className="text-base font-bold text-neutral-900">
                {asset.ratedCapacityKw ? `${Number(asset.ratedCapacityKw)} kW` : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Technical Specs & Hierarchy Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Equipment Specifications */}
          <div className="rounded-lg border border-neutral-200 bg-white p-4 space-y-3 shadow-2xs">
            <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
              <Cpu className="h-4 w-4 text-neutral-500" />
              <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-700">
                Technical Specifications
              </h2>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-neutral-50">
                <span className="text-neutral-500">Asset Code (Tag)</span>
                <span className="font-bold text-neutral-900">{asset.assetTag}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-50">
                <span className="text-neutral-500">Equipment Type</span>
                <span className="text-neutral-900 font-semibold">
                  {equipmentTypeDisplay[asset.assetType]}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-50">
                <span className="text-neutral-500">Manufacturer</span>
                <span className="text-neutral-900">{asset.manufacturer || "Not specified"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-50">
                <span className="text-neutral-500">Model</span>
                <span className="text-neutral-900">{asset.model || "Not specified"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-50">
                <span className="text-neutral-500">Serial Number</span>
                <span className="text-neutral-900">{asset.serialNumber || "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-50">
                <span className="text-neutral-500">Rated Capacity</span>
                <span className="text-neutral-900">
                  {asset.ratedCapacityKw ? `${Number(asset.ratedCapacityKw)} kW` : "—"}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-neutral-500">Commission Date</span>
                <span className="text-neutral-900">
                  {asset.commissionDate
                    ? new Date(asset.commissionDate).toLocaleDateString()
                    : "—"}
                </span>
              </div>

              {/* Technical Metadata JSON */}
              {asset.metadata && typeof asset.metadata === "object" && (
                <div className="pt-2 border-t border-neutral-100">
                  <span className="text-[10px] text-neutral-400 uppercase tracking-wider block mb-1">
                    System Parameters
                  </span>
                  <div className="bg-neutral-50 p-2 rounded border border-neutral-200 text-[11px] space-y-1">
                    {Object.entries(asset.metadata as Record<string, unknown>).map(
                      ([key, val]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-neutral-500">{key}:</span>
                          <span className="font-semibold text-neutral-800">
                            {typeof val === "object" ? JSON.stringify(val) : String(val)}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Plant Hierarchy & Linked Equipment */}
          <div className="rounded-lg border border-neutral-200 bg-white p-4 space-y-3 shadow-2xs">
            <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
              <Layers className="h-4 w-4 text-neutral-500" />
              <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-700">
                Plant Location & Hierarchy
              </h2>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="space-y-1 py-1 border-b border-neutral-50">
                <span className="text-neutral-500 block text-[11px]">Solar Plant Facility</span>
                <span className="font-bold text-neutral-900 block">{asset.site.name}</span>
                {asset.site.location && (
                  <span className="text-neutral-400 text-[11px] block">{asset.site.location}</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 py-1 border-b border-neutral-50">
                <div>
                  <span className="text-neutral-500 text-[11px] block">Block</span>
                  <span className="font-semibold text-neutral-900">{asset.block}</span>
                </div>
                <div>
                  <span className="text-neutral-500 text-[11px] block">Row / String</span>
                  <span className="font-semibold text-neutral-900">{asset.row || "—"}</span>
                </div>
              </div>

              {/* Parent Equipment Link */}
              <div className="py-1 border-b border-neutral-50">
                <span className="text-neutral-500 text-[11px] block">Parent Equipment</span>
                {asset.parentAsset ? (
                  <Link
                    href={`/assets/${asset.parentAsset.id}`}
                    className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-bold mt-0.5"
                  >
                    <CornerDownRight className="h-3.5 w-3.5 text-neutral-400" />
                    <span>{asset.parentAsset.assetTag}</span>
                    <span className="text-neutral-500 font-normal">
                      ({asset.parentAsset.name})
                    </span>
                  </Link>
                ) : (
                  <span className="text-neutral-400 text-xs">
                    None (Top-level plant asset)
                  </span>
                )}
              </div>

              {/* Subordinate Equipment (Children) */}
              <div className="pt-1">
                <span className="text-neutral-500 text-[11px] block mb-1">
                  Subordinate Equipment ({asset.children.length})
                </span>
                {asset.children.length === 0 ? (
                  <span className="text-neutral-400 text-xs">
                    No downstream components mapped
                  </span>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {asset.children.map((child) => (
                      <Link
                        key={child.id}
                        href={`/assets/${child.id}`}
                        className="flex items-center justify-between p-2 rounded bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-neutral-900">{child.assetTag}</span>
                          <span className="text-[10px] text-neutral-500">{child.name}</span>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-neutral-200 text-neutral-600">
                          {child.block}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Feature 7: Asset History Section */}
        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-neutral-900">
                Asset Maintenance & Fault History
              </h2>
            </div>
            <span className="text-xs font-mono text-neutral-500">
              {asset.incidents.length} recorded events
            </span>
          </div>

          {asset.incidents.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div className="h-9 w-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <p className="text-xs font-semibold text-neutral-800">
                No Maintenance Incidents Recorded
              </p>
              <p className="text-xs text-neutral-500 max-w-md mx-auto">
                This equipment has zero logged faults. All parameters are operational and nominal.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {asset.incidents.map((incident) => {
                const priorityBadge = priorityStyles[incident.priority] || priorityStyles.MEDIUM;
                const statusBadge =
                  incidentStatusStyles[incident.status] || incidentStatusStyles.OPEN;

                return (
                  <div
                    key={incident.id}
                    className="p-3.5 rounded-lg border border-neutral-200 bg-neutral-50/50 hover:bg-neutral-50 space-y-2.5 transition-colors"
                  >
                    {/* Incident Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/incidents?ticket=${incident.ticketNumber}`}
                          className="font-mono text-xs font-bold text-blue-600 hover:underline"
                        >
                          {incident.ticketNumber}
                        </Link>
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border",
                            priorityBadge
                          )}
                        >
                          {incident.priority}
                        </span>
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border",
                            statusBadge
                          )}
                        >
                          {incident.status}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200">
                          {incident.faultCategory.replace(/_/g, " ")}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] font-mono text-neutral-500">
                        <Clock className="h-3 w-3 text-neutral-400" />
                        <span>{new Date(incident.createdAt).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Title & Description */}
                    <div>
                      <h3 className="text-xs font-bold text-neutral-900">{incident.title}</h3>
                      <p className="text-xs text-neutral-600 mt-0.5 leading-relaxed">
                        {incident.description}
                      </p>
                    </div>

                    {/* Symptoms & Error Code (if present) */}
                    {(incident.symptoms || incident.errorCode) && (
                      <div className="flex flex-wrap gap-3 pt-1 text-[11px] font-mono text-neutral-600 bg-white p-2 rounded border border-neutral-200">
                        {incident.errorCode && (
                          <div>
                            <span className="text-neutral-400">Error Code: </span>
                            <span className="font-bold text-rose-700">{incident.errorCode}</span>
                          </div>
                        )}
                        {incident.symptoms && (
                          <div>
                            <span className="text-neutral-400">Symptoms: </span>
                            <span>{incident.symptoms}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Resolution Notes (if closed/resolved) */}
                    {incident.resolutionNotes && (
                      <div className="text-[11px] font-mono bg-emerald-50 text-emerald-900 p-2 rounded border border-emerald-200">
                        <span className="font-bold">Resolution Notes: </span>
                        <span>{incident.resolutionNotes}</span>
                      </div>
                    )}

                    {/* Reporter & Assignee */}
                    <div className="flex items-center justify-between pt-1 border-t border-neutral-200/60 text-[11px] font-mono text-neutral-500">
                      <span>Reported by: {incident.reportedBy.name}</span>
                      {incident.assignedTo && (
                        <span>Assigned to: {incident.assignedTo.name}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
