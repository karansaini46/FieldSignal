import { UserRole } from "@prisma/client";
import { LucideIcon } from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string | number;
  badgeVariant?: "default" | "secondary" | "outline" | "destructive";
  isAction?: boolean;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export interface SiteSummary {
  id: string;
  name: string;
  code: string;
  capacityMw: number;
  location: string | null;
  status: string;
}

export interface ShellUserSession {
  userId: string;
  name: string;
  phone: string;
  email?: string | null;
  role: UserRole;
  organizationId: string;
  organizationName?: string;
  siteId?: string | null;
  siteName?: string | null;
}

export interface QuickJumpItem {
  id: string;
  tag: string;
  name: string;
  type: string;
  location: string;
  status: string;
}
