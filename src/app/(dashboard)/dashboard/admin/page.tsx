import React from "react";
import { getSessionFromCookies } from "@/lib/session";
import { requireRole } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, MapPin, Phone, Mail } from "lucide-react";

export default async function AdminPage() {
  const session = await getSessionFromCookies();
  if (session) {
    requireRole(["ADMIN"], session);
  }

  const users = await db.user.findMany({
    where: { organizationId: session?.organizationId ?? "" },
    include: {
      site: { select: { name: true, code: true } },
      organization: { select: { name: true } },
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Organization Administration
            </h1>
            <Badge variant="default" className="text-xs bg-purple-600">
              Admin Only
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Manage personnel, roles, and site permissions across your solar portfolio.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span>Personnel & Access Directory ({users.length} Users)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y text-xs">
            {users.map((u) => (
              <div
                key={u.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground text-sm">{u.name}</span>
                    <Badge
                      variant={
                        u.role === "ADMIN"
                          ? "default"
                          : u.role === "SUPERVISOR"
                            ? "outline"
                            : "secondary"
                      }
                      className="text-[10px]"
                    >
                      {u.role}
                    </Badge>
                    {u.isActive ? (
                      <span className="text-[10px] text-emerald-600 font-medium">Active</span>
                    ) : (
                      <span className="text-[10px] text-rose-600 font-medium">Inactive</span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-muted-foreground mt-1 text-[11px]">
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      <span>{u.phone}</span>
                    </span>
                    {u.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        <span>{u.email}</span>
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      <span>{u.site ? u.site.name : "Portfolio Level (All Sites)"}</span>
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-muted-foreground">
                  Joined: {new Date(u.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
