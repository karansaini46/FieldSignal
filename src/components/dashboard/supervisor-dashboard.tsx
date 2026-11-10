"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  IncidentStatus,
  IncidentPriority,
  FaultCategory,
  AssetType,
  AssetStatus,
  IncidentEventType,
  ClarificationStatus,
  UserRole,
} from "@prisma/client";
import {
  INCIDENT_STATUS_META,
  INCIDENT_PRIORITY_META,
  FAULT_CATEGORY_LABELS,
} from "@/modules/incidents/types";
import { getAllowedTransitions } from "@/modules/incidents/state-machine";
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
  Search,
  X,
  RotateCcw,
  ExternalLink,
  History,
  FileText,
  Loader2,
  Check,
  SlidersHorizontal,
  ChevronDown,
  Repeat,
  Sparkles,
  Phone,
  ShieldCheck,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface IncidentItem {
  id: string;
  ticketNumber: string;
  siteId: string;
  assetId: string | null;
  reportedByUserId: string;
  assignedToUserId: string | null;
  status: IncidentStatus;
  priority: IncidentPriority;
  faultCategory: FaultCategory;
  title: string;
  description: string;
  symptoms: string | null;
  errorCode: string | null;
  originalTranscript: string | null;
  isRepeatFault: boolean;
  repeatCount30d: number;
  confirmedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  resolutionNotes: string | null;
  createdAt: string;
  updatedAt: string;
  site: { id: string; name: string; code: string };
  asset?: {
    id: string;
    assetTag: string;
    name: string;
    assetType: AssetType;
    block: string;
    row: string | null;
    status: AssetStatus;
  } | null;
  reportedBy: { id: string; name: string; role: UserRole; phone: string };
  assignedTo?: { id: string; name: string; role: UserRole; phone: string } | null;
  events: Array<{
    id: string;
    incidentId: string;
    userId: string;
    eventType: IncidentEventType;
    fromStatus: IncidentStatus | null;
    toStatus: IncidentStatus | null;
    title: string;
    description: string | null;
    diff?: unknown;
    createdAt: string;
    user: { id: string; name: string; role: UserRole };
  }>;
  clarifications: Array<{
    id: string;
    question: string;
    missingField: string | null;
    response: string | null;
    status: ClarificationStatus;
    createdAt: string;
    respondedAt: string | null;
    requestedBy?: { name: string } | null;
    respondedBy?: { name: string } | null;
  }>;
}

export interface ActivityItem {
  id: string;
  incidentId: string;
  userId: string;
  eventType: IncidentEventType;
  fromStatus: IncidentStatus | null;
  toStatus: IncidentStatus | null;
  title: string;
  description: string | null;
  diff?: unknown;
  createdAt: string;
  incident: {
    id: string;
    ticketNumber: string;
    title: string;
    priority: IncidentPriority;
    status: IncidentStatus;
  };
  user: {
    id: string;
    name: string;
    role: UserRole;
  };
}

export interface RecurringAssetItem {
  id: string;
  assetTag: string;
  name: string;
  assetType: AssetType;
  block: string;
  row: string | null;
  status: AssetStatus;
  incidentCount: number;
  hasRepeatFaultFlag: boolean;
  latestIncident: {
    id: string;
    ticketNumber: string;
    status: IncidentStatus;
    priority: IncidentPriority;
    title: string;
    createdAt: string;
  } | null;
}

export interface CrewMemberItem {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  site?: { name: string; code: string } | null;
  assignedIncidents: Array<{
    id: string;
    ticketNumber: string;
    priority: IncidentPriority;
    status: IncidentStatus;
  }>;
}

interface SupervisorDashboardProps {
  supervisorName: string;
  supervisorRole?: UserRole;
  supervisorUserId?: string;
  siteName: string;
  siteCode: string;
  siteId?: string;
  capacityMw: number;
  openCount: number;
  awaitingReviewCount: number;
  inProgressCount: number;
  criticalCount: number;
  highPriorityCount: number;
  totalAssetsCount: number;
  operationalAssetsCount: number;
  faultedAssetsCount: number;
  incidents: IncidentItem[];
  recentActivities: ActivityItem[];
  recurringAssets: RecurringAssetItem[];
  technicians: CrewMemberItem[];
}

type QueueTab = "ALL_OPEN" | "AWAITING_REVIEW" | "HIGH_PRIORITY" | "IN_PROGRESS" | "RECURRING" | "ALL";

