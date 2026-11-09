import React from "react";
import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/session";
import { requireRole } from "@/lib/auth-guard";
import { getShellContext } from "@/lib/shell-context";
import { AppShell } from "@/components/shell/app-shell";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Users, MapPin, Phone, Mail, Shield, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function AdminPage() {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/login");
  }

  requireRole(["ADMIN"], session);

  const [shellData, users] = await Promise.all([
    getShellContext(session),
    db.user.findMany({
      where: { organizationId: session.organizationId },
      include: {
        site: { select: { name: true, code: true } },
        organization: { select: { name: true } },
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
  ]);

  if (!shellData) {
    redirect("/login");
  }

  const roleStyles: Record<string, string> = {
    ADMIN: "bg-purple-50 text-purple-800 border-purple-200",
    SUPERVISOR: "bg-blue-50 text-blue-800 border-blue-200",
    TECHNICIAN: "bg-amber-50 text-amber-800 border-amber-200",
  };

  return (
    <AppShell
      session={shellData.session}
      sites={shellData.sites}
      openTicketsCount={shellData.openTicketsCount}
      criticalTicketsCount={shellData.criticalTicketsCount}
    >
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-purple-600" />
              <span className="text-xs font-mono font-semibold text-neutral-500 uppercase tracking-wider">
                System Administration
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 mt-0.5">
              Access Scopes &amp; RBAC Directory
            </h1>
            <p className="text-xs text-neutral-500 font-mono mt-0.5">
              Organization: <span className="text-neutral-900 font-semibold">{shellData.session.organizationName}</span>
            </p>
          </div>
          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-purple-50 text-purple-800 border border-purple-200 self-start sm:self-auto">
            ADMIN ONLY
          </span>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-neutral-600" />
              <h2 className="text-xs font-bold uppercase tracking-wide text-neutral-900">
                Personnel &amp; Site Scopes ({users.length} Users)
              </h2>
            </div>
          </div>

          <div className="divide-y divide-neutral-100 text-xs">
            {users.map((u) => (
              <div
                key={u.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50/60 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-neutral-900 text-sm">{u.name}</span>
                    <span
                      className={cn(
                        "px-1.5 py-0.2 rounded text-[10px] font-mono font-bold border",
                        roleStyles[u.role] || "bg-neutral-100 text-neutral-700"
                      )}
                    >
                      {u.role}
                    </span>
                    {u.isActive ? (
                      <span className="text-[10px] font-mono text-emerald-700 font-medium">Active</span>
                    ) : (
                      <span className="text-[10px] font-mono text-rose-700 font-medium">Inactive</span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-neutral-500 text-[11px] font-mono">
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3 text-neutral-400" />
                      <span>{u.phone}</span>
                    </span>
                    {u.email && (
                      <span className="flex items-center gap-1 font-sans">
                        <Mail className="h-3 w-3 text-neutral-400" />
                        <span>{u.email}</span>
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-neutral-400" />
                      <span>{u.site ? u.site.name : "Portfolio Level (All Sites)"}</span>
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-neutral-400 font-mono">
                  Joined: {new Date(u.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
