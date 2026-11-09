import {
  Incident,
  IncidentStatus,
  IncidentPriority,
  FaultCategory,
  IncidentEventType,
} from "@prisma/client";

export type {
  Incident,
  IncidentStatus,
  IncidentPriority,
  FaultCategory,
  IncidentEventType,
};

export const INCIDENT_STATUS_META: Record<
  IncidentStatus,
  { label: string; badge: string; dot: string; description: string }
> = {
  DRAFT: {
    label: "Draft",
    badge: "bg-neutral-100 text-neutral-700 border-neutral-300",
    dot: "bg-neutral-400",
    description: "Initial unconfirmed report or voice extraction draft awaiting user approval",
  },
  NEEDS_CLARIFICATION: {
    label: "Needs Clarification",
    badge: "bg-purple-50 text-purple-800 border-purple-200",
    dot: "bg-purple-500",
    description: "Missing required telemetry, ambiguous equipment tag, or pending technician prompt",
  },
  SUBMITTED: {
    label: "Submitted",
    badge: "bg-amber-50 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
    description: "Confirmed incident logged and queued for supervisory dispatch",
  },
  ACKNOWLEDGED: {
    label: "Acknowledged",
    badge: "bg-blue-50 text-blue-800 border-blue-200",
    dot: "bg-blue-500",
    description: "Supervisor reviewed, confirmed priority, and assigned to maintenance technician",
  },
  IN_PROGRESS: {
    label: "In Progress",
    badge: "bg-indigo-50 text-indigo-800 border-indigo-200",
    dot: "bg-indigo-500",
    description: "Field personnel actively performing on-site inspection or component replacement",
  },
  RESOLVED: {
    label: "Resolved",
    badge: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
    description: "Physical repairs completed, resolution documented, generation restoration pending sign-off",
  },
  CLOSED: {
    label: "Closed",
    badge: "bg-neutral-100 text-neutral-600 border-neutral-200",
    dot: "bg-neutral-500",
    description: "Supervisor verified SCADA telemetry generation recovery and finalized work order",
  },
};

export const INCIDENT_PRIORITY_META: Record<
  IncidentPriority,
  { label: string; badge: string; dot: string; description: string }
> = {
  CRITICAL: {
    label: "Critical",
    badge: "bg-rose-100 text-rose-800 border-rose-300",
    dot: "bg-rose-600",
    description: "Immediate safety hazard, fire/arc risk, or substation trip impacting whole plant",
  },
  HIGH: {
    label: "High",
    badge: "bg-amber-100 text-amber-800 border-amber-300",
    dot: "bg-amber-600",
    description: "Major inverter failure, earth fault, or severe generation loss",
  },
  MEDIUM: {
    label: "Medium",
    badge: "bg-blue-100 text-blue-800 border-blue-300",
    dot: "bg-blue-600",
    description: "Combiner box failure, tracker mechanical jam, or string underperformance",
  },
  LOW: {
    label: "Low",
    badge: "bg-neutral-100 text-neutral-700 border-neutral-200",
    dot: "bg-neutral-500",
    description: "Blown string fuse, sensor drift, or non-critical cosmetic wear",
  },
};

export const FAULT_CATEGORY_LABELS: Record<FaultCategory, string> = {
  OVER_TEMPERATURE: "Over-Temperature Fault",
  INSULATION_FAILURE: "Insulation Breakdown",
  EARTH_FAULT: "DC / AC Earth Fault",
  GRID_TRIP: "Grid Synchronization Trip",
  COMMUNICATION_LOSS: "SCADA / Telemetry Loss",
  TRACKER_FAILURE: "Tracker Slew / Drive Jam",
  DC_ARC_FIRE: "DC Arc Flash / Thermal Hazard",
  STRING_UNDERPERFORMANCE: "String Degradation",
  FUSE_BLOWN: "Blown Fuse / Breaker Trip",
  MECHANICAL_DAMAGE: "Mechanical Structure Damage",
  OTHER: "General Plant Defect",
};

export interface IncidentFilterOptions {
  siteId?: string;
  status?: IncidentStatus;
  priority?: IncidentPriority;
  faultCategory?: FaultCategory;
  assetId?: string;
  search?: string;
  assignedToUserId?: string;
  reportedByUserId?: string;
  page?: number;
  limit?: number;
}
