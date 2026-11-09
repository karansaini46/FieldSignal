import { IncidentStatus, UserRole } from "@prisma/client";
import { AppError } from "@/lib/errors";

export interface StateTransitionRule {
  from: IncidentStatus;
  to: IncidentStatus;
  allowedRoles: UserRole[];
  description: string;
}

/**
 * Valid state transitions for solar plant maintenance incidents.
 * Enforces server-side validation and role authorization.
 */
export const INCIDENT_TRANSITIONS: StateTransitionRule[] = [
  // 1. DRAFT -> SUBMITTED: User confirms draft
  {
    from: "DRAFT",
    to: "SUBMITTED",
    allowedRoles: ["TECHNICIAN", "SUPERVISOR", "ADMIN"],
    description: "User reviews draft, validates extracted data, and submits official incident ticket",
  },
  // 2. DRAFT -> NEEDS_CLARIFICATION: Missing critical fields or ambiguous equipment
  {
    from: "DRAFT",
    to: "NEEDS_CLARIFICATION",
    allowedRoles: ["TECHNICIAN", "SUPERVISOR", "ADMIN"],
    description: "Draft flagged for missing critical operational details or clarification",
  },
  // 3. NEEDS_CLARIFICATION -> SUBMITTED: Clarification answered
  {
    from: "NEEDS_CLARIFICATION",
    to: "SUBMITTED",
    allowedRoles: ["TECHNICIAN", "SUPERVISOR", "ADMIN"],
    description: "Clarification provided, validated, and ticket submitted to active queue",
  },
  // 4. SUBMITTED -> ACKNOWLEDGED: Supervisor acknowledges ticket
  {
    from: "SUBMITTED",
    to: "ACKNOWLEDGED",
    allowedRoles: ["SUPERVISOR", "ADMIN"],
    description: "Supervisor reviews incident, acknowledges ticket, and coordinates dispatch",
  },
  // 5. SUBMITTED -> NEEDS_CLARIFICATION: Supervisor requests additional field info
  {
    from: "SUBMITTED",
    to: "NEEDS_CLARIFICATION",
    allowedRoles: ["SUPERVISOR", "ADMIN"],
    description: "Supervisor requests clarification from field reporter",
  },
  // 6. SUBMITTED -> IN_PROGRESS: Direct rapid response
  {
    from: "SUBMITTED",
    to: "IN_PROGRESS",
    allowedRoles: ["TECHNICIAN", "SUPERVISOR", "ADMIN"],
    description: "Immediate triage and repair commenced on-site",
  },
  // 7. ACKNOWLEDGED -> IN_PROGRESS: Assigned technician begins work
  {
    from: "ACKNOWLEDGED",
    to: "IN_PROGRESS",
    allowedRoles: ["TECHNICIAN", "SUPERVISOR", "ADMIN"],
    description: "Technician arrives at equipment and commences physical work",
  },
  // 8. ACKNOWLEDGED -> NEEDS_CLARIFICATION: Clarification needed prior to dispatch
  {
    from: "ACKNOWLEDGED",
    to: "NEEDS_CLARIFICATION",
    allowedRoles: ["TECHNICIAN", "SUPERVISOR", "ADMIN"],
    description: "Technician or supervisor identifies missing documentation or parts",
  },
  // 9. IN_PROGRESS -> RESOLVED: Technician completes repair
  {
    from: "IN_PROGRESS",
    to: "RESOLVED",
    allowedRoles: ["TECHNICIAN", "SUPERVISOR", "ADMIN"],
    description: "Technician completes physical repair and logs resolution notes",
  },
  // 10. IN_PROGRESS -> NEEDS_CLARIFICATION: Work blocked
  {
    from: "IN_PROGRESS",
    to: "NEEDS_CLARIFICATION",
    allowedRoles: ["TECHNICIAN", "SUPERVISOR", "ADMIN"],
    description: "Repair blocked pending OEM or engineering clarification",
  },
  // 11. RESOLVED -> CLOSED: Supervisor verification and sign-off
  {
    from: "RESOLVED",
    to: "CLOSED",
    allowedRoles: ["SUPERVISOR", "ADMIN"],
    description: "Supervisor verifies SCADA power generation recovery and permanently closes ticket",
  },
  // 12. RESOLVED -> IN_PROGRESS: Supervisor reopens unresolved issue
  {
    from: "RESOLVED",
    to: "IN_PROGRESS",
    allowedRoles: ["SUPERVISOR", "ADMIN"],
    description: "Supervisor finds fault persisting in SCADA telemetry and reopens ticket",
  },
  // 13. CLOSED -> IN_PROGRESS: Reopen ticket if defect recurs
  {
    from: "CLOSED",
    to: "IN_PROGRESS",
    allowedRoles: ["SUPERVISOR", "ADMIN"],
    description: "Supervisor reopens closed ticket due to recurring defect",
  },
];

/**
 * Validates whether a state transition is legal according to business rules and user role.
 * Throws 400 Bad Request if illegal transition, or 403 Forbidden if user role is not authorized.
 */
export function validateIncidentTransition(
  fromStatus: IncidentStatus,
  toStatus: IncidentStatus,
  userRole: UserRole
): void {
  if (fromStatus === toStatus) {
    return; // No-op transition
  }

  const rule = INCIDENT_TRANSITIONS.find((t) => t.from === fromStatus && t.to === toStatus);

  if (!rule) {
    throw new AppError(
      `Invalid incident status transition from ${fromStatus} to ${toStatus}.`,
      400,
      "BAD_REQUEST"
    );
  }

  if (!rule.allowedRoles.includes(userRole)) {
    throw new AppError(
      `Role ${userRole} is not authorized to transition incident from ${fromStatus} to ${toStatus}. Only ${rule.allowedRoles.join(", ")} may execute this transition.`,
      403,
      "FORBIDDEN"
    );
  }
}

/**
 * Returns list of allowed target statuses from the current status for a given role.
 */
export function getAllowedTransitions(
  currentStatus: IncidentStatus,
  userRole: UserRole
): { status: IncidentStatus; description: string }[] {
  return INCIDENT_TRANSITIONS.filter(
    (rule) => rule.from === currentStatus && rule.allowedRoles.includes(userRole)
  ).map((rule) => ({ status: rule.to, description: rule.description }));
}
