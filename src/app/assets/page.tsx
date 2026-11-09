import React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionFromCookies } from "@/lib/session";
import { getShellContext } from "@/lib/shell-context";
import { AppShell } from "@/components/shell/app-shell";
import { db } from "@/lib/db";
import { Prisma, AssetType, AssetStatus } from "@prisma/client";
import { hasPermission } from "@/modules/auth/permissions";
import {
  MapPin,
  Cpu,
  Layers,
  Search,
  Plus,
  CornerDownRight,
  Filter,
  X,
  ArrowRight,
  AlertCircle,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AssetsPageProps {
  searchParams?: Promise<{
    siteId?: string;
    type?: string;
    status?: string;
    q?: string;
    tag?: string;
  }>;
}

export default async function AssetsPage({ searchParams }: AssetsPageProps) {
  const session = await getSessionFromCookies();

  if (!session) {
    redirect("/login");
  }

  const resolvedParams = searchParams ? await searchParams : {};
  const activeSiteFilter = resolvedParams.siteId;
  const activeTypeFilter = resolvedParams.type as AssetType | undefined;
  const activeStatusFilter = resolvedParams.status as AssetStatus | undefined;
  const searchQuery = (resolvedParams.q || resolvedParams.tag || "").trim();

  const shellData = await getShellContext(session, activeSiteFilter);

  if (!shellData) {
    redirect("/login");
  }

  const canManageAssets = hasPermission(session.role, "MANAGE_ASSETS");

  const where: Prisma.AssetWhereInput = {
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

  // Equipment type filter
  if (activeTypeFilter && Object.values(AssetType).includes(activeTypeFilter)) {
    where.assetType = activeTypeFilter;
  }

  // Status filter
  if (activeStatusFilter && Object.values(AssetStatus).includes(activeStatusFilter)) {
    where.status = activeStatusFilter;
  }

  // Search filter
  if (searchQuery) {
    where.OR = [
      { assetTag: { contains: searchQuery, mode: "insensitive" } },
      { name: { contains: searchQuery, mode: "insensitive" } },
      { block: { contains: searchQuery, mode: "insensitive" } },
      { manufacturer: { contains: searchQuery, mode: "insensitive" } },
      { model: { contains: searchQuery, mode: "insensitive" } },
    ];
  }

  const assets = await db.asset.findMany({
    where,
    include: {
      site: { select: { id: true, name: true, code: true } },
      parentAsset: { select: { id: true, assetTag: true, name: true } },
      _count: {
        select: {
          incidents: {
            where: {
              status: { in: ["NEEDS_CLARIFICATION", "SUBMITTED", "ACKNOWLEDGED", "IN_PROGRESS"] },
            },
          },
        },
      },
    },
    orderBy: [{ siteId: "asc" }, { block: "asc" }, { assetTag: "asc" }],
  });

  const statusStyles: Record<string, { badge: string; dot: string; label: string }> = {
    OPERATIONAL: {
      badge: "bg-emerald-50 text-emerald-800 border-emerald-200",
      dot: "bg-emerald-500",
      label: "Operational",
    },
    DEGRADED: {
      badge: "bg-amber-50 text-amber-800 border-amber-200",
      dot: "bg-amber-500",
      label: "Degraded",
    },
    FAULTED: {
      badge: "bg-rose-50 text-rose-800 border-rose-200",
      dot: "bg-rose-500",
      label: "Faulted",
    },
    MAINTENANCE: {
      badge: "bg-blue-50 text-blue-800 border-blue-200",
      dot: "bg-blue-500",
      label: "Maintenance",
    },
    DECOMMISSIONED: {
      badge: "bg-neutral-100 text-neutral-600 border-neutral-200",
      dot: "bg-neutral-400",
      label: "Decommissioned",
    },
  };

  const equipmentTypeDisplay: Record<AssetType, string> = {
    INVERTER: "Inverter",
    SOLAR_MODULE: "Solar Module",
    COMBINER_BOX: "Combiner Box",
    TRANSFORMER: "Transformer",
    OTHER: "Other Equipment",
  };

  const hasActiveFilters = Boolean(
    (activeSiteFilter && activeSiteFilter !== "all") ||
      activeTypeFilter ||
      activeStatusFilter ||
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
        {/* Header & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-600" />
              <span className="text-xs font-mono font-semibold text-neutral-500 uppercase tracking-wider">
                Plant Infrastructure
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 mt-0.5">
              Solar Asset Registry
            </h1>
            <p className="text-xs text-neutral-500 font-mono mt-0.5">
              Scope:{" "}
              <span className="text-neutral-900 font-semibold">
                {shellData.session.siteName || "All Sites (Portfolio)"}
              </span>{" "}
              • Total: <span className="text-neutral-900 font-bold">{assets.length} Units</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {canManageAssets && (
              <Link
                href="/assets/new"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-2xs transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Register Asset</span>
              </Link>
            )}
            <Link
              href="/field"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold shadow-2xs transition-colors"
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Voice Report</span>
            </Link>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="rounded-lg border border-neutral-200 bg-white p-3.5 shadow-2xs space-y-3">
          <form method="GET" action="/assets" className="flex flex-col md:flex-row gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                name="q"
                defaultValue={searchQuery}
                placeholder="Search by asset code, name, block, or manufacturer..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition-colors"
              />
            </div>

            {/* Site Filter (Admin / Multi-site) */}
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

            {/* Equipment Type Filter */}
            <select
              name="type"
              defaultValue={activeTypeFilter || ""}
              className="px-2.5 py-1.5 text-xs rounded border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600"
            >
              <option value="">All Equipment Types</option>
              <option value="INVERTER">Inverter</option>
              <option value="SOLAR_MODULE">Solar Module</option>
              <option value="COMBINER_BOX">Combiner Box</option>
              <option value="TRANSFORMER">Transformer</option>
              <option value="OTHER">Other</option>
            </select>

            {/* Status Filter */}
            <select
              name="status"
              defaultValue={activeStatusFilter || ""}
              className="px-2.5 py-1.5 text-xs rounded border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600"
            >
              <option value="">All Statuses</option>
              <option value="OPERATIONAL">Operational</option>
              <option value="DEGRADED">Degraded</option>
              <option value="FAULTED">Faulted</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="DECOMMISSIONED">Decommissioned</option>
            </select>

            <button
              type="submit"
              className="px-3.5 py-1.5 rounded bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold shrink-0 cursor-pointer transition-colors"
            >
              Filter
            </button>

            {hasActiveFilters && (
              <Link
                href="/assets"
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
              {activeTypeFilter && (
                <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200">
                  Type: {equipmentTypeDisplay[activeTypeFilter]}
                </span>
              )}
              {activeStatusFilter && (
                <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200">
                  Status: {activeStatusFilter}
                </span>
              )}
              {activeSiteFilter && activeSiteFilter !== "all" && (
                <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200">
                  Site: {shellData.sites.find((s) => s.id === activeSiteFilter)?.name || activeSiteFilter}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Assets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assets.length === 0 ? (
            <div className="col-span-full rounded-lg border border-neutral-200 bg-white p-12 text-center space-y-3">
              <div className="h-10 w-10 rounded-full bg-neutral-100 text-neutral-400 flex items-center justify-center mx-auto">
                <Layers className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-neutral-800">No assets found</p>
                <p className="text-xs text-neutral-500">
                  {hasActiveFilters
                    ? "Try adjusting your search criteria or resetting filters."
                    : "No assets have been registered for this site yet."}
                </p>
              </div>
              {hasActiveFilters && (
                <Link
                  href="/assets"
                  className="inline-block px-3 py-1.5 rounded border border-neutral-200 bg-white text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                >
                  Clear all filters
                </Link>
              )}
            </div>
          ) : (
            assets.map((asset) => {
              const currentStatus =
                statusStyles[asset.status] || {
                  badge: "bg-emerald-50 text-emerald-800 border-emerald-200",
                  dot: "bg-emerald-500",
                  label: "Operational",
                };
              const openFaults = asset._count.incidents;

              return (
                <div
                  key={asset.id}
                  className="group rounded-lg border border-neutral-200 bg-white p-4 space-y-3 shadow-2xs hover:border-blue-300 hover:shadow-xs transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    {/* Header: Tag + Type + Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/assets/${asset.id}`}
                            className="font-mono text-sm font-bold text-neutral-900 group-hover:text-blue-600 transition-colors flex items-center gap-1"
                          >
                            <span>{asset.assetTag}</span>
                          </Link>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200">
                            {equipmentTypeDisplay[asset.assetType] || asset.assetType}
                          </span>
                        </div>
                        <h2 className="text-xs font-semibold text-neutral-800 mt-1">
                          {asset.name}
                        </h2>
                      </div>

                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-mono font-bold border flex items-center gap-1.5 shrink-0",
                          currentStatus.badge
                        )}
                      >
                        <span className={cn("h-1.5 w-1.5 rounded-full", currentStatus.dot)} />
                        {currentStatus.label}
                      </span>
                    </div>

                    {/* Site & Location */}
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono text-neutral-600 pt-2 border-t border-neutral-100">
                      <div className="flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3 text-neutral-400 shrink-0" />
                        <span className="truncate">{asset.site.name}</span>
                      </div>
                      <div className="text-right truncate">
                        <span>Block: {asset.block || "—"}</span>
                        {asset.row && <span> • Row {asset.row}</span>}
                      </div>
                    </div>

                    {/* Manufacturer & Capacity Specs */}
                    {(asset.manufacturer || asset.ratedCapacityKw) && (
                      <div className="flex items-center justify-between pt-2 border-t border-neutral-100 text-[11px] font-mono text-neutral-500">
                        <span className="flex items-center gap-1 truncate">
                          <Cpu className="h-3 w-3 text-neutral-400 shrink-0" />
                          <span className="truncate">
                            {asset.manufacturer || "OEM"} {asset.model || ""}
                          </span>
                        </span>
                        {asset.ratedCapacityKw && (
                          <span className="font-bold text-neutral-800 shrink-0">
                            {Number(asset.ratedCapacityKw)} kW
                          </span>
                        )}
                      </div>
                    )}

                    {/* Parent Hierarchy */}
                    {asset.parentAsset && (
                      <div className="pt-2 border-t border-neutral-100 text-[11px] font-mono text-neutral-500 flex items-center gap-1">
                        <CornerDownRight className="h-3 w-3 text-neutral-400 shrink-0" />
                        <span className="truncate">
                          Parent:{" "}
                          <Link
                            href={`/assets/${asset.parentAsset.id}`}
                            className="text-neutral-700 underline hover:text-blue-600"
                          >
                            {asset.parentAsset.assetTag}
                          </Link>{" "}
                          ({asset.parentAsset.name})
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Footer: Fault Count & Action Links */}
                  <div className="flex items-center justify-between pt-2.5 border-t border-neutral-100 text-xs">
                    <div>
                      {openFaults > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          <AlertCircle className="h-3 w-3" />
                          {openFaults} {openFaults === 1 ? "active fault" : "active faults"}
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono text-neutral-400">
                          0 active faults
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {canManageAssets && (
                        <Link
                          href={`/assets/${asset.id}/edit`}
                          className="p-1 rounded text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                          title="Edit asset"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                      )}
                      <Link
                        href={`/assets/${asset.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        <span>Details</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </AppShell>
  );
}
