import React from "react";
import { getSessionFromCookies } from "@/lib/session";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Layers, MapPin, Clock, User, ShieldAlert } from "lucide-react";

export default async function IncidentsPage() {
  const session = await getSessionFromCookies();

  const where: Prisma.IncidentWhereInput = {
    site: {
      organizationId: session?.organizationId ?? "",
    },
  };

  // If technician or site supervisor with assigned site, scope to site
  if (session?.role === "TECHNICIAN" && session.siteId) {
    where.siteId = session.siteId;
  } else if (session?.role === "SUPERVISOR" && session.siteId) {
    where.siteId = session.siteId;
  }

  const incidents = await db.incident.findMany({
    where,
    include: {
      site: { select: { name: true, code: true } },
      asset: { select: { assetTag: true, name: true, block: true } },
      reportedBy: { select: { name: true, role: true } },
      assignedTo: { select: { name: true, role: true } },
      events: {
        take: 1,
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Maintenance Incidents
            </h1>
            <Badge variant="outline" className="text-xs">
              {incidents.length} Tickets
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Data isolated to Organization:{" "}
            <span className="font-semibold text-foreground">Sunrise Solar Operations</span>
            {session?.siteId ? ` • Site ID: ${session.siteId}` : " • All Authorized Sites"}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {incidents.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No incidents found matching your authorized scope.
            </CardContent>
          </Card>
        ) : (
          incidents.map((incident) => (
            <Card key={incident.id} className="transition hover:border-foreground/20">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
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
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      <span>{incident.site.name}</span>
                    </span>
                  </div>

                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{new Date(incident.createdAt).toLocaleDateString()}</span>
                  </span>
                </div>

                <CardTitle className="text-base font-semibold mt-2">{incident.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <p className="text-muted-foreground leading-relaxed">{incident.description}</p>

                {incident.originalTranscript && (
                  <div className="rounded-md border bg-muted/30 p-2.5 text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground block mb-0.5">
                      Immutable Voice Transcript:
                    </span>
                    &ldquo;{incident.originalTranscript}&rdquo;
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between pt-2 border-t gap-2 text-muted-foreground">
                  <div className="flex items-center gap-4">
                    {incident.asset && (
                      <span className="flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5 text-primary" />
                        <span>
                          Asset: {incident.asset.assetTag} ({incident.asset.block})
                        </span>
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      <span>Reported: {incident.reportedBy.name}</span>
                    </span>
                  </div>

                  {incident.assignedTo ? (
                    <span className="font-medium text-foreground">
                      Assigned to: {incident.assignedTo.name} ({incident.assignedTo.role})
                    </span>
                  ) : (
                    <span className="text-amber-600 font-medium flex items-center gap-1">
                      <ShieldAlert className="h-3 w-3" />
                      <span>Unassigned</span>
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
