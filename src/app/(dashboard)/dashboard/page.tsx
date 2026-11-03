import React from "react";
import Link from "next/link";
import { getSessionFromCookies } from "@/lib/session";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { ShieldAlert, ClipboardList, CheckCircle2, Clock, Layers, ArrowRight } from "lucide-react";

export default async function DashboardPage() {
  const session = await getSessionFromCookies();

  // Multi-tenant scoped query
  const where: Prisma.IncidentWhereInput = {
    site: {
      organizationId: session?.organizationId ?? "",
    },
  };

  if (session?.role === "SUPERVISOR" && session.siteId) {
    where.siteId = session.siteId;
  }

  const [openCount, inProgressCount, criticalCount, recentIncidents] = await Promise.all([
    db.incident.count({ where: { ...where, status: "OPEN" } }),
    db.incident.count({ where: { ...where, status: "IN_PROGRESS" } }),
    db.incident.count({ where: { ...where, priority: "CRITICAL" } }),
    db.incident.findMany({
      where,
      include: {
        site: { select: { name: true, code: true } },
        asset: { select: { assetTag: true, name: true } },
        reportedBy: { select: { name: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 sm:px-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Operations Triage Dashboard
            </h1>
            <Badge variant="outline" className="text-xs">
              {session?.role}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Scoped to Organization:{" "}
            <span className="font-semibold text-foreground">Sunrise Solar Operations</span>
            {session?.siteId ? ` • Site ID: ${session.siteId}` : " • Portfolio (All Sites)"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/incidents"
            className={buttonVariants({
              variant: "outline",
              size: "sm",
              className: "text-xs gap-1.5",
            })}
          >
            <ClipboardList className="h-3.5 w-3.5" />
            <span>View All Tickets</span>
          </Link>
          <Link
            href="/field"
            className={buttonVariants({
              variant: "default",
              size: "sm",
              className: "text-xs gap-1.5",
            })}
          >
            <span>Voice Field Mode</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs flex items-center justify-between">
              <span>Open & Pending Triage</span>
              <Clock className="h-4 w-4 text-amber-600" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-amber-700">{openCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-muted-foreground">Requiring technician assignment</p>
          </CardContent>
        </Card>

        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs flex items-center justify-between">
              <span>Work In Progress</span>
              <CheckCircle2 className="h-4 w-4 text-blue-600" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-blue-700">{inProgressCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-muted-foreground">Field technician repairs active</p>
          </CardContent>
        </Card>

        <Card className="border-rose-500/20 bg-rose-500/5">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs flex items-center justify-between">
              <span>Critical Severity Incidents</span>
              <ShieldAlert className="h-4 w-4 text-rose-600" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-rose-700">{criticalCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-muted-foreground">Immediate generation / safety risk</p>
          </CardContent>
        </Card>
      </div>

      {/* Live Ticket Feed */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            <span>Recent Maintenance Incidents</span>
          </h2>
          <span className="text-xs text-muted-foreground">
            Server-side isolated to your organization
          </span>
        </div>

        <div className="space-y-3">
          {recentIncidents.map((incident) => (
            <div
              key={incident.id}
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-lg border bg-card p-4 transition hover:bg-muted/40 gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-foreground">
                    {incident.ticketNumber}
                  </span>
                  <Badge
                    variant={incident.priority === "CRITICAL" ? "destructive" : "outline"}
                    className="text-[10px]"
                  >
                    {incident.priority}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    {incident.status}
                  </Badge>
                  {incident.asset && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Layers className="h-3 w-3" />
                      <span>{incident.asset.assetTag}</span>
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-foreground">{incident.title}</p>
                <p className="text-xs text-muted-foreground">
                  Site: <span className="text-foreground">{incident.site.name}</span> • Reported by{" "}
                  {incident.reportedBy.name}
                </p>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <Link
                  href={`/incidents`}
                  className={buttonVariants({
                    variant: "outline",
                    size: "sm",
                    className: "text-xs",
                  })}
                >
                  Manage Ticket
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
