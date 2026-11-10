"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { IncidentStatus, IncidentPriority, UserRole } from "@prisma/client";
import { getAllowedTransitions } from "@/modules/incidents/state-machine";
import { INCIDENT_STATUS_META, INCIDENT_PRIORITY_META } from "@/modules/incidents/types";
import {
  CheckCircle2,
  Clock,
  ArrowRight,
  UserCheck,
  AlertTriangle,
  RotateCcw,
  HelpCircle,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { TtsPlayer } from "@/modules/speech";

interface TechnicianOption {
  id: string;
  name: string;
  role: UserRole;
}

interface IncidentStatusActionsProps {
  incidentId: string;
  currentStatus: IncidentStatus;
  currentPriority: IncidentPriority;
  assignedToUserId?: string | null;
  userRole: UserRole;
  technicians: TechnicianOption[];
}

export function IncidentStatusActions({
  incidentId,
  currentStatus,
  currentPriority,
  assignedToUserId,
  userRole,
  technicians,
}: IncidentStatusActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal / prompt states
  const [selectedTargetStatus, setSelectedTargetStatus] = useState<IncidentStatus | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [selectedAssignee, setSelectedAssignee] = useState(assignedToUserId || "");
  const [selectedPriority, setSelectedPriority] = useState<IncidentPriority>(currentPriority);

  const allowedTransitions = getAllowedTransitions(currentStatus, userRole);
  const isSupervisorOrAdmin = userRole === "SUPERVISOR" || userRole === "ADMIN";

  async function handleStatusChange(targetStatus: IncidentStatus, notes?: string) {
    setLoading(true);
    setError(null);

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

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to update incident status");
      }

      setSelectedTargetStatus(null);
      setResolutionNotes("");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to execute status transition");
    } finally {
      setLoading(false);
    }
  }

  async function handleAssignUser(newAssigneeId: string) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/incidents/${incidentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToUserId: newAssigneeId || null }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to update assignment");
      }

      setSelectedAssignee(newAssigneeId);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to assign technician");
    } finally {
      setLoading(false);
    }
  }

  async function handlePriorityChange(newPriority: IncidentPriority) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/incidents/${incidentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: newPriority }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to update priority");
      }

      setSelectedPriority(newPriority);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to override priority");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 space-y-4 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-neutral-100">
        <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-800">
          Workflow Status & Dispatch Controls
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-neutral-500">
            Role: <span className="font-semibold text-neutral-800">{userRole}</span>
          </span>
          <TtsPlayer
            text={`Incident is currently ${currentStatus}, with ${currentPriority} priority. ${assignedToUserId ? "Assigned for field action." : "Currently unassigned."}`}
            label="Speak Status"
            compact={true}
            allowSettings={true}
          />
        </div>
      </div>

      {error && (
        <div className="p-2.5 rounded border border-rose-200 bg-rose-50 text-xs text-rose-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Available Transitions Action Bar */}
      <div className="space-y-2">
        <span className="text-[11px] font-mono text-neutral-500 block">
          Available Status Actions:
        </span>

        {allowedTransitions.length === 0 ? (
          <p className="text-xs font-mono text-neutral-400 italic">
            No further status transitions available for role {userRole} in state {currentStatus}.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {allowedTransitions.map((rule) => {
              const meta = INCIDENT_STATUS_META[rule.status];

              return (
                <button
                  key={rule.status}
                  disabled={loading}
                  onClick={() => {
                    if (rule.status === "RESOLVED" || rule.status === "NEEDS_CLARIFICATION") {
                      setSelectedTargetStatus(rule.status);
                    } else {
                      handleStatusChange(rule.status);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 hover:border-neutral-300 text-neutral-800 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                  title={rule.description}
                >
                  <ArrowRight className="h-3 w-3 text-neutral-400" />
                  <span>Mark as {meta.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Resolution Notes Modal Prompt */}
      {selectedTargetStatus === "RESOLVED" && (
        <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50/50 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>Document Physical Repair Resolution</span>
          </div>
          <p className="text-[11px] text-emerald-800">
            Provide technical notes describing actions taken, replaced components, or test readings.
          </p>
          <textarea
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            placeholder="e.g. Replaced cooling fan blower assembly on Inverter 1; thermal paste reapplied; temperature normalized to 48°C under full 2.5MW load."
            rows={3}
            required
            className="w-full p-2 text-xs rounded border border-emerald-300 bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setSelectedTargetStatus(null)}
              className="px-2.5 py-1 text-xs text-neutral-600 hover:text-neutral-900"
            >
              Cancel
            </button>
            <button
              disabled={loading || !resolutionNotes.trim()}
              onClick={() => handleStatusChange("RESOLVED", resolutionNotes.trim())}
              className="px-3 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-xs font-semibold disabled:opacity-50 flex items-center gap-1"
            >
              {loading && <Loader2 className="h-3 w-3 animate-spin" />}
              <span>Confirm Resolution</span>
            </button>
          </div>
        </div>
      )}

      {/* Clarification Request Modal Prompt */}
      {selectedTargetStatus === "NEEDS_CLARIFICATION" && (
        <div className="p-3.5 rounded-lg border border-purple-200 bg-purple-50/50 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900">
            <HelpCircle className="h-4 w-4 text-purple-600" />
            <span>Request Operational Clarification</span>
          </div>
          <p className="text-[11px] text-purple-800">
            Describe what telemetry, component tag, or safety check is needed from field staff.
          </p>
          <textarea
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            placeholder="e.g. Please verify whether DC string combiner box disconnect switch was opened before taking insulation measurements."
            rows={3}
            required
            className="w-full p-2 text-xs rounded border border-purple-300 bg-white focus:outline-hidden focus:ring-1 focus:ring-purple-600"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setSelectedTargetStatus(null)}
              className="px-2.5 py-1 text-xs text-neutral-600 hover:text-neutral-900"
            >
              Cancel
            </button>
            <button
              disabled={loading || !resolutionNotes.trim()}
              onClick={() => handleStatusChange("NEEDS_CLARIFICATION", resolutionNotes.trim())}
              className="px-3 py-1 bg-purple-700 hover:bg-purple-600 text-white rounded text-xs font-semibold disabled:opacity-50 flex items-center gap-1"
            >
              {loading && <Loader2 className="h-3 w-3 animate-spin" />}
              <span>Send Clarification Request</span>
            </button>
          </div>
        </div>
      )}

      {/* Supervisor Controls: Assignment & Priority Override */}
      {isSupervisorOrAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-neutral-100 text-xs font-mono">
          {/* Technician Assignment */}
          <div className="space-y-1">
            <label className="text-neutral-600 flex items-center gap-1 font-semibold">
              <UserCheck className="h-3.5 w-3.5 text-neutral-400" />
              <span>Assign Maintenance Technician</span>
            </label>
            <select
              value={selectedAssignee}
              disabled={loading}
              onChange={(e) => handleAssignUser(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600"
            >
              <option value="">Unassigned</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.role})
                </option>
              ))}
            </select>
          </div>

          {/* Priority Override */}
          <div className="space-y-1">
            <label className="text-neutral-600 flex items-center gap-1 font-semibold">
              <ShieldAlert className="h-3.5 w-3.5 text-neutral-400" />
              <span>Supervisor Priority Override</span>
            </label>
            <select
              value={selectedPriority}
              disabled={loading}
              onChange={(e) => handlePriorityChange(e.target.value as IncidentPriority)}
              className="w-full px-2.5 py-1.5 text-xs rounded border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600"
            >
              <option value="CRITICAL">CRITICAL (Immediate safety / fire / total trip)</option>
              <option value="HIGH">HIGH (Major inverter fault / earth fault)</option>
              <option value="MEDIUM">MEDIUM (Combiner box / tracker issue)</option>
              <option value="LOW">LOW (Blown fuse / sensor telemetry)</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