export function SupervisorDashboard({
  supervisorName,
  supervisorRole = "SUPERVISOR",
  supervisorUserId,
  siteName,
  siteCode,
  siteId,
  capacityMw,
  openCount: initialOpenCount,
  awaitingReviewCount: initialAwaitingReviewCount,
  inProgressCount: initialInProgressCount,
  criticalCount: initialCriticalCount,
  highPriorityCount: initialHighPriorityCount,
  totalAssetsCount,
  operationalAssetsCount,
  faultedAssetsCount,
  incidents: initialIncidents,
  recentActivities: initialActivities,
  recurringAssets,
  technicians: initialTechnicians,
}: SupervisorDashboardProps) {
  // Local state for interactive mutations (optimistic updates + API sync)
  const [incidents, setIncidents] = useState<IncidentItem[]>(initialIncidents);
  const [activities, setActivities] = useState<ActivityItem[]>(initialActivities);
  const [technicians, setTechnicians] = useState<CrewMemberItem[]>(initialTechnicians);

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<QueueTab>("ALL_OPEN");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("ALL");
  const [assetFilter, setAssetFilter] = useState<string>("ALL");

  // Selection & detail drawer state
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  // Status transition & modal states
  const [statusModalIncident, setStatusModalIncident] = useState<IncidentItem | null>(null);
  const [targetStatusToConfirm, setTargetStatusToConfirm] = useState<IncidentStatus | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [mutationLoading, setMutationLoading] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Dynamic metrics derived strictly from actual live incident state
  const dynamicMetrics = useMemo(() => {
    const open = incidents.filter((i) => i.status !== "RESOLVED" && i.status !== "CLOSED").length;
    const awaitingReview = incidents.filter((i) => i.status === "SUBMITTED").length;
    const inProgress = incidents.filter((i) => i.status === "IN_PROGRESS").length;
    const critical = incidents.filter(
      (i) => i.priority === "CRITICAL" && i.status !== "RESOLVED" && i.status !== "CLOSED"
    ).length;
    const highAndCritical = incidents.filter(
      (i) =>
        (i.priority === "CRITICAL" || i.priority === "HIGH") &&
        i.status !== "RESOLVED" &&
        i.status !== "CLOSED"
    ).length;
    const recurringCount = recurringAssets.filter(
      (a) => a.incidentCount >= 2 || a.hasRepeatFaultFlag
    ).length;

    const availability =
      totalAssetsCount > 0
        ? (((totalAssetsCount - faultedAssetsCount) / totalAssetsCount) * 100).toFixed(1)
        : "100.0";

    return {
      open,
      awaitingReview,
      inProgress,
      critical,
      highAndCritical,
      recurringCount,
      availability,
    };
  }, [incidents, recurringAssets, totalAssetsCount, faultedAssetsCount]);

  // Selected incident object for detail drawer
  const selectedIncident = useMemo(() => {
    if (!selectedIncidentId) return null;
    return incidents.find((i) => i.id === selectedIncidentId) || null;
  }, [incidents, selectedIncidentId]);

  // Filtered incidents according to active tab, search, and dropdown filters
  // ponytail: client-side filtering over page-size incident batch; upgrade path: server-side pagination with cursor when active site incidents exceed 500.
  const filteredIncidents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return incidents.filter((incident) => {
      // 1. Tab filter
      if (activeTab === "ALL_OPEN" && (incident.status === "RESOLVED" || incident.status === "CLOSED")) {
        return false;
      }
      if (activeTab === "AWAITING_REVIEW" && incident.status !== "SUBMITTED") {
        return false;
      }
      if (
        activeTab === "HIGH_PRIORITY" &&
        (incident.priority !== "CRITICAL" && incident.priority !== "HIGH")
      ) {
        return false;
      }
      if (activeTab === "IN_PROGRESS" && incident.status !== "IN_PROGRESS") {
        return false;
      }
      if (activeTab === "RECURRING" && !incident.isRepeatFault && incident.repeatCount30d === 0) {
        return false;
      }

      // 2. Dropdown Status Filter
      if (statusFilter !== "ALL" && incident.status !== statusFilter) {
        return false;
      }

      // 3. Dropdown Priority Filter
      if (priorityFilter !== "ALL" && incident.priority !== priorityFilter) {
        return false;
      }

      // 4. Dropdown Assignee Filter
      if (assigneeFilter === "UNASSIGNED" && incident.assignedToUserId) {
        return false;
      }
      if (
        assigneeFilter !== "ALL" &&
        assigneeFilter !== "UNASSIGNED" &&
        incident.assignedToUserId !== assigneeFilter
      ) {
        return false;
      }

      // 5. Dropdown Asset Filter
      if (assetFilter !== "ALL" && incident.asset?.assetTag !== assetFilter) {
        return false;
      }

      // 6. Search query
      if (q) {
        const matchTicket = incident.ticketNumber.toLowerCase().includes(q);
        const matchTitle = incident.title.toLowerCase().includes(q);
        const matchDesc = incident.description.toLowerCase().includes(q);
        const matchAsset = incident.asset?.assetTag.toLowerCase().includes(q) || false;
        const matchSymptoms = incident.symptoms?.toLowerCase().includes(q) || false;
        const matchError = incident.errorCode?.toLowerCase().includes(q) || false;
        const matchAssignee = incident.assignedTo?.name.toLowerCase().includes(q) || false;

        if (
          !matchTicket &&
          !matchTitle &&
          !matchDesc &&
          !matchAsset &&
          !matchSymptoms &&
          !matchError &&
          !matchAssignee
        ) {
          return false;
        }
      }

      return true;
    });
  }, [incidents, searchQuery, activeTab, statusFilter, priorityFilter, assigneeFilter, assetFilter]);

  // Unique asset tags for dropdown filter
  const uniqueAssetTags = useMemo(() => {
    const tags = new Set<string>();
    incidents.forEach((i) => {
      if (i.asset?.assetTag) tags.add(i.asset.assetTag);
    });
    return Array.from(tags).sort();
  }, [incidents]);

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    activeTab !== "ALL_OPEN" ||
    statusFilter !== "ALL" ||
    priorityFilter !== "ALL" ||
    assigneeFilter !== "ALL" ||
    assetFilter !== "ALL";

  const clearAllFilters = () => {
    setSearchQuery("");
    setActiveTab("ALL_OPEN");
    setStatusFilter("ALL");
    setPriorityFilter("ALL");
    setAssigneeFilter("ALL");
    setAssetFilter("ALL");
  };

  // ===========================================================================
  // INTERACTIVE ASSIGNMENT HANDLER
  // ===========================================================================
  async function handleAssignTechnician(incidentId: string, newAssigneeId: string) {
    setMutationLoading(incidentId);
    setActionNotice(null);

    const targetIncident = incidents.find((i) => i.id === incidentId);
    if (!targetIncident) return;

    const oldAssigneeId = targetIncident.assignedToUserId;
    const selectedTech = technicians.find((t) => t.id === newAssigneeId) || null;

    try {
      const res = await fetch(`/api/v1/incidents/${incidentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToUserId: newAssigneeId || null }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to assign technician");
      }

      // Optimistically update incident in local state
      setIncidents((prev) =>
        prev.map((inc) => {
          if (inc.id === incidentId) {
            return {
              ...inc,
              assignedToUserId: newAssigneeId || null,
              assignedTo: selectedTech
                ? {
                    id: selectedTech.id,
                    name: selectedTech.name,
                    role: selectedTech.role,
                    phone: selectedTech.phone,
                  }
                : null,
            };
          }
          return inc;
        })
      );

      // Update technician workload counts in local state
      setTechnicians((prev) =>
        prev.map((tech) => {
          let currentList = [...tech.assignedIncidents];
          if (tech.id === oldAssigneeId) {
            currentList = currentList.filter((item) => item.id !== incidentId);
          }
          if (tech.id === newAssigneeId) {
            currentList.push({
              id: targetIncident.id,
              ticketNumber: targetIncident.ticketNumber,
              priority: targetIncident.priority,
              status: targetIncident.status,
            });
          }
          return { ...tech, assignedIncidents: currentList };
        })
      );

      // Append new activity event to timeline stream
      const newActivity: ActivityItem = {
        id: `act-${Date.now()}`,
        incidentId,
        userId: supervisorUserId || "supervisor",
        eventType: "ASSIGNMENT",
        fromStatus: targetIncident.status,
        toStatus: targetIncident.status,
        title: selectedTech ? "Ticket Assigned" : "Ticket Unassigned",
        description: selectedTech
          ? `Assigned to ${selectedTech.name} (${selectedTech.role}) by ${supervisorName}.`
          : `Unassigned by ${supervisorName}.`,
        createdAt: new Date().toISOString(),
        incident: {
          id: targetIncident.id,
          ticketNumber: targetIncident.ticketNumber,
          title: targetIncident.title,
          priority: targetIncident.priority,
          status: targetIncident.status,
        },
        user: {
          id: supervisorUserId || "supervisor",
          name: supervisorName,
          role: supervisorRole,
        },
      };

      setActivities((prev) => [newActivity, ...prev]);
      setActionNotice({
        type: "success",
        message: selectedTech
          ? `Assigned ${targetIncident.ticketNumber} to ${selectedTech.name}.`
          : `Unassigned ${targetIncident.ticketNumber}.`,
      });
    } catch (err: unknown) {
      setActionNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Assignment failed.",
      });
    } finally {
      setMutationLoading(null);
    }
  }

  // ===========================================================================
  // INTERACTIVE STATUS UPDATE HANDLER
  // ===========================================================================
  async function handleStatusTransition(
    incidentId: string,
    targetStatus: IncidentStatus,
    notes?: string
  ) {
    setMutationLoading(incidentId);
    setActionNotice(null);

    const targetIncident = incidents.find((i) => i.id === incidentId);
    if (!targetIncident) return;

    try {
      const payload: Record<string, unknown> = { status: targetStatus };
      if (notes) {
        payload.resolutionNotes = notes;
      }

      const res = await fetch(`/api/v1/incidents/${incidentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to update status");
      }

      // Optimistically update incident state
      setIncidents((prev) =>
        prev.map((inc) => {
          if (inc.id === incidentId) {
            return {
              ...inc,
              status: targetStatus,
              resolutionNotes: notes ?? inc.resolutionNotes,
              resolvedAt: targetStatus === "RESOLVED" ? new Date().toISOString() : inc.resolvedAt,
              closedAt: targetStatus === "CLOSED" ? new Date().toISOString() : inc.closedAt,
            };
          }
          return inc;
        })
      );

      // Append new activity to timeline stream
      const newActivity: ActivityItem = {
        id: `act-${Date.now()}`,
        incidentId,
        userId: supervisorUserId || "supervisor",
        eventType: "STATUS_CHANGE",
        fromStatus: targetIncident.status,
        toStatus: targetStatus,
        title: `Status Changed: ${targetIncident.status} → ${targetStatus}`,
        description:
          notes ||
          `Status transitioned from ${targetIncident.status} to ${targetStatus} by ${supervisorName}.`,
        createdAt: new Date().toISOString(),
        incident: {
          id: targetIncident.id,
          ticketNumber: targetIncident.ticketNumber,
          title: targetIncident.title,
          priority: targetIncident.priority,
          status: targetStatus,
        },
        user: {
          id: supervisorUserId || "supervisor",
          name: supervisorName,
          role: supervisorRole,
        },
      };

      setActivities((prev) => [newActivity, ...prev]);
      setStatusModalIncident(null);
      setTargetStatusToConfirm(null);
      setResolutionNotes("");

      setActionNotice({
        type: "success",
        message: `${targetIncident.ticketNumber} transitioned to ${targetStatus}.`,
      });
    } catch (err: unknown) {
      setActionNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Status update failed.",
      });
    } finally {
      setMutationLoading(null);
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* 1. Header & Operational Control Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-600 animate-pulse" />
            <span className="text-xs font-mono font-bold text-neutral-500 uppercase tracking-wider">
              Supervisor Operations &amp; Dispatch Console
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 mt-1">
            {siteName}
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5 font-mono">
            Plant Code: <span className="text-neutral-900 font-semibold">{siteCode}</span> •{" "}
            Capacity: <span className="text-neutral-900 font-semibold">{capacityMw} MW</span> •{" "}
            On-Duty Supervisor: <span className="text-neutral-900 font-medium">{supervisorName}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/field"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-semibold text-neutral-700 shadow-2xs transition-colors cursor-pointer"
          >
            <Radio className="h-3.5 w-3.5 text-amber-600" />
            <span>Voice Field Mode</span>
          </Link>
          <Link
            href="/incidents/new"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Incident</span>
          </Link>
          <Link
            href="/incidents"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <span>All Incidents</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Action Notification Toast */}
      {actionNotice && (
        <div
          className={cn(
            "rounded-md p-3 text-xs flex items-center justify-between gap-3 border shadow-xs animate-in fade-in duration-200",
            actionNotice.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-200"
              : "bg-rose-50 text-rose-900 border-rose-200"
          )}
        >
          <div className="flex items-center gap-2">
            {actionNotice.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{actionNotice.message}</span>
          </div>
          <button
            onClick={() => setActionNotice(null)}
            className="text-neutral-400 hover:text-neutral-700 p-0.5 rounded cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* 2. Operational Metrics Ribbon (Strictly Real Database Numbers) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Metric 1: Open Incidents */}
        <button
          type="button"
          onClick={() => {
            setActiveTab("ALL_OPEN");
            setStatusFilter("ALL");
          }}
          className={cn(
            "rounded-lg border p-4 text-left shadow-2xs transition-all cursor-pointer",
            activeTab === "ALL_OPEN"
              ? "border-blue-400 bg-blue-50/40 ring-1 ring-blue-400"
              : "border-neutral-200 bg-white hover:border-neutral-300"
          )}
        >
          <div className="flex items-center justify-between text-neutral-500 text-xs">
            <span className="font-medium">1. Open Incidents</span>
            <Activity className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-1 font-mono text-2xl font-extrabold text-neutral-900">
            {dynamicMetrics.open}
          </div>
          <p className="text-[11px] text-neutral-500 font-mono mt-0.5">
            {dynamicMetrics.inProgress} active repair • {dynamicMetrics.awaitingReview} queued
          </p>
        </button>

        {/* Metric 2: Incidents Awaiting Review */}
        <button
          type="button"
          onClick={() => {
            setActiveTab("AWAITING_REVIEW");
            setStatusFilter("SUBMITTED");
          }}
          className={cn(
            "rounded-lg border p-4 text-left shadow-2xs transition-all cursor-pointer",
            activeTab === "AWAITING_REVIEW"
              ? "border-amber-400 bg-amber-50/50 ring-1 ring-amber-400"
              : "border-neutral-200 bg-white hover:border-neutral-300"
          )}
        >
          <div className="flex items-center justify-between text-neutral-500 text-xs">
            <span className="font-medium">2. Awaiting Review</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-1 font-mono text-2xl font-extrabold text-amber-800">
            {dynamicMetrics.awaitingReview}
          </div>
          <p className="text-[11px] text-amber-700 font-mono mt-0.5">
            Confirmed technician logs awaiting dispatch
          </p>
        </button>

        {/* Metric 3: Suggested High-Priority Incidents */}
        <button
          type="button"
          onClick={() => {
            setActiveTab("HIGH_PRIORITY");
          }}
          className={cn(
            "rounded-lg border p-4 text-left shadow-2xs transition-all cursor-pointer",
            activeTab === "HIGH_PRIORITY"
              ? "border-rose-400 bg-rose-50/50 ring-1 ring-rose-400"
              : "border-neutral-200 bg-white hover:border-neutral-300"
          )}
        >
          <div className="flex items-center justify-between text-neutral-500 text-xs">
            <span className="font-medium">3. High &amp; Critical Priority</span>
            <ShieldAlert className="h-4 w-4 text-rose-600" />
          </div>
          <div className="mt-1 font-mono text-2xl font-extrabold text-rose-700">
            {dynamicMetrics.highAndCritical}
          </div>
          <p className="text-[11px] text-rose-600 font-mono mt-0.5">
            {dynamicMetrics.critical} Critical • Inverter / Substation trips
          </p>
        </button>

        {/* Metric 4: Plant Equipment Health & Availability */}
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-neutral-500 text-xs">
            <span className="font-medium">Plant Availability</span>
            <Layers className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-1 font-mono text-2xl font-extrabold text-emerald-700">
            {dynamicMetrics.availability}%
          </div>
          <p className="text-[11px] text-neutral-500 font-mono mt-0.5">
            {operationalAssetsCount}/{totalAssetsCount} verified operational assets
          </p>
        </div>
      </div>

      {/* 3. Search & Interactive Filter Bar (Desktop & Tablet Optimized) */}
      <div className="rounded-lg border border-neutral-200 bg-white p-3.5 space-y-3 shadow-2xs">
        {/* Quick Queue Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("ALL_OPEN")}
            className={cn(
              "px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-colors cursor-pointer",
              activeTab === "ALL_OPEN"
                ? "bg-neutral-900 text-white font-semibold"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            )}
          >
            All Open ({dynamicMetrics.open})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("AWAITING_REVIEW")}
            className={cn(
              "px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-colors cursor-pointer",
              activeTab === "AWAITING_REVIEW"
                ? "bg-amber-600 text-white font-semibold"
                : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200"
            )}
          >
            Awaiting Review ({dynamicMetrics.awaitingReview})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("HIGH_PRIORITY")}
            className={cn(
              "px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-colors cursor-pointer",
              activeTab === "HIGH_PRIORITY"
                ? "bg-rose-600 text-white font-semibold"
                : "bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200"
            )}
          >
            High &amp; Critical ({dynamicMetrics.highAndCritical})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("IN_PROGRESS")}
            className={cn(
              "px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-colors cursor-pointer",
              activeTab === "IN_PROGRESS"
                ? "bg-indigo-600 text-white font-semibold"
                : "bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-200"
            )}
          >
            In Progress ({dynamicMetrics.inProgress})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("RECURRING")}
            className={cn(
              "px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-colors cursor-pointer",
              activeTab === "RECURRING"
                ? "bg-purple-600 text-white font-semibold"
                : "bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200"
            )}
          >
            Recurring Faults ({dynamicMetrics.recurringCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ALL")}
            className={cn(
              "px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-colors cursor-pointer",
              activeTab === "ALL"
                ? "bg-neutral-900 text-white font-semibold"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            )}
          >
            All Tickets ({incidents.length})
          </button>
        </div>

        {/* Search input + Secondary Filter Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 pt-2 border-t border-neutral-100">
          {/* Search Box */}
          <div className="lg:col-span-4 relative">
            <Search className="h-4 w-4 text-neutral-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ticket, asset, fault, symptoms..."
              className="w-full pl-9 pr-8 py-2 text-xs rounded border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-600 p-0.5 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Status Dropdown */}
          <div className="lg:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-2.5 py-2 text-xs rounded border border-neutral-200 bg-neutral-50 focus:bg-white font-mono cursor-pointer"
            >
              <option value="ALL">Status: All</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="NEEDS_CLARIFICATION">Needs Clarification</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>

          {/* Priority Dropdown */}
          <div className="lg:col-span-2">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-2.5 py-2 text-xs rounded border border-neutral-200 bg-neutral-50 focus:bg-white font-mono cursor-pointer"
            >
              <option value="ALL">Priority: All</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          {/* Assignee Dropdown */}
          <div className="lg:col-span-2">
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="w-full px-2.5 py-2 text-xs rounded border border-neutral-200 bg-neutral-50 focus:bg-white font-mono cursor-pointer"
            >
              <option value="ALL">Crew: All</option>
              <option value="UNASSIGNED">Unassigned Only</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.assignedIncidents.length})
                </option>
              ))}
            </select>
          </div>

          {/* Asset Dropdown */}
          <div className="lg:col-span-2 flex items-center gap-1.5">
            <select
              value={assetFilter}
              onChange={(e) => setAssetFilter(e.target.value)}
              className="w-full px-2.5 py-2 text-xs rounded border border-neutral-200 bg-neutral-50 focus:bg-white font-mono cursor-pointer truncate"
            >
              <option value="ALL">Asset: All</option>
              {uniqueAssetTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                title="Reset all filters"
                className="px-2 py-2 rounded border border-neutral-200 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 text-xs shrink-0 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. Main Operational Sections (Desktop 3-Column / Tablet 2-Column Responsive Layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Incident Triage Board (Spans 8 columns on large screens) */}
        <section className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wide">
                Live Incident Triage &amp; Dispatch Queue
              </h2>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-neutral-100 text-neutral-700 border border-neutral-200">
                {filteredIncidents.length} Match{filteredIncidents.length === 1 ? "" : "es"}
              </span>
            </div>

            <span className="text-[11px] text-neutral-500 font-mono hidden sm:inline">
              Click &apos;Review&apos; for audit history &amp; status transitions
            </span>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block rounded-lg border border-neutral-200 bg-white overflow-hidden shadow-2xs">
            {filteredIncidents.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-mono text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">TICKET</th>
                      <th className="py-2.5 px-3 font-semibold">ASSET</th>
                      <th className="py-2.5 px-3 font-semibold">FAULT / SYMPTOMS</th>
                      <th className="py-2.5 px-3 font-semibold">PRIORITY</th>
                      <th className="py-2.5 px-3 font-semibold">STATUS</th>
                      <th className="py-2.5 px-3 font-semibold">ASSIGNED TECHNICIAN</th>
                      <th className="py-2.5 px-3 font-semibold text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {filteredIncidents.map((incident) => {
                      const priorityMeta =
                        INCIDENT_PRIORITY_META[incident.priority] || INCIDENT_PRIORITY_META.MEDIUM;
                      const statusMeta =
                        INCIDENT_STATUS_META[incident.status] || INCIDENT_STATUS_META.SUBMITTED;

                      return (
                        <tr
                          key={incident.id}
                          className={cn(
                            "hover:bg-neutral-50/80 transition-colors",
                            selectedIncidentId === incident.id && "bg-blue-50/50"
                          )}
                        >
                          {/* Ticket Number */}
                          <td className="py-3 px-3 font-mono font-bold text-neutral-900 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span>{incident.ticketNumber}</span>
                              {incident.isRepeatFault && (
                                <span
                                  title="Repeat fault on this asset within 30 days"
                                  className="px-1 py-0.2 rounded bg-purple-100 text-purple-800 text-[9px] font-bold border border-purple-200 flex items-center gap-0.5"
                                >
                                  <Repeat className="h-2.5 w-2.5" />
                                  <span>Repeat</span>
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-neutral-400 font-normal block">
                              {new Date(incident.createdAt).toLocaleDateString("en-IN", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </td>

                          {/* Asset */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            <div className="font-mono font-semibold text-neutral-800">
                              {incident.asset?.assetTag || "Site-Wide"}
                            </div>
                            <span className="text-[10px] text-neutral-500 font-mono">
                              {incident.asset?.assetType || "UNASSIGNED"}
                            </span>
                          </td>

                          {/* Title / Symptoms */}
                          <td className="py-3 px-3 max-w-[220px]">
                            <div className="font-medium text-neutral-900 truncate" title={incident.title}>
                              {incident.title}
                            </div>
                            {incident.symptoms && (
                              <div className="text-[10px] text-neutral-500 truncate" title={incident.symptoms}>
                                {incident.symptoms}
                              </div>
                            )}
                            {incident.errorCode && (
                              <span className="inline-block mt-0.5 px-1 py-0.2 rounded bg-neutral-100 text-neutral-700 font-mono text-[9px] font-semibold border border-neutral-200">
                                Alarm: {incident.errorCode}
                              </span>
                            )}
                          </td>

                          {/* Priority */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-mono font-bold border inline-flex items-center gap-1",
                                priorityMeta.badge
                              )}
                            >
                              <span className={cn("h-1.5 w-1.5 rounded-full", priorityMeta.dot)} />
                              <span>{incident.priority}</span>
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-mono font-bold border inline-flex items-center gap-1",
                                statusMeta.badge
                              )}
                            >
                              <span className={cn("h-1.5 w-1.5 rounded-full", statusMeta.dot)} />
                              <span>{statusMeta.label}</span>
                            </span>
                          </td>

                          {/* Interactive Assignment Dropdown */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            <select
                              value={incident.assignedToUserId || ""}
                              disabled={mutationLoading === incident.id}
                              onChange={(e) => handleAssignTechnician(incident.id, e.target.value)}
                              className="px-2 py-1 text-xs rounded border border-neutral-200 bg-neutral-50 hover:bg-white text-neutral-800 font-medium cursor-pointer max-w-[150px] truncate focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="">Unassigned</option>
                              {technicians.map((tech) => (
                                <option key={tech.id} value={tech.id}>
                                  {tech.name} ({tech.assignedIncidents.length} active)
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Action Button */}
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setSelectedIncidentId(incident.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-medium text-xs transition-colors cursor-pointer"
                            >
                              <span>Review</span>
                              <ChevronRight className="h-3 w-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyStateNotice activeTab={activeTab} searchQuery={searchQuery} onReset={clearAllFilters} />
            )}
          </div>

          {/* Tablet & Mobile Card View */}
          <div className="block md:hidden space-y-3">
            {filteredIncidents.length > 0 ? (
              filteredIncidents.map((incident) => {
                const priorityMeta =
                  INCIDENT_PRIORITY_META[incident.priority] || INCIDENT_PRIORITY_META.MEDIUM;
                const statusMeta =
                  INCIDENT_STATUS_META[incident.status] || INCIDENT_STATUS_META.SUBMITTED;

                return (
                  <div
                    key={incident.id}
                    className="rounded-lg border border-neutral-200 bg-white p-4 shadow-2xs space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-neutral-900 text-xs">
                            {incident.ticketNumber}
                          </span>
                          {incident.isRepeatFault && (
                            <span className="px-1 py-0.2 rounded bg-purple-100 text-purple-800 text-[9px] font-bold border border-purple-200">
                              Repeat
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-neutral-500 font-mono">
                          {incident.asset?.assetTag || "Site-Wide"} • {incident.asset?.assetType || "UNASSIGNED"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border",
                            priorityMeta.badge
                          )}
                        >
                          {incident.priority}
                        </span>
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border",
                            statusMeta.badge
                          )}
                        >
                          {statusMeta.label}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xs font-semibold text-neutral-900 line-clamp-1">
                        {incident.title}
                      </h3>
                      {incident.symptoms && (
                        <p className="text-[11px] text-neutral-500 line-clamp-1 mt-0.5">
                          {incident.symptoms}
                        </p>
                      )}
                    </div>

                    {/* Touch-Friendly Assignment & Action Buttons for Tablet */}
                    <div className="pt-2 border-t border-neutral-100 flex items-center justify-between gap-2">
                      <div className="flex-1">
                        <select
                          value={incident.assignedToUserId || ""}
                          disabled={mutationLoading === incident.id}
                          onChange={(e) => handleAssignTechnician(incident.id, e.target.value)}
                          className="w-full px-2 py-1.5 text-xs rounded border border-neutral-200 bg-neutral-50 text-neutral-800 font-medium cursor-pointer"
                        >
                          <option value="">Unassigned</option>
                          {technicians.map((tech) => (
                            <option key={tech.id} value={tech.id}>
                              {tech.name} ({tech.assignedIncidents.length} active)
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedIncidentId(incident.id)}
                        className="px-3 py-1.5 rounded bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold shrink-0 cursor-pointer"
                      >
                        Review
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyStateNotice activeTab={activeTab} searchQuery={searchQuery} onReset={clearAllFilters} />
            )}
          </div>

          {/* 4. Recurring Asset Reports Section (Req 4) */}
          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Repeat className="h-4 w-4 text-purple-600" />
                <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wide">
                  4. Recurring Asset Fault Reports
                </h3>
              </div>
              <span className="text-[10px] font-mono text-neutral-500">
                Calculated from real database incident history
              </span>
            </div>

            {recurringAssets.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {recurringAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="p-3 rounded-md border border-neutral-100 bg-neutral-50/70 space-y-1.5 hover:border-purple-200 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-neutral-900 text-xs">
                        {asset.assetTag}
                      </span>
                      <span
                        className={cn(
                          "px-1.5 py-0.2 rounded text-[10px] font-mono font-bold border",
                          asset.incidentCount >= 2
                            ? "bg-purple-100 text-purple-800 border-purple-200"
                            : "bg-neutral-100 text-neutral-700 border-neutral-200"
                        )}
                      >
                        {asset.incidentCount} Incident{asset.incidentCount === 1 ? "" : "s"}
                      </span>
                    </div>

                    <div className="text-[11px] text-neutral-600 font-medium truncate">
                      {asset.name}
                    </div>

                    <div className="text-[10px] text-neutral-500 font-mono flex items-center justify-between">
                      <span>Type: {asset.assetType}</span>
                      <span>Loc: {asset.block}</span>
                    </div>

                    {asset.latestIncident && (
                      <div className="pt-1.5 border-t border-neutral-200/60 flex items-center justify-between text-[10px]">
                        <span className="font-mono text-neutral-700 truncate max-w-[140px]">
                          Last: {asset.latestIncident.ticketNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setAssetFilter(asset.assetTag);
                            setActiveTab("ALL");
                          }}
                          className="text-blue-600 hover:underline font-semibold cursor-pointer"
                        >
                          Filter Tickets
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-neutral-500 bg-neutral-50 rounded-md border border-dashed border-neutral-200">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
                <span className="font-semibold block text-neutral-800">
                  No repeat faults detected
                </span>
                <span className="text-[11px] text-neutral-500">
                  All equipment at this site is operating within single-incident thresholds.
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Right Sidebar: Real Crew Workload Roster & Live Activity Stream (4 columns) */}
        <section className="lg:col-span-4 space-y-6">
          {/* Real On-Duty Field Crew Roster (Strictly Real DB Users, No Fake Stats) */}
          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-blue-600" />
                <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wide">
                  On-Duty Field Crew
                </h3>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-100 text-neutral-600 border border-neutral-200">
                {technicians.length} Technicians
              </span>
            </div>

            {technicians.length > 0 ? (
              <div className="space-y-2.5">
                {technicians.map((member) => (
                  <div
                    key={member.id}
                    className="p-2.5 rounded border border-neutral-100 bg-neutral-50 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-neutral-900">{member.name}</span>
                      <span
                        className={cn(
                          "text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border",
                          member.assignedIncidents.length > 0
                            ? "bg-blue-50 text-blue-800 border-blue-200"
                            : "bg-emerald-50 text-emerald-800 border-emerald-200"
                        )}
                      >
                        {member.assignedIncidents.length > 0
                          ? `${member.assignedIncidents.length} Active`
                          : "Available"}
                      </span>
                    </div>

                    <div className="text-[11px] text-neutral-500 flex items-center justify-between">
                      <span className="font-mono flex items-center gap-1">
                        <Phone className="h-2.5 w-2.5 text-neutral-400" />
                        {member.phone}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setAssigneeFilter(member.id);
                          setActiveTab("ALL");
                        }}
                        className="text-blue-600 hover:underline font-semibold cursor-pointer"
                      >
                        View Tickets
                      </button>
                    </div>

                    {member.assignedIncidents.length > 0 && (
                      <div className="pt-1 border-t border-neutral-200/50 flex flex-wrap gap-1">
                        {member.assignedIncidents.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setSelectedIncidentId(t.id)}
                            className="px-1.5 py-0.2 rounded bg-white text-[9px] font-mono text-neutral-700 border border-neutral-200 hover:border-blue-400 cursor-pointer"
                          >
                            {t.ticketNumber} [{t.priority}]
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-4 text-center text-xs text-neutral-400 font-mono">
                No technicians registered for this site in database.
              </div>
            )}
          </div>

          {/* 5. Recent Incident Activity Feed (Req 5 & Audit History) */}
          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <History className="h-4 w-4 text-indigo-600" />
                <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wide">
                  5. Recent Incident Activity
                </h3>
              </div>
              <span className="text-[10px] font-mono text-neutral-400">Audit Stream</span>
            </div>

            {activities.length > 0 ? (
              <div className="space-y-3 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-neutral-100">
                {activities.slice(0, 8).map((act) => (
                  <div
                    key={act.id}
                    onClick={() => act.incidentId && setSelectedIncidentId(act.incidentId)}
                    className="relative pl-5 group cursor-pointer"
                  >
                    <div className="absolute left-0.5 top-1 h-3 w-3 rounded-full bg-white border-2 border-indigo-400 group-hover:border-indigo-600 transition-colors" />
                    <div className="text-xs font-semibold text-neutral-900 group-hover:text-blue-600 transition-colors flex items-center justify-between">
                      <span>{act.title}</span>
                      <span className="text-[9px] font-mono text-neutral-400">
                        {new Date(act.createdAt).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <p className="text-[11px] text-neutral-500 line-clamp-2 mt-0.5">
                      {act.description}
                    </p>

                    <div className="text-[10px] font-mono text-neutral-400 mt-0.5 flex items-center gap-2">
                      <span className="font-semibold text-neutral-600">
                        {act.incident?.ticketNumber || "System"}
                      </span>
                      <span>•</span>
                      <span>{act.user?.name || "System"}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-neutral-400 font-mono">
                No recent activity events recorded.
              </div>
            )}
          </div>
        </section>
      </div>

      {/* =======================================================================
          SLIDE-OVER / DRAWER: INCIDENT DETAIL & AUDIT HISTORY (Req 9)
         ======================================================================= */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-2xs flex justify-end animate-in fade-in duration-200">
          <div
            className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col overflow-y-auto animate-in slide-in-from-right duration-300"
            role="dialog"
            aria-modal="true"
          >
            {/* Drawer Header */}
            <div className="p-4 border-b border-neutral-200 sticky top-0 bg-white z-10 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-extrabold text-base text-neutral-900">
                    {selectedIncident.ticketNumber}
                  </span>
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-mono font-bold border",
                      INCIDENT_PRIORITY_META[selectedIncident.priority]?.badge
                    )}
                  >
                    {selectedIncident.priority}
                  </span>
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-mono font-bold border",
                      INCIDENT_STATUS_META[selectedIncident.status]?.badge
                    )}
                  >
                    {INCIDENT_STATUS_META[selectedIncident.status]?.label}
                  </span>
                </div>
                <div className="text-xs text-neutral-500 font-mono mt-0.5">
                  Site: {selectedIncident.site.name} ({selectedIncident.site.code})
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedIncidentId(null)}
                className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Body Content */}
            <div className="p-5 space-y-6 flex-1 text-xs">
              {/* Fault Title & Description */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase">
                  Fault Summary
                </span>
                <h3 className="text-sm font-bold text-neutral-900">{selectedIncident.title}</h3>
                <p className="text-neutral-700 leading-relaxed bg-neutral-50 p-3 rounded border border-neutral-100">
                  {selectedIncident.description}
                </p>
              </div>

              {/* Asset & Telemetry Specifications */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-neutral-50 border border-neutral-200 font-mono">
                <div>
                  <span className="text-[10px] text-neutral-400 block">AFFECTED ASSET</span>
                  <span className="font-bold text-neutral-900">
                    {selectedIncident.asset?.assetTag || "Site-Wide Issue"}
                  </span>
                  <span className="text-[10px] text-neutral-500 block">
                    {selectedIncident.asset?.name || "General Facility"}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-neutral-400 block">FAULT CATEGORY</span>
                  <span className="font-bold text-neutral-900">
                    {FAULT_CATEGORY_LABELS[selectedIncident.faultCategory] || selectedIncident.faultCategory}
                  </span>
                  {selectedIncident.errorCode && (
                    <span className="text-[10px] text-rose-700 font-bold block">
                      Alarm Code: {selectedIncident.errorCode}
                    </span>
                  )}
                </div>

                {selectedIncident.symptoms && (
                  <div className="col-span-2 pt-2 border-t border-neutral-200/60 font-sans">
                    <span className="text-[10px] font-mono text-neutral-400 block">
                      REPORTED SYMPTOMS
                    </span>
                    <span className="text-neutral-800">{selectedIncident.symptoms}</span>
                  </div>
                )}
              </div>

              {/* Verbatim Original Transcript (Immutable) */}
              {selectedIncident.originalTranscript && (
                <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/50 space-y-1">
                  <div className="flex items-center justify-between text-blue-900 font-mono text-[10px] font-bold">
                    <span>ORIGINAL VOICE TRANSCRIPT (PERMANENT SNAPSHOT)</span>
                    <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                  </div>
                  <p className="text-blue-950 font-serif italic text-xs leading-relaxed">
                    &ldquo;{selectedIncident.originalTranscript}&rdquo;
                  </p>
                </div>
              )}

              {/* Status Updates & Transitions (Req 8) */}
              <div className="space-y-2 p-3.5 rounded-lg border border-neutral-200 bg-white">
                <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase block">
                  8. Status Transition Actions
                </span>

                <div className="flex flex-wrap gap-2 pt-1">
                  {getAllowedTransitions(selectedIncident.status, supervisorRole).map((tr) => (
                    <button
                      key={tr.status}
                      type="button"
                      disabled={mutationLoading === selectedIncident.id}
                      onClick={() => {
                        if (tr.status === "RESOLVED") {
                          setStatusModalIncident(selectedIncident);
                          setTargetStatusToConfirm("RESOLVED");
                        } else {
                          handleStatusTransition(selectedIncident.id, tr.status);
                        }
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5",
                        tr.status === "RESOLVED"
                          ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                          : tr.status === "CLOSED"
                          ? "bg-neutral-900 hover:bg-neutral-800 text-white"
                          : tr.status === "IN_PROGRESS"
                          ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                          : "bg-blue-600 hover:bg-blue-500 text-white"
                      )}
                    >
                      {mutationLoading === selectedIncident.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                      <span>Transition to {INCIDENT_STATUS_META[tr.status]?.label || tr.status}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Assignment Control (Req 7) */}
              <div className="space-y-2 p-3.5 rounded-lg border border-neutral-200 bg-white">
                <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase block">
                  7. Incident Assignment
                </span>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedIncident.assignedToUserId || ""}
                    disabled={mutationLoading === selectedIncident.id}
                    onChange={(e) => handleAssignTechnician(selectedIncident.id, e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded border border-neutral-200 bg-neutral-50 hover:bg-white text-neutral-900 font-semibold cursor-pointer"
                  >
                    <option value="">Unassigned</option>
                    {technicians.map((tech) => (
                      <option key={tech.id} value={tech.id}>
                        {tech.name} ({tech.assignedIncidents.length} active tickets)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Clarifications (if any) */}
              {selectedIncident.clarifications.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase block">
                    Clarification History
                  </span>
                  <div className="space-y-2">
                    {selectedIncident.clarifications.map((c) => (
                      <div
                        key={c.id}
                        className="p-3 rounded border border-purple-200 bg-purple-50/40 space-y-1"
                      >
                        <div className="font-semibold text-purple-950">Q: {c.question}</div>
                        {c.response ? (
                          <div className="text-neutral-700 bg-white p-2 rounded border border-purple-100">
                            A: {c.response}
                          </div>
                        ) : (
                          <span className="text-[10px] font-mono text-purple-700 font-bold">
                            Pending technician response
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Full Audit History Timeline (Req 9) */}
              <div className="space-y-2 pt-2">
                <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase block">
                  9. Incident Audit History Timeline
                </span>

                {selectedIncident.events.length > 0 ? (
                  <div className="relative pl-5 space-y-3 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-neutral-200">
                    {selectedIncident.events.map((ev) => (
                      <div key={ev.id} className="relative group space-y-0.5">
                        <div className="absolute -left-5 top-1 h-3.5 w-3.5 rounded-full bg-white border-2 border-blue-600" />
                        <div className="flex items-center justify-between text-xs font-semibold text-neutral-900">
                          <span>{ev.title}</span>
                          <span className="text-[10px] font-mono text-neutral-400">
                            {new Date(ev.createdAt).toLocaleString("en-IN", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        {ev.description && (
                          <p className="text-[11px] text-neutral-600">{ev.description}</p>
                        )}
                        <div className="text-[10px] font-mono text-neutral-400">
                          Author: {ev.user?.name} ({ev.user?.role})
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-4 text-center text-xs text-neutral-400 font-mono">
                    No timeline events logged yet.
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-neutral-200 sticky bottom-0 bg-white z-10 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setSelectedIncidentId(null)}
                className="px-4 py-2 rounded border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                Close Drawer
              </button>

              <Link
                href={`/incidents/${selectedIncident.id}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                <span>Full Incident Page</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          MODAL: RESOLUTION NOTES PROMPT
         ======================================================================= */}
      {statusModalIncident && targetStatusToConfirm === "RESOLVED" && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-neutral-200 p-5 max-w-md w-full shadow-2xl space-y-4">
            <div>
              <h3 className="text-sm font-bold text-neutral-900">
                Log Resolution Notes ({statusModalIncident.ticketNumber})
              </h3>
              <p className="text-xs text-neutral-500 mt-1">
                Please document physical repairs or component replacements performed before marking this ticket resolved.
              </p>
            </div>

            <textarea
              rows={3}
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="e.g. Cleared thermal blower fan obstruction, replaced 2A fuse, and verified steady-state inverter load."
              className="w-full p-2.5 text-xs rounded border border-neutral-300 bg-neutral-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600"
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => {
                  setStatusModalIncident(null);
                  setTargetStatusToConfirm(null);
                  setResolutionNotes("");
                }}
                className="px-3.5 py-1.5 rounded border border-neutral-200 text-neutral-700 text-xs font-semibold hover:bg-neutral-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={mutationLoading === statusModalIncident.id || !resolutionNotes.trim()}
                onClick={() =>
                  handleStatusTransition(statusModalIncident.id, "RESOLVED", resolutionNotes.trim())
                }
                className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
              >
                Confirm Resolution
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Useful empty state component with contextual guidance
 */
function EmptyStateNotice({
  activeTab,
  searchQuery,
  onReset,
}: {
  activeTab: QueueTab;
  searchQuery: string;
  onReset: () => void;
}) {
  if (searchQuery.trim()) {
    return (
      <div className="py-12 px-4 text-center space-y-3">
        <Search className="h-6 w-6 text-neutral-400 mx-auto" />
        <div className="space-y-1">
          <p className="text-xs font-bold text-neutral-900">
            No incidents matching &ldquo;{searchQuery}&rdquo;
          </p>
          <p className="text-[11px] text-neutral-500 max-w-sm mx-auto">
            Check ticket numbers, asset codes, or description keywords, or clear your search to view all tickets.
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 text-xs font-semibold cursor-pointer"
        >
          <RotateCcw className="h-3 w-3" />
          <span>Clear Search &amp; Filters</span>
        </button>
      </div>
    );
  }

  if (activeTab === "AWAITING_REVIEW") {
    return (
      <div className="py-12 px-4 text-center space-y-2">
        <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto" />
        <h3 className="text-xs font-bold text-neutral-900">
          All Incidents Triaged
        </h3>
        <p className="text-[11px] text-neutral-500 max-w-sm mx-auto">
          No newly confirmed technician incident tickets are currently awaiting review. All reported items have been dispatched.
        </p>
      </div>
    );
  }

  if (activeTab === "HIGH_PRIORITY") {
    return (
      <div className="py-12 px-4 text-center space-y-2">
        <ShieldCheck className="h-8 w-8 text-emerald-600 mx-auto" />
        <h3 className="text-xs font-bold text-neutral-900">
          Zero Critical Alarms Active
        </h3>
        <p className="text-[11px] text-neutral-500 max-w-sm mx-auto">
          No open critical or high priority incidents detected. Plant equipment is operating without emergency alarms.
        </p>
      </div>
    );
  }

  if (activeTab === "RECURRING") {
    return (
      <div className="py-12 px-4 text-center space-y-2">
        <Repeat className="h-8 w-8 text-purple-600 mx-auto" />
        <h3 className="text-xs font-bold text-neutral-900">
          No Recurring Faults Reported
        </h3>
        <p className="text-[11px] text-neutral-500 max-w-sm mx-auto">
          No active tickets are associated with repeat equipment failures within the 30-day window.
        </p>
      </div>
    );
  }

  return (
    <div className="py-12 px-4 text-center space-y-3">
      <SlidersHorizontal className="h-6 w-6 text-neutral-400 mx-auto" />
      <div className="space-y-1">
        <p className="text-xs font-bold text-neutral-900">No Incidents Found</p>
        <p className="text-[11px] text-neutral-500 max-w-sm mx-auto">
          There are no maintenance incidents matching the selected filter criteria.
        </p>
      </div>
      <button
        type="button"
        onClick={onReset}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 text-xs font-semibold cursor-pointer"
      >
        <RotateCcw className="h-3 w-3" />
        <span>Reset Filters</span>
      </button>
    </div>
  );
}
