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
 */
export const INCIDENT_TRANSITIONS: StateTransitionRule[] = [
  {
    from: "DRAFT",
    to: "OPEN",
    allowedRoles: ["FIELD_TECH", "SITE_SUPERVISOR", "PLANT_MANAGER"],
    description: "Technician or supervisor confirms draft and logs incident ticket",
  },
  {
    from: "OPEN",
    to: "ASSIGNED",
    allowedRoles: ["SITE_SUPERVISOR", "PLANT_MANAGER"],
    description: "Supervisor assigns incident to a maintenance technician",
  },
  {
    from: "OPEN",
    to: "REJECTED",
    allowedRoles: ["SITE_SUPERVISOR", "PLANT_MANAGER"],
    description: "Supervisor rejects false alarm or duplicate ticket",
  },
  {
    from: "ASSIGNED",
    to: "IN_PROGRESS",
    allowedRoles: ["FIELD_TECH", "SITE_SUPERVISOR", "PLANT_MANAGER"],
    description: "Assigned technician begins on-site inspection or repair",
  },
  {
    from: "ASSIGNED",
    to: "REJECTED",
    allowedRoles: ["SITE_SUPERVISOR", "PLANT_MANAGER"],
    description: "Supervisor cancels assignment and rejects ticket",
  },
  {
    from: "IN_PROGRESS",
    to: "RESOLVED",
    allowedRoles: ["FIELD_TECH", "SITE_SUPERVISOR", "PLANT_MANAGER"],
    description: "Technician completes physical repair and logs resolution notes",
  },
  {
    from: "RESOLVED",
    to: "CLOSED",
    allowedRoles: ["SITE_SUPERVISOR", "PLANT_MANAGER"],
    description: "Supervisor verifies SCADA generation is restored and closes ticket",
  },
  {
    from: "RESOLVED",
    to: "IN_PROGRESS",
    allowedRoles: ["SITE_SUPERVISOR", "PLANT_MANAGER"],
    description: "Supervisor finds fault persisting and reopens ticket",
  },
];

/**
 * Validates whether a state transition is legal according to business rules and user role.
 */
export function validateIncidentTransition(
  fromStatus: IncidentStatus,
  toStatus: IncidentStatus,
  userRole: UserRole
): void {
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
      `Role ${userRole} is not authorized to transition incident from ${fromStatus} to ${toStatus}.`,
      403,
      "FORBIDDEN"
    );
  }
}
