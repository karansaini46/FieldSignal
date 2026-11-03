import { UserRole } from "@prisma/client";

export interface AuthSession {
  userId: string;
  name: string;
  phone: string;
  email?: string | null;
  role: UserRole;
  organizationId: string;
  siteId?: string | null;
}

export type PermissionAction =
  | "VOICE_REPORT"
  | "CONFIRM_DRAFT"
  | "VIEW_INCIDENTS"
  | "UPDATE_WORK_PROGRESS"
  | "ASSIGN_INCIDENT"
  | "OVERRIDE_PRIORITY"
  | "CLOSE_INCIDENT"
  | "REJECT_INCIDENT"
  | "MANAGE_ASSETS"
  | "MANAGE_USERS"
  | "MANAGE_SITES";

/**
 * Fields that only SUPERVISOR or ADMIN can modify on an incident.
 * If a TECHNICIAN attempts to mutate any of these fields, the request is rejected with 403 Forbidden.
 */
export const SUPERVISOR_ONLY_FIELDS = ["assignedToUserId", "priority", "closedAt"] as const;

/**
 * Role-Based Access Control (RBAC) permission map for FieldSignal.
 */
export const ROLE_PERMISSIONS: Record<UserRole, PermissionAction[]> = {
  TECHNICIAN: ["VOICE_REPORT", "CONFIRM_DRAFT", "VIEW_INCIDENTS", "UPDATE_WORK_PROGRESS"],
  SUPERVISOR: [
    "VOICE_REPORT",
    "CONFIRM_DRAFT",
    "VIEW_INCIDENTS",
    "UPDATE_WORK_PROGRESS",
    "ASSIGN_INCIDENT",
    "OVERRIDE_PRIORITY",
    "CLOSE_INCIDENT",
    "REJECT_INCIDENT",
  ],
  ADMIN: [
    "VOICE_REPORT",
    "CONFIRM_DRAFT",
    "VIEW_INCIDENTS",
    "UPDATE_WORK_PROGRESS",
    "ASSIGN_INCIDENT",
    "OVERRIDE_PRIORITY",
    "CLOSE_INCIDENT",
    "REJECT_INCIDENT",
    "MANAGE_ASSETS",
    "MANAGE_USERS",
    "MANAGE_SITES",
  ],
};

export function hasPermission(role: UserRole, action: PermissionAction): boolean {
  return ROLE_PERMISSIONS[role]?.includes(action) ?? false;
}
