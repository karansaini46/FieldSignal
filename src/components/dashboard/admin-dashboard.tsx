"use client";

import React from "react";
import Link from "next/link";
import {
  Shield,
  Building2,
  Users,
  Layers,
  Cpu,
  Database,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Server,
  Activity,
  Mic,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SiteData {
  id: string;
  name: string;
  code: string;
  capacityMw: number;
  location: string | null;
  status: string;
  assetsCount: number;
  openIncidentsCount: number;
}

interface UserData {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  role: string;
  siteName?: string | null;
  isActive: boolean;
}

interface AdminDashboardProps {
  adminName: string;
  organizationName: string;
  sites: SiteData[];
  users: UserData[];
  totalIncidents: number;
  totalAssets: number;
}

export function AdminDashboard({
  adminName,
  organizationName,
  sites,
  users,
  totalIncidents,
  totalAssets,
}: AdminDashboardProps) {
  const totalCapacityMw = sites.reduce((sum, s) => sum + s.capacityMw, 0);

  const roleBadgeStyles: Record<string, string> = {
    ADMIN: "bg-purple-50 text-purple-800 border-purple-200",
    SUPERVISOR: "bg-blue-50 text-blue-800 border-blue-200",
    TECHNICIAN: "bg-amber-50 text-amber-800 border-amber-200",
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* 1. Header & Portfolio Operations */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-purple-600" />
            <span className="text-xs font-mono font-semibold text-neutral-500 uppercase tracking-wider">
              Executive Portfolio Console
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 mt-0.5">
            {organizationName}
          </h1>
          <p className="text-xs text-neutral-500 font-mono mt-0.5">
            Portfolio Capacity:{" "}
            <span className="text-neutral-900 font-bold">{totalCapacityMw} MW</span> • Plants:{" "}
            <span className="text-neutral-900 font-bold">{sites.length} Facilities</span> •
            Administrator: <span className="text-neutral-900 font-medium">{adminName}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/admin"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-medium text-neutral-700 shadow-2xs"
          >
            <Shield className="h-3.5 w-3.5 text-purple-600" />
            <span>RBAC Matrix</span>
          </Link>
          <Link
            href="/assets"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold shadow-2xs"
          >
            <span>Asset Registry</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* 2. Portfolio Sites Grid */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wide">
              Operational Solar Facilities
            </h2>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200">
              {sites.length} Active
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sites.map((site) => (
            <div
              key={site.id}
              className="rounded-lg border border-neutral-200 bg-white p-4 space-y-3 shadow-2xs hover:border-neutral-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-neutral-900">{site.name}</h3>
                    <span className="font-mono text-[10px] px-1 py-0.2 rounded bg-neutral-100 text-neutral-600 border border-neutral-200">
                      {site.code}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3 text-neutral-400" />
                    <span>{site.location}</span>
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {site.status}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-neutral-100 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-neutral-400 font-sans block">Capacity</span>
                  <span className="font-bold text-neutral-900">{site.capacityMw} MW</span>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 font-sans block">Equipment</span>
                  <span className="font-bold text-neutral-900">{site.assetsCount} Units</span>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 font-sans block">Open Tickets</span>
                  <span className={cn("font-bold", site.openIncidentsCount > 0 ? "text-amber-700" : "text-emerald-700")}>
                    {site.openIncidentsCount} Alarms
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-xs">
                <Link
                  href={`/dashboard?siteId=${site.id}`}
                  className="font-medium text-neutral-600 hover:text-neutral-900 flex items-center gap-1"
                >
                  <span>Filter Dashboard to Site</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
                <Link
                  href={`/assets?siteId=${site.id}`}
                  className="text-neutral-500 hover:text-neutral-800"
                >
                  Inspect Assets
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. User Directory & RBAC Authorization Table */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-neutral-600" />
            <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wide">
              Team Directory &amp; RBAC Access Scopes
            </h2>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200">
              {users.length} Users
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-mono text-[11px]">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">NAME</th>
                  <th className="py-2.5 px-3 font-semibold">ROLE</th>
                  <th className="py-2.5 px-3 font-semibold">PHONE</th>
                  <th className="py-2.5 px-3 font-semibold">SITE SCOPE</th>
                  <th className="py-2.5 px-3 font-semibold text-right">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-neutral-900 whitespace-nowrap">
                      {user.name}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={cn(
                          "px-1.5 py-0.2 rounded text-[10px] font-mono font-bold border",
                          roleBadgeStyles[user.role] || "bg-neutral-100 text-neutral-700"
                        )}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-neutral-600 whitespace-nowrap">
                      {user.phone}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-700 whitespace-nowrap">
                      {user.siteName || (
                        <span className="text-neutral-500 font-mono text-[11px]">
                          Portfolio (All Plants)
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono text-[11px]">
                      {user.isActive ? (
                        <span className="text-emerald-700 font-medium">Active</span>
                      ) : (
                        <span className="text-neutral-400">Suspended</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 4. Platform Engine Health Strip */}
      <section className="rounded-lg border border-neutral-200 bg-white p-4 space-y-3 shadow-2xs">
        <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wide">
          Core Engine &amp; Integration Health
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded border border-neutral-200 bg-neutral-50/50 space-y-1">
            <div className="flex items-center justify-between text-neutral-500 font-mono text-[11px]">
              <span>Speech-To-Text API</span>
              <Mic className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <div className="font-semibold text-neutral-900">Gnani AI Voice Contract</div>
            <div className="text-[10px] text-emerald-700 font-mono font-medium flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Contract Ready (Hindi/Hinglish/English)
            </div>
          </div>

          <div className="p-3 rounded border border-neutral-200 bg-neutral-50/50 space-y-1">
            <div className="flex items-center justify-between text-neutral-500 font-mono text-[11px]">
              <span>Database Cluster</span>
              <Database className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <div className="font-semibold text-neutral-900">PostgreSQL (Prisma ORM)</div>
            <div className="text-[10px] text-emerald-700 font-mono font-medium flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Multi-tenant isolated &amp; connected
            </div>
          </div>

          <div className="p-3 rounded border border-neutral-200 bg-neutral-50/50 space-y-1">
            <div className="flex items-center justify-between text-neutral-500 font-mono text-[11px]">
              <span>RBAC Session Engine</span>
              <Lock className="h-3.5 w-3.5 text-purple-600" />
            </div>
            <div className="font-semibold text-neutral-900">Signed JWT (Jose HS256)</div>
            <div className="text-[10px] text-emerald-700 font-mono font-medium flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Role permissions strictly enforced
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
