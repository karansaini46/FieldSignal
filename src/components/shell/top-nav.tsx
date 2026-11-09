"use client";

import React, { useState, useEffect } from "react";
import { ShellUserSession, SiteSummary } from "./types";
import { SiteSelector } from "./site-selector";
import { UserMenu } from "./user-menu";
import {
  Menu,
  Search,
  Clock,
  Radio,
  Zap,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TopNavProps {
  session: ShellUserSession;
  sites: SiteSummary[];
  onOpenMobileMenu: () => void;
  onOpenQuickJump: () => void;
  className?: string;
}

export function TopNav({
  session,
  sites,
  onOpenMobileMenu,
  onOpenQuickJump,
  className,
}: TopNavProps) {
  const [plantTime, setPlantTime] = useState("");

  // Real-time plant operational clock (IST)
  useEffect(() => {
    function updateClock() {
      const now = new Date();
      setPlantTime(
        now.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
          timeZone: "Asia/Kolkata",
        })
      );
    }
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header
      className={cn(
        "h-14 border-b border-neutral-200 bg-white flex items-center justify-between px-3 sm:px-4 gap-2 sm:gap-4 shrink-0 select-none z-30",
        className
      )}
    >
      {/* Left: Mobile hamburger & Context breadcrumb */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="md:hidden flex h-9 w-9 items-center justify-center rounded-md border border-neutral-200 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50"
          aria-label="Open mobile navigation"
        >
          <Menu className="h-4 w-4" />
        </button>

        {/* Site Selector Dropdown */}
        <SiteSelector
          organizationName={session.organizationName || "Sunrise Solar Operations"}
          sites={sites}
          currentSiteId={session.siteId}
          userRole={session.role}
        />

        {/* Plant SCADA Clock */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded border border-neutral-200/80 bg-neutral-50 text-[11px] font-mono text-neutral-600">
          <Clock className="h-3 w-3 text-neutral-400" />
          <span>{plantTime ? `${plantTime} IST` : "12:00:00 IST"}</span>
          <span className="text-neutral-300">•</span>
          <span className="text-neutral-500 font-sans">Shift A</span>
        </div>
      </div>

      {/* Center/Right: Quick Search jump, Grid Status & User Profile Menu */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Quick Search Shortcut Button */}
        <button
          type="button"
          onClick={onOpenQuickJump}
          className="flex items-center gap-2 h-9 px-2.5 sm:px-3 rounded-md border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-500 hover:text-neutral-800 transition-colors text-xs"
          title="Search equipment tags & tickets (Press /)"
        >
          <Search className="h-3.5 w-3.5 text-neutral-400" />
          <span className="hidden sm:inline text-neutral-600">Search tags...</span>
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.2 text-[10px] font-mono text-neutral-400 bg-white border border-neutral-200 rounded">
            /
          </kbd>
        </button>

        {/* Grid Status Telemetry Pill (Restrained Industrial Style) */}
        <div className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded border border-emerald-200/70 bg-emerald-50/60 text-emerald-800 text-[11px] font-mono">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="font-semibold">Grid Synchronized</span>
          <span className="text-emerald-500 text-[10px]">•</span>
          <span className="text-emerald-700 font-medium">50 Hz</span>
        </div>

        {/* User Profile Menu with Demo Persona Switcher */}
        <UserMenu session={session} />
      </div>
    </header>
  );
}
