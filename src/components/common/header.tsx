import React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getSessionFromCookies } from "@/lib/session";
import { LogoutButton } from "@/components/common/logout-button";
import {
  Sun,
  Shield,
  Layers,
  Radio,
  LogIn,
  LayoutDashboard,
  ClipboardList,
} from "lucide-react";

export async function Header() {
  const session = await getSessionFromCookies();

  const roleBadgeVariant: Record<string, "default" | "secondary" | "outline"> = {
    ADMIN: "default",
    SUPERVISOR: "outline",
    TECHNICIAN: "secondary",
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-8">
        {/* Brand & Solar Context */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 transition hover:opacity-90">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20">
              <Sun className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-bold tracking-tight text-foreground">
                <span>FieldSignal</span>
                <Badge
                  variant="outline"
                  className="text-[10px] font-semibold text-amber-600 border-amber-500/30"
                >
                  Solar O&M
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">Voice Fault Intelligence</p>
            </div>
          </Link>

          {/* Role-Based Navigation Links */}
          {session && (
            <nav className="hidden md:flex items-center gap-1 text-xs">
              {session.role === "TECHNICIAN" && (
                <>
                  <Link
                    href="/field"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-foreground hover:bg-muted font-medium"
                  >
                    <Radio className="h-3.5 w-3.5 text-amber-500" />
                    <span>Field Mode (Voice)</span>
                  </Link>
                  <Link
                    href="/incidents"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    <ClipboardList className="h-3.5 w-3.5" />
                    <span>Site Incidents</span>
                  </Link>
                </>
              )}

              {session.role === "SUPERVISOR" && (
                <>
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-foreground hover:bg-muted font-medium"
                  >
                    <LayoutDashboard className="h-3.5 w-3.5 text-blue-500" />
                    <span>Triage Dashboard</span>
                  </Link>
                  <Link
                    href="/incidents"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    <ClipboardList className="h-3.5 w-3.5" />
                    <span>Incidents</span>
                  </Link>
                  <Link
                    href="/assets"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    <Layers className="h-3.5 w-3.5" />
                    <span>Equipment</span>
                  </Link>
                </>
              )}

              {session.role === "ADMIN" && (
                <>
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-foreground hover:bg-muted font-medium"
                  >
                    <LayoutDashboard className="h-3.5 w-3.5 text-purple-500" />
                    <span>Portfolio Overview</span>
                  </Link>
                  <Link
                    href="/incidents"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    <ClipboardList className="h-3.5 w-3.5" />
                    <span>All Incidents</span>
                  </Link>
                  <Link
                    href="/assets"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    <Layers className="h-3.5 w-3.5" />
                    <span>Asset Hierarchy</span>
                  </Link>
                  <Link
                    href="/dashboard/admin"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    <Shield className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Administration</span>
                  </Link>
                </>
              )}
            </nav>
          )}
        </div>

        {/* User Context & Session Actions */}
        <div className="flex items-center gap-3">
          {session ? (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-xs font-semibold text-foreground">{session.name}</span>
                  <Badge
                    variant={roleBadgeVariant[session.role] || "secondary"}
                    className="text-[10px] py-0 px-1.5"
                  >
                    {session.role}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {session.role === "ADMIN" ? "All Sites Access" : "Site Scoped"}
                </p>
              </div>

              <LogoutButton />
            </div>
          ) : (
            <Link
              id="header-sign-in-link"
              href="/login"
              className={buttonVariants({
                variant: "default",
                size: "sm",
                className: "text-xs gap-1.5",
              })}
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Sign In</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
