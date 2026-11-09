import React from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSessionFromCookies } from "@/lib/session";
import { getShellContext } from "@/lib/shell-context";
import { AppShell } from "@/components/shell/app-shell";
import { db } from "@/lib/db";
import { hasPermission } from "@/modules/auth/permissions";
import { assertOrgAccess, assertSiteAccess } from "@/lib/auth-guard";
import { AssetForm } from "@/modules/assets/components/asset-form";
import { ChevronLeft } from "lucide-react";

interface EditAssetPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditAssetPage({ params }: EditAssetPageProps) {
  const session = await getSessionFromCookies();

  if (!session) {
    redirect("/login");
  }

  // Authorization check
  if (!hasPermission(session.role, "MANAGE_ASSETS")) {
    redirect("/assets");
  }

  const { id } = await params;

  const asset = await db.asset.findUnique({
    where: { id },
    include: {
      site: {
        select: { id: true, name: true, code: true, organizationId: true },
      },
    },
  });

  if (!asset) {
    notFound();
  }

  // Multi-tenant isolation check
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

  // Multi-tenant site options
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

  // Available parent assets (belonging to same site, excluding self)
  const availableParents = await db.asset.findMany({
    where: {
      siteId: asset.siteId,
      id: { not: asset.id },
    },
    select: {
      id: true,
      assetTag: true,
      name: true,
      siteId: true,
    },
    orderBy: [{ block: "asc" }, { assetTag: "asc" }],
  });

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
          <Link
            href={`/assets/${asset.id}`}
            className="hover:text-neutral-900 transition-colors"
          >
            {asset.assetTag}
          </Link>
          <span>/</span>
          <span className="text-neutral-900 font-bold">Edit</span>
        </div>

        {/* Page Header */}
        <div className="pb-4 border-b border-neutral-200">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span className="text-xs font-mono font-semibold text-neutral-500 uppercase tracking-wider">
              Asset Configuration
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 mt-0.5">
            Edit Equipment: {asset.assetTag}
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Update technical specifications, operational status, or hierarchy mappings for this asset.
          </p>
        </div>

        {/* Interactive Asset Edit Form */}
        <AssetForm
          mode="edit"
          initialData={{
            id: asset.id,
            siteId: asset.siteId,
            assetTag: asset.assetTag,
            name: asset.name,
            assetType: asset.assetType,
            status: asset.status,
            block: asset.block,
            row: asset.row,
            parentAssetId: asset.parentAssetId,
            manufacturer: asset.manufacturer,
            model: asset.model,
            serialNumber: asset.serialNumber,
            ratedCapacityKw: asset.ratedCapacityKw,
            commissionDate: asset.commissionDate,
          }}
          sites={sites}
          defaultSiteId={asset.siteId}
          isSiteLocked={isSiteLocked}
          availableParents={availableParents}
          cancelHref={`/assets/${asset.id}`}
        />
      </div>
    </AppShell>
  );
}

