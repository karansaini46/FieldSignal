"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShellUserSession, NavItem } from "./types";
import {
  Sun,
  Radio,
  ClipboardList,
  Layers,
  LayoutDashboard,
  Shield,
  Users,
  ChevronLeft,
  ChevronRight,
  Activity,
  Mic,
  SlidersHorizontal,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  session: ShellUserSession;
  collapsed: boolean;
  onToggleCollapse: () => void;
  className?: string;
  openTicketsCount?: number;
  criticalTicketsCount?: number;
}

export function Sidebar({
  session,
  collapsed,
  onToggleCollapse,
  className,
  openTicketsCount = 0,
  criticalTicketsCount = 0,
}: SidebarProps) {
  const pathname = usePathname();

  // Role-specific navigation definitions
  const technicianItems: NavItem[] = [
    {
      title: "Field Voice Console",
      href: "/field",
      icon: Mic,
      isAction: true,
      badge: "PTT",
      badgeVariant: "default",
    },
    {
      title: "Assigned Work Orders",
      href: "/incidents",
      icon: ClipboardList,
      badge: openTicketsCount > 0 ? openTicketsCount : undefined,
      badgeVariant: "secondary",
    },
    {
      title: "Equipment & Tags",
      href: "/assets",
      icon: Layers,
    },
  ];

  const supervisorItems: NavItem[] = [
    {
      title: "Triage & Dispatch",
      href: "/dashboard",
      icon: LayoutDashboard,
      badge: criticalTicketsCount > 0 ? `${criticalTicketsCount} Crit` : undefined,
      badgeVariant: criticalTicketsCount > 0 ? "destructive" : undefined,
    },
    {
      title: "Site Incidents",
      href: "/incidents",
      icon: ClipboardList,
      badge: openTicketsCount > 0 ? openTicketsCount : undefined,
      badgeVariant: "secondary",
    },
    {
      title: "Equipment Registry",
      href: "/assets",
      icon: Layers,
    },
    {
      title: "Voice Field Mode",
      href: "/field",
      icon: Radio,
    },
  ];

  const adminItems: NavItem[] = [
    {
      title: "Portfolio Overview",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "All Site Incidents",
      href: "/incidents",
      icon: ClipboardList,
      badge: openTicketsCount > 0 ? openTicketsCount : undefined,
      badgeVariant: "secondary",
    },
    {
      title: "Asset Hierarchy",
      href: "/assets",
      icon: Layers,
    },
    {
      title: "Administration & RBAC",
      href: "/dashboard/admin",
      icon: Shield,
    },
    {
      title: "Field Voice Mode",
      href: "/field",
      icon: Radio,
    },
  ];

  const navItems =
    session.role === "TECHNICIAN"
      ? technicianItems
      : session.role === "SUPERVISOR"
      ? supervisorItems
      : adminItems;

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col border-r border-neutral-200 bg-white transition-all duration-200 select-none",
        collapsed ? "w-16" : "w-60",
        className
      )}
    >
      {/* Brand Header */}
      <div className="h-14 flex items-center justify-between px-3.5 border-b border-neutral-200">
        <Link href="/" className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-amber-500 text-white font-bold shrink-0 shadow-2xs">
            <Sun className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-none">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-neutral-900 tracking-tight">
                  FieldSignal
                </span>
                <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-neutral-100 text-neutral-600 border border-neutral-200">
                  O&amp;M
                </span>
              </div>
              <span className="text-[10px] text-neutral-500 font-mono mt-0.5">Solar Operations</span>
            </div>
          )}
        </Link>
      </div>

      {/* Role Navigation Group */}
      <div className="flex-1 py-3 px-2 space-y-4 overflow-y-auto">
        <div>
          {!collapsed && (
            <div className="px-2.5 pb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                {session.role} CONSOLE
              </span>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
          )}

          <nav className="space-y-0.5">
            {navItems.map((item) => {
              const isActive =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);

              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.title : undefined}
                  className={cn(
                    "flex items-center rounded-md text-xs transition-colors group relative",
                    collapsed ? "h-10 justify-center px-0" : "h-9 px-2.5 gap-2.5",
                    isActive
                      ? "bg-neutral-100 text-neutral-900 font-semibold"
                      : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 font-medium"
                  )}
                >
                  {/* Subtle active left indicator bar */}
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-0.75 bg-neutral-900 rounded-r" />
                  )}

                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      item.isAction ? "text-amber-600" : isActive ? "text-neutral-900" : "text-neutral-400 group-hover:text-neutral-700"
                    )}
                  />

                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate">{item.title}</span>
                      {item.badge && (
                        <span
                          className={cn(
                            "px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold border",
                            item.badgeVariant === "destructive"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : item.badgeVariant === "default"
                              ? "bg-amber-600 text-white border-amber-600"
                              : "bg-neutral-100 text-neutral-700 border-neutral-200"
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Operational Scope Details (Expanded only) */}
        {!collapsed && (
          <div className="pt-2 border-t border-neutral-100 px-2 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
              Active Plant Scope
            </span>
            <div className="rounded border border-neutral-200/80 bg-neutral-50/70 p-2 text-[11px] space-y-1">
              <div className="flex items-center justify-between text-neutral-700">
                <span className="font-semibold text-neutral-900">
                  {session.siteName || (session.role === "ADMIN" ? "All Solar Plants" : "Assigned Plant")}
                </span>
              </div>
              <div className="text-[10px] font-mono text-neutral-500 flex items-center justify-between">
                <span>SCADA Link:</span>
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Online (99.8%)
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Collapse Toggle Footer */}
      <div className="p-2 border-t border-neutral-200 flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-1.5 px-2 text-[10px] text-neutral-500 font-mono">
            <Activity className="h-3 w-3 text-emerald-600 shrink-0" />
            <span className="truncate">Telemetry Sync: 1.2s</span>
          </div>
        )}

        <button
          type="button"
          onClick={onToggleCollapse}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-500 hover:text-neutral-900 transition-colors",
            collapsed && "mx-auto"
          )}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}
