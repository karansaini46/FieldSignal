"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { SiteSummary } from "./types";
import { Building2, ChevronDown, Check, Sun, MapPin, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

interface SiteSelectorProps {
  organizationName: string;
  sites: SiteSummary[];
  currentSiteId?: string | null;
  userRole: string;
  className?: string;
}

export function SiteSelector({
  organizationName,
  sites,
  currentSiteId,
  userRole,
  className,
}: SiteSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeSiteId = searchParams.get("siteId") ?? currentSiteId ?? "";
  const activeSite = sites.find((s) => s.id === activeSiteId);
  const isPortfolio = !activeSiteId || activeSiteId === "all";

  const handleSelect = (siteId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (siteId === "all" || !siteId) {
      params.delete("siteId");
    } else {
      params.set("siteId", siteId);
    }
    setIsOpen(false);
    // ponytail: URL query param updates drive Server Component re-renders with zero client state sync overhead
    router.push(`${pathname}?${params.toString()}`);
  };

  const canViewAll = userRole === "ADMIN" || userRole === "SUPERVISOR";

  return (
    <div ref={containerRef} className={cn("relative inline-block text-left", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 h-9 px-3 rounded-md border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-900 transition-colors focus:outline-none focus:ring-1 focus:ring-neutral-400 text-xs font-medium shadow-2xs"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <div className="flex h-5 w-5 items-center justify-center rounded bg-amber-50 text-amber-700 border border-amber-200/60">
          <Sun className="h-3 w-3" />
        </div>

        <div className="flex flex-col items-start leading-tight text-left">
          <span className="font-semibold text-[11px] text-neutral-900 line-clamp-1">
            {isPortfolio ? "Portfolio (All Sites)" : activeSite?.name}
          </span>
          <span className="text-[10px] text-neutral-500 font-mono">
            {isPortfolio
              ? `${sites.length} Active Plants • ${sites.reduce((acc, s) => acc + s.capacityMw, 0)} MW`
              : `${activeSite?.code} • ${activeSite?.capacityMw} MW`}
          </span>
        </div>

        <ChevronDown className="h-3.5 w-3.5 text-neutral-400 ml-1 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-72 origin-top-left rounded-md border border-neutral-200 bg-white p-1.5 shadow-lg ring-1 ring-black/5 z-50 text-xs">
          <div className="px-2.5 py-1.5 border-b border-neutral-100 mb-1">
            <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider block">
              Organization
            </span>
            <span className="text-xs font-semibold text-neutral-900 flex items-center gap-1.5 mt-0.5">
              <Building2 className="h-3.5 w-3.5 text-neutral-500" />
              {organizationName}
            </span>
          </div>

          <div className="space-y-0.5">
            {canViewAll && (
              <button
                type="button"
                onClick={() => handleSelect("all")}
                className={cn(
                  "flex w-full items-center justify-between rounded px-2.5 py-2 text-left transition-colors",
                  isPortfolio
                    ? "bg-neutral-100 text-neutral-900 font-medium"
                    : "text-neutral-700 hover:bg-neutral-50"
                )}
              >
                <div className="flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5 text-neutral-500" />
                  <div>
                    <div className="font-medium text-xs">Portfolio (All Sites)</div>
                    <div className="text-[10px] text-neutral-500 font-mono">
                      Consolidated multi-site telemetry
                    </div>
                  </div>
                </div>
                {isPortfolio && <Check className="h-3.5 w-3.5 text-neutral-900" />}
              </button>
            )}

            <div className="pt-1 pb-1">
              <span className="px-2.5 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">
                Solar Plants
              </span>
            </div>

            {sites.map((site) => {
              const isSelected = activeSiteId === site.id;
              return (
                <button
                  key={site.id}
                  type="button"
                  onClick={() => handleSelect(site.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded px-2.5 py-2 text-left transition-colors",
                    isSelected
                      ? "bg-neutral-100 text-neutral-900 font-medium"
                      : "text-neutral-700 hover:bg-neutral-50"
                  )}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-xs text-neutral-900">{site.name}</span>
                      <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-neutral-100 text-neutral-600 border border-neutral-200">
                        {site.code}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                      <span className="font-mono text-neutral-700 font-semibold">
                        {site.capacityMw} MW
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-0.5">
                        <MapPin className="h-2.5 w-2.5" />
                        {(site.location || "Solar Facility").split(",")[0]}
                      </span>
                    </div>
                  </div>
                  {isSelected && <Check className="h-3.5 w-3.5 text-neutral-900" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
