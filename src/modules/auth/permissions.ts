import { UserRole } from "@prisma/client";

export interface AuthSession {
  userId: string;
  name: string;
  phone: string;
  role: UserRole;
  plantId: string;
}

export type PermissionAction =
  | "VOICE_REPORT"
  | "CONFIRM_DRAFT"
  | "VIEW_PLANT_INCIDENTS"
  | "ASSIGN_INCIDENT"
  | "UPDATE_INCIDENT_STATUS"
  | "CLOSE_INCIDENT"
  | "MANAGE_ASSETS"
  | "MANAGE_USERS";

/**
 * Role-Based Access Control (RBAC) permission map for FieldSignal.
 */
export const ROLE_PERMISSIONS: Record<UserRole, PermissionAction[]> = {
  FIELD_TECH: ["VOICE_REPORT", "CONFIRM_DRAFT", "VIEW_PLANT_INCIDENTS", "UPDATE_INCIDENT_STATUS"],
  SITE_SUPERVISOR: [
    "VOICE_REPORT",
    "CONFIRM_DRAFT",
    "VIEW_PLANT_INCIDENTS",
    "ASSIGN_INCIDENT",
    "UPDATE_INCIDENT_STATUS",
    "CLOSE_INCIDENT",
  ],
  PLANT_MANAGER: [
    "VOICE_REPORT",
    "CONFIRM_DRAFT",
    "VIEW_PLANT_INCIDENTS",
    "ASSIGN_INCIDENT",
    "UPDATE_INCIDENT_STATUS",
    "CLOSE_INCIDENT",
    "MANAGE_ASSETS",
    "MANAGE_USERS",
  ],
};

export function hasPermission(role: UserRole, action: PermissionAction): boolean {
  return ROLE_PERMISSIONS[role]?.includes(action) ?? false;
}
