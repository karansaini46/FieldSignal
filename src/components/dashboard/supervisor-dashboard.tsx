"use client";

import React from "react";
import Link from "next/link";
import {
  ShieldAlert,
  Clock,
  Layers,
  ArrowRight,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Users,
  Cpu,
  ChevronRight,
  Filter,
  Activity,
  FileCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SupervisorDashboardProps {
  supervisorName: string;
  siteName: string;
  siteCode: string;
  capacityMw: number;
  openCount: number;
  inProgressCount: number;
  criticalCount: number;
  totalAssetsCount: number;
  faultedAssetsCount: number;
  recentIncidents: Array<{
    id: string;
    ticketNumber: string;
    title: string;
    priority: string;
    status: string;
    faultCategory: string;
    createdAt: Date | string;
    site: { name: string; code: string };
    asset?: { assetTag: string; name: string } | null;
    reportedBy: { name: string; role: string };
    assignedTo?: { name: string; role: string } | null;
  }>;
  clarificationsCount?: number;
}

// Realistic operational crew roster for Bhadla / Pavagada
const DEMO_CREW = [
  {
    name: "Rajesh Meena",
    role: "Technician Lead",
    zone: "Block 04 (Inverter Bay)",
    currentTask: "BHA-INV-01 (IGBT Over-temp)",
    radio: "Ch 03",
    status: "ON_SITE",
  },
  {
    name: "Suresh Gurjar",
    role: "Electrical Technician",
    zone: "Substation #1 (33kV Switchyard)",
    currentTask: "BHA-TR-01 (Insulation degradation)",
    radio: "Ch 03",
    status: "ON_SITE",
  },
  {
    name: "Praveen Kumar",
    role: "Field Technician",
    zone: "Block 02 (Array Trackers)",
    currentTask: "Preventive Inspection",
    radio: "Ch 02",
    status: "STANDBY",
  },
];

export function SupervisorDashboard({
  supervisorName,
  siteName,
  siteCode,
  capacityMw,
  openCount,
  inProgressCount,
  criticalCount,
  totalAssetsCount,
  faultedAssetsCount,
  recentIncidents,
  clarificationsCount = 0,
}: SupervisorDashboardProps) {
  const priorityStyles: Record<string, string> = {
    CRITICAL: "bg-rose-50 text-rose-800 border-rose-200",
    HIGH: "bg-amber-50 text-amber-800 border-amber-200",
    MEDIUM: "bg-blue-50 text-blue-800 border-blue-200",
    LOW: "bg-neutral-100 text-neutral-700 border-neutral-200",
  };

  const statusStyles: Record<string, string> = {
    OPEN: "bg-neutral-100 text-neutral-800 border-neutral-300",
    ASSIGNED: "bg-amber-50 text-amber-800 border-amber-200",
    IN_PROGRESS: "bg-blue-50 text-blue-800 border-blue-200",
    RESOLVED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  };

  const operationalAssetsCount = Math.max(0, totalAssetsCount - faultedAssetsCount);
  const availabilityRate = totalAssetsCount > 0
    ? (((totalAssetsCount - faultedAssetsCount) / totalAssetsCount) * 100).toFixed(1)
    : "100.0";

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* 1. Header & Operational Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-600" />
            <span className="text-xs font-mono font-semibold text-neutral-500 uppercase tracking-wider">
              Supervisor Operations &amp; Triage
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 mt-0.5">
            {siteName}
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5 font-mono">
            Plant Code: <span className="text-neutral-900 font-semibold">{siteCode}</span> •{" "}
            Capacity: <span className="text-neutral-900 font-semibold">{capacityMw} MW</span> •{" "}
            Supervisor: <span className="text-neutral-900 font-medium">{supervisorName}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/field"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-medium text-neutral-700 shadow-2xs"
          >
            <Radio className="h-3.5 w-3.5 text-amber-600" />
            <span>Voice Field Mode</span>
          </Link>
          <Link
            href="/incidents"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold shadow-2xs"
          >
            <span>All Incidents</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* 2. Operational Metrics Ribbon (Strictly Real Numbers, No Generic AI Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Metric 1: Pending Triage */}
        <div className="rounded-lg border border-neutral-200 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-neutral-500 text-xs">
            <span>Pending Triage</span>
            <Clock className="h-3.5 w-3.5 text-amber-600" />
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-neutral-900">{openCount}</div>
          <p className="text-[10px] text-neutral-500 font-mono mt-0.5">Requiring crew assignment</p>
        </div>

        {/* Metric 2: Active Field Repairs */}
        <div className="rounded-lg border border-neutral-200 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-neutral-500 text-xs">
            <span>Active In-Progress</span>
            <Activity className="h-3.5 w-3.5 text-blue-600" />
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-neutral-900">
            {inProgressCount}
          </div>
          <p className="text-[10px] text-neutral-500 font-mono mt-0.5">Technicians executing on-site</p>
        </div>

        {/* Metric 3: Critical Priority Alarms */}
        <div className="rounded-lg border border-neutral-200 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-neutral-500 text-xs">
            <span>Critical Alarms</span>
            <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-rose-700">{criticalCount}</div>
          <p className="text-[10px] text-neutral-500 font-mono mt-0.5">High inverter/grid priority</p>
        </div>

        {/* Metric 4: Plant Equipment Health */}
        <div className="rounded-lg border border-neutral-200 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-neutral-500 text-xs">
            <span>Asset Availability</span>
            <Layers className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-emerald-700">
            {availabilityRate}%
          </div>
          <p className="text-[10px] text-neutral-500 font-mono mt-0.5">
            {operationalAssetsCount}/{totalAssetsCount} equipment operational
          </p>
        </div>
      </div>

      {/* 3. Main Operational Sections: Incident Triage & Equipment Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 spans): Incident Triage Queue */}
        <section className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wide">
                Live Incident Triage Queue
              </h2>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200">
                {recentIncidents.length} Tickets
              </span>
            </div>
            <Link
              href="/incidents"
              className="text-xs font-semibold text-neutral-600 hover:text-neutral-900 flex items-center gap-1"
            >
              <span>Full Incident Board</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-mono text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">TICKET</th>
                    <th className="py-2.5 px-3 font-semibold">ASSET</th>
                    <th className="py-2.5 px-3 font-semibold">FAULT / SYMPTOMS</th>
                    <th className="py-2.5 px-3 font-semibold">PRIORITY</th>
                    <th className="py-2.5 px-3 font-semibold">ASSIGNED TO</th>
                    <th className="py-2.5 px-3 font-semibold text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {recentIncidents.map((incident) => (
                    <tr key={incident.id} className="hover:bg-neutral-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-neutral-900 whitespace-nowrap">
                        {incident.ticketNumber}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-neutral-800 whitespace-nowrap">
                        {incident.asset?.assetTag || "Site-Wide"}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-neutral-900 line-clamp-1">
                          {incident.title}
                        </div>
                        <div className="text-[10px] text-neutral-500 font-mono">
                          {incident.faultCategory.replace(/_/g, " ")}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={cn(
                            "px-1.5 py-0.2 rounded text-[10px] font-mono font-bold border",
                            priorityStyles[incident.priority] || priorityStyles.MEDIUM
                          )}
                        >
                          {incident.priority}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-neutral-700">
                        {incident.assignedTo ? (
                          <span className="font-medium">{incident.assignedTo.name}</span>
                        ) : (
                          <span className="text-amber-700 font-mono text-[11px] font-semibold">
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <Link
                          href={`/incidents?selected=${incident.id}`}
                          className="font-medium text-neutral-900 hover:text-amber-600 transition-colors inline-flex items-center gap-1"
                        >
                          <span>Review</span>
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Right Column: Crew Dispatch Roster & Telemetry Feed */}
        <section className="space-y-4">
          {/* Dispatch Crew Roster (Identified Demo Data) */}
          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-neutral-600" />
                <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wide">
                  On-Shift Field Crew
                </h3>
              </div>
              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-neutral-100 text-neutral-500 border border-neutral-200">
                Demo Roster
              </span>
            </div>

            <div className="space-y-2.5">
              {DEMO_CREW.map((member) => (
                <div
                  key={member.name}
                  className="p-2.5 rounded border border-neutral-100 bg-neutral-50 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-neutral-900">{member.name}</span>
                    <span className="text-[10px] font-mono text-emerald-700 font-bold flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {member.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-600 font-mono">Zone: {member.zone}</div>
                  <div className="text-[10px] text-neutral-500 flex items-center justify-between">
                    <span className="truncate max-w-[180px]">Task: {member.currentTask}</span>
                    <span className="font-mono text-neutral-400">{member.radio}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Equipment Topology Link */}
          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Cpu className="h-4 w-4 text-neutral-600" />
                <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wide">
                  Equipment Health Matrix
                </h3>
              </div>
              <Link href="/assets" className="text-xs font-semibold text-neutral-900 hover:underline">
                View Assets
              </Link>
            </div>
            <p className="text-xs text-neutral-600">
              Track central inverters, step-up transformers, and combiner boxes for{" "}
              <span className="font-semibold text-neutral-900">{siteName}</span>.
            </p>
            <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-xs font-mono">
              <span className="text-neutral-500">Faulted Units:</span>
              <span className="font-bold text-rose-700">{faultedAssetsCount}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
