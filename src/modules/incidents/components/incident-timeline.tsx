import React from "react";
import { IncidentEventType, IncidentStatus, UserRole } from "@prisma/client";
import { INCIDENT_STATUS_META } from "@/modules/incidents/types";
import {
  Clock,
  User,
  CheckCircle2,
  UserCheck,
  FileText,
  Activity,
  ArrowRight,
  RotateCcw,
  ShieldCheck,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface TimelineEvent {
  id: string;
  eventType: IncidentEventType;
  fromStatus: IncidentStatus | null;
  toStatus: IncidentStatus | null;
  title: string;
  description: string | null;
  diff?: unknown;
  createdAt: string | Date;
  user: {
    id: string;
    name: string;
    role: UserRole;
  };
}

interface IncidentTimelineProps {
  events: TimelineEvent[];
}

export function IncidentTimeline({ events }: IncidentTimelineProps) {
  if (!events || events.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-neutral-400 font-mono">
        No event history logged for this ticket yet.
      </div>
    );
  }

  const getEventIcon = (type: IncidentEventType) => {
    switch (type) {
      case "CONFIRMATION":
        return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
      case "ASSIGNMENT":
        return <UserCheck className="h-4 w-4 text-blue-600" />;
      case "STATUS_CHANGE":
        return <Activity className="h-4 w-4 text-indigo-600" />;
      case "APPROVAL":
        return <ShieldCheck className="h-4 w-4 text-amber-600" />;
      case "REOPENED":
        return <RotateCcw className="h-4 w-4 text-rose-600" />;
      default:
        return <FileText className="h-4 w-4 text-neutral-500" />;
    }
  };

  const getEventBadge = (type: IncidentEventType) => {
    switch (type) {
      case "CONFIRMATION":
        return "bg-emerald-50 text-emerald-800 border-emerald-200";
      case "ASSIGNMENT":
        return "bg-blue-50 text-blue-800 border-blue-200";
      case "STATUS_CHANGE":
        return "bg-indigo-50 text-indigo-800 border-indigo-200";
      case "APPROVAL":
        return "bg-amber-50 text-amber-800 border-amber-200";
      case "REOPENED":
        return "bg-rose-50 text-rose-800 border-rose-200";
      default:
        return "bg-neutral-100 text-neutral-700 border-neutral-200";
    }
  };

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-neutral-200">
      {events.map((event) => {
        const fromMeta = event.fromStatus ? INCIDENT_STATUS_META[event.fromStatus] : null;
        const toMeta = event.toStatus ? INCIDENT_STATUS_META[event.toStatus] : null;

        return (
          <div key={event.id} className="relative group">
            {/* Timeline Node Dot */}
            <div className="absolute -left-6 top-1 h-5 w-5 rounded-full bg-white border border-neutral-300 shadow-2xs flex items-center justify-center">
              {getEventIcon(event.eventType)}
            </div>

            {/* Event Body */}
            <div className="rounded-lg border border-neutral-200 bg-white p-3.5 space-y-2 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border",
                      getEventBadge(event.eventType)
                    )}
                  >
                    {event.eventType.replace(/_/g, " ")}
                  </span>
                  <h3 className="text-xs font-bold text-neutral-900">{event.title}</h3>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] font-mono text-neutral-400">
                  <Clock className="h-3 w-3" />
                  <span>{new Date(event.createdAt).toLocaleString()}</span>
                </div>
              </div>

              {/* Status Transition Pill if present */}
              {fromMeta && toMeta && event.fromStatus !== event.toStatus && (
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-neutral-50 border border-neutral-200 text-[11px] font-mono">
                  <span className={cn("px-1.5 py-0.2 rounded border font-semibold", fromMeta.badge)}>
                    {fromMeta.label}
                  </span>
                  <ArrowRight className="h-3 w-3 text-neutral-400" />
                  <span className={cn("px-1.5 py-0.2 rounded border font-semibold", toMeta.badge)}>
                    {toMeta.label}
                  </span>
                </div>
              )}

              {/* Event Description */}
              {event.description && (
                <p className="text-xs text-neutral-700 leading-relaxed font-sans">
                  {event.description}
                </p>
              )}

              {/* Actor Attribution */}
              <div className="flex items-center justify-between pt-1 border-t border-neutral-100 text-[11px] font-mono text-neutral-500">
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3 text-neutral-400" />
                  <span>
                    Action by: <span className="font-semibold text-neutral-800">{event.user.name}</span>{" "}
                    ({event.user.role})
                  </span>
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

