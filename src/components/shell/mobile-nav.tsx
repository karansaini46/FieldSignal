"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShellUserSession, SiteSummary } from "./types";
import {
  Sun,
  X,
  Mic,
  LayoutDashboard,
  ClipboardList,
  Layers,
  Shield,
  Radio,
  LogOut,
  Building,
  User,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileNavProps {
  session: ShellUserSession;
  sites: SiteSummary[];
  isOpen: boolean;
  onClose: () => void;
  openTicketsCount?: number;
}

export function MobileNav({
  session,
  sites,
  isOpen,
  onClose,
  openTicketsCount = 0,
}: MobileNavProps) {
  const pathname = usePathname();

  // Prevent background scrolling when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Bottom bar navigation items tailored to the role
  const bottomBarItems =
    session.role === "TECHNICIAN"
      ? [
          {
            title: "Field PTT",
            href: "/field",
            icon: Mic,
            isPrimary: true,
          },
          {
            title: "Work Orders",
            href: "/incidents",
            icon: ClipboardList,
            badge: openTicketsCount > 0 ? openTicketsCount : undefined,
          },
          {
            title: "Equipment",
            href: "/assets",
            icon: Layers,
          },
        ]
      : session.role === "SUPERVISOR"
      ? [
          {
            title: "Triage",
            href: "/dashboard",
            icon: LayoutDashboard,
          },
          {
            title: "Tickets",
            href: "/incidents",
            icon: ClipboardList,
            badge: openTicketsCount > 0 ? openTicketsCount : undefined,
          },
          {
            title: "Equipment",
            href: "/assets",
            icon: Layers,
          },
          {
            title: "Field Mode",
            href: "/field",
            icon: Radio,
          },
        ]
      : [
          {
            title: "Portfolio",
            href: "/dashboard",
            icon: LayoutDashboard,
          },
          {
            title: "Incidents",
            href: "/incidents",
            icon: ClipboardList,
          },
          {
            title: "Assets",
            href: "/assets",
            icon: Layers,
          },
          {
            title: "Admin",
            href: "/dashboard/admin",
            icon: Shield,
          },
        ];

  return (
    <>
      {/* 1. Mobile Bottom Thumb Bar (Fixed at bottom on phones < 768px) */}
      <nav
        aria-label="Mobile Bottom Bar"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-white border-t border-neutral-200 px-2 flex items-center justify-around shadow-lg"
      >
        {bottomBarItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;

          if (item.isPrimary) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center -mt-4"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-600 text-white shadow-md shadow-amber-600/30 hover:bg-amber-500 active:scale-95 transition-all">
                  <Icon className="h-6 w-6" />
                </div>
                <span className="text-[10px] font-bold text-amber-700 mt-1">
                  {item.title}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center py-1 px-2 min-w-14 rounded-md transition-colors relative",
                isActive ? "text-neutral-900 font-semibold" : "text-neutral-500 hover:text-neutral-900"
              )}
            >
              <div className="relative">
                <Icon className={cn("h-5 w-5", isActive ? "text-neutral-900" : "text-neutral-400")} />
                {item.badge && (
                  <span className="absolute -top-1 -right-2 px-1 rounded-full bg-neutral-900 text-white font-mono text-[9px] font-bold">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5">{item.title}</span>
            </Link>
          );
        })}
      </nav>

      {/* 2. Slide-out Drawer Overlay */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-2xs transition-opacity"
            onClick={onClose}
          />

          {/* Drawer Panel */}
          <div className="relative flex flex-col w-4/5 max-w-xs bg-white h-full border-r border-neutral-200 shadow-2xl z-50 animate-in slide-in-from-left duration-200">
            {/* Header */}
            <div className="h-14 flex items-center justify-between px-4 border-b border-neutral-200">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded bg-amber-500 text-white">
                  <Sun className="h-4 w-4" />
                </div>
                <div className="flex flex-col leading-none">
                  <span className="font-bold text-sm text-neutral-900">FieldSignal</span>
                  <span className="text-[10px] text-neutral-500 font-mono mt-0.5">
                    {session.role} CONSOLE
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* User Details */}
            <div className="p-3.5 border-b border-neutral-100 bg-neutral-50/50">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-neutral-900 text-white font-mono text-xs font-bold">
                  {session.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-xs font-semibold text-neutral-900">{session.name}</div>
                  <div className="text-[10px] text-neutral-500 font-mono">{session.phone}</div>
                </div>
              </div>
              <div className="mt-2 text-[11px] text-neutral-600 flex items-center justify-between">
                <span>{session.organizationName || "Sunrise Solar"}</span>
                <span className="font-mono text-[10px] text-neutral-500">
                  {session.siteName || "All Sites Access"}
                </span>
              </div>
            </div>

            {/* Navigation Links */}
            <div className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
              <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                Navigation
              </span>

              {session.role === "TECHNICIAN" ? (
                <>
                  <Link
                    href="/field"
                    onClick={onClose}
                    className="flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium text-neutral-900 hover:bg-neutral-100"
                  >
                    <Mic className="h-4 w-4 text-amber-600" />
                    <span>Field Voice Reporting (PTT)</span>
                  </Link>
                  <Link
                    href="/incidents"
                    onClick={onClose}
                    className="flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                  >
                    <ClipboardList className="h-4 w-4 text-neutral-500" />
                    <span>Assigned Incidents</span>
                  </Link>
                  <Link
                    href="/assets"
                    onClick={onClose}
                    className="flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                  >
                    <Layers className="h-4 w-4 text-neutral-500" />
                    <span>Solar Equipment Registry</span>
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/dashboard"
                    onClick={onClose}
                    className="flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium text-neutral-900 hover:bg-neutral-100"
                  >
                    <LayoutDashboard className="h-4 w-4 text-neutral-500" />
                    <span>Triage Dashboard</span>
                  </Link>
                  <Link
                    href="/incidents"
                    onClick={onClose}
                    className="flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                  >
                    <ClipboardList className="h-4 w-4 text-neutral-500" />
                    <span>Incident Operations</span>
                  </Link>
                  <Link
                    href="/assets"
                    onClick={onClose}
                    className="flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                  >
                    <Layers className="h-4 w-4 text-neutral-500" />
                    <span>Equipment Registry</span>
                  </Link>
                  {session.role === "ADMIN" && (
                    <Link
                      href="/dashboard/admin"
                      onClick={onClose}
                      className="flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                    >
                      <Shield className="h-4 w-4 text-purple-600" />
                      <span>Administration & RBAC</span>
                    </Link>
                  )}
                  <Link
                    href="/field"
                    onClick={onClose}
                    className="flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                  >
                    <Radio className="h-4 w-4 text-amber-600" />
                    <span>Voice Field Console</span>
                  </Link>
                </>
              )}
            </div>

            {/* Logout Footer */}
            <div className="p-3 border-t border-neutral-200">
              <button
                type="button"
                onClick={async () => {
                  await fetch("/api/v1/auth/logout", { method: "POST" });
                  window.location.href = "/login";
                }}
                className="flex w-full items-center gap-2 px-3 py-2 rounded text-xs font-medium text-rose-700 hover:bg-rose-50"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
