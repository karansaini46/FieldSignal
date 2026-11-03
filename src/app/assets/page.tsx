import React from "react";
import { getSessionFromCookies } from "@/lib/session";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MapPin, CheckCircle2, AlertTriangle, Cpu } from "lucide-react";

export default async function AssetsPage() {
  const session = await getSessionFromCookies();

  const where: Prisma.AssetWhereInput = {
    site: {
      organizationId: session?.organizationId ?? "",
    },
  };

  if (session?.role === "TECHNICIAN" && session.siteId) {
    where.siteId = session.siteId;
  } else if (session?.role === "SUPERVISOR" && session.siteId) {
    where.siteId = session.siteId;
  }

  const assets = await db.asset.findMany({
    where,
    include: {
      site: { select: { name: true, code: true } },
      parentAsset: { select: { assetTag: true, name: true } },
      children: { select: { id: true, assetTag: true, name: true } },
    },
    orderBy: [{ siteId: "asc" }, { block: "asc" }, { assetTag: "asc" }],
  });

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Solar Equipment Registry
          </h1>
          <Badge variant="outline" className="text-xs">
            {assets.length} Assets
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Hierarchical asset tree isolated to your organization:{" "}
          <span className="font-semibold text-foreground">Sunrise Solar Operations</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {assets.map((asset) => (
          <Card key={asset.id} className="transition hover:border-foreground/20">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-foreground">
                    {asset.assetTag}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">
                    {asset.assetType}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  {asset.status === "OPERATIONAL" ? (
                    <span className="text-emerald-600 font-medium flex items-center gap-1 text-[11px]">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Operational</span>
                    </span>
                  ) : (
                    <span className="text-amber-600 font-medium flex items-center gap-1 text-[11px]">
                      <AlertTriangle className="h-3 w-3" />
                      <span>{asset.status}</span>
                    </span>
                  )}
                </div>
              </div>

              <CardTitle className="text-sm font-semibold mt-1">{asset.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span>Site: {asset.site.name}</span>
                </span>
                <span>
                  Block: {asset.block} {asset.row ? `• ${asset.row}` : ""}
                </span>
              </div>

              {asset.manufacturer && (
                <div className="flex items-center gap-2 pt-2 border-t text-[11px]">
                  <Cpu className="h-3 w-3 text-primary" />
                  <span>
                    {asset.manufacturer} {asset.model ? `(${asset.model})` : ""}
                  </span>
                  {asset.ratedCapacityKw && (
                    <span className="font-medium text-foreground">
                      • {asset.ratedCapacityKw} kW
                    </span>
                  )}
                </div>
              )}

              {asset.children && asset.children.length > 0 && (
                <div className="pt-2 text-[11px]">
                  <span className="font-medium text-foreground">
                    Connected Downstream Components:
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {asset.children.map((c) => (
                      <Badge key={c.id} variant="outline" className="text-[10px]">
                        {c.assetTag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
