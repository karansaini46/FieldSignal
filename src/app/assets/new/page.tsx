import React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionFromCookies } from "@/lib/session";
import { getShellContext } from "@/lib/shell-context";
import { AppShell } from "@/components/shell/app-shell";
import { db } from "@/lib/db";
import { hasPermission } from "@/modules/auth/permissions";
import { AssetForm } from "@/modules/assets/components/asset-form";
import { ChevronLeft, PlusCircle } from "lucide-react";

export default async function NewAssetPage() {
  const session = await getSessionFromCookies();

  if (!session) {
    redirect("/login");
  }

  // Authorization check
  if (!hasPermission(session.role, "MANAGE_ASSETS")) {
    redirect("/assets");
  }

  const shellData = await getShellContext(session);

  if (!shellData) {
    redirect("/login");
  }

  // Multi-tenant site retrieval
  const sites = await db.site.findMany({
    where: {
      organizationId: session.organizationId,
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

  // Available parent assets
  const availableParents = await db.asset.findMany({
    where: {
      siteId: { in: siteIds },
    },
    select: {
      id: true,
      assetTag: true,
      name: true,
      siteId: true,
    },
    orderBy: [{ block: "asc" }, { assetTag: "asc" }],
  });

  const defaultSiteId =
    session.role === "SUPERVISOR" && session.siteId
      ? session.siteId
      : sites[0]?.id;

  const isSiteLocked = Boolean(session.role === "SUPERVISOR" && session.siteId);

  return (
    <AppShell
      session={shellData.session}
      sites={shellData.sites}
      openTicketsCount={shellData.openTicketsCount}
      criticalTicketsCount={shellData.criticalTicketsCount}
    >
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs font-mono text-neutral-500">
          <Link
            href="/assets"
            className="inline-flex items-center gap-1 hover:text-neutral-900 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>Equipment Registry</span>
          </Link>
          <span>/</span>
          <span className="text-neutral-900 font-bold">Register Equipment</span>
        </div>

        {/* Page Header */}
        <div className="pb-4 border-b border-neutral-200">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-600" />
            <span className="text-xs font-mono font-semibold text-neutral-500 uppercase tracking-wider">
              Asset Lifecycle Management
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 mt-0.5">
            Register New Solar Equipment
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Add a physical solar asset to the plant registry tree. Asset codes must be unique within their plant facility.
          </p>
        </div>

        {/* Interactive Asset Registration Form */}
        <AssetForm
          mode="create"
          sites={sites}
          defaultSiteId={defaultSiteId}
          isSiteLocked={isSiteLocked}
          availableParents={availableParents}
          cancelHref="/assets"
        />
      </div>
    </AppShell>
  );
}

