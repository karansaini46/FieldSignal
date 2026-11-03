import React from "react";
import Link from "next/link";
import { getSessionFromCookies } from "@/lib/session";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/lib/db";
import { Mic, Radio, Clock, MapPin } from "lucide-react";

export default async function FieldPage() {
  const session = await getSessionFromCookies();

  const [assignedTickets, siteDetails] = await Promise.all([
    db.incident.findMany({
      where: {
        assignedToUserId: session?.userId,
        status: { in: ["ASSIGNED", "IN_PROGRESS"] },
      },
      include: {
        asset: { select: { assetTag: true, block: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    session?.siteId
      ? db.site.findUnique({
          where: { id: session.siteId },
          select: { name: true, code: true, capacityMw: true, location: true },
        })
      : null,
  ]);

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8 space-y-6">
      {/* Field Site Context Header */}
      <div className="rounded-xl border bg-muted/30 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-foreground">
              {siteDetails ? siteDetails.name : "Assigned Field Site"}
            </span>
          </div>
          <Badge variant="outline" className="text-[10px]">
            {session?.role}
          </Badge>
        </div>
        {siteDetails && (
          <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            <span>{siteDetails.location}</span> • <span>{Number(siteDetails.capacityMw)} MW</span>
          </p>
        )}
      </div>

      {/* Voice Fault Reporting Trigger Card */}
      <Card className="border-amber-500/30 bg-amber-500/5 text-center p-6">
        <CardHeader className="space-y-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20 text-amber-600 ring-4 ring-amber-500/10">
            <Mic className="h-8 w-8" />
          </div>
          <CardTitle className="text-xl font-bold">Voice Fault Report</CardTitle>
          <CardDescription className="text-xs max-w-sm mx-auto">
            Bol kar fault report karein in Hindi, Hinglish, or English. Equipment tag aur error code
            bolna na bhoolein.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-xl bg-amber-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-600/30 transition hover:bg-amber-500 active:scale-95 gap-2"
          >
            <Mic className="h-4 w-4" />
            <span>Tap & Hold to Speak</span>
          </button>
        </CardContent>
      </Card>

      {/* My Active Field Assignments */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500" />
            <span>My Active Assignments ({assignedTickets.length})</span>
          </h2>
          <Link
            href="/incidents"
            className={buttonVariants({ variant: "ghost", size: "sm", className: "text-xs" })}
          >
            All Tickets
          </Link>
        </div>

        {assignedTickets.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
            No active repair tickets currently assigned to you.
          </div>
        ) : (
          <div className="space-y-2">
            {assignedTickets.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-lg border bg-card p-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-foreground">{t.ticketNumber}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {t.priority}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {t.status}
                    </Badge>
                  </div>
                  <p className="font-medium text-foreground mt-1">{t.title}</p>
                  {t.asset && (
                    <p className="text-[11px] text-muted-foreground">
                      Asset: {t.asset.assetTag} ({t.asset.block})
                    </p>
                  )}
                </div>

                <Link
                  href="/incidents"
                  className={buttonVariants({
                    variant: "outline",
                    size: "sm",
                    className: "text-xs",
                  })}
                >
                  Inspect
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
