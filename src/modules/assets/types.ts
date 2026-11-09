import { Asset, AssetType, AssetStatus } from "@prisma/client";

export type { Asset, AssetType, AssetStatus };

export const SUPPORTED_EQUIPMENT_TYPES: { value: AssetType; label: string; description: string }[] = [
  { value: "INVERTER", label: "Inverter", description: "Central or String Inverter units" },
  { value: "SOLAR_MODULE", label: "Solar Module", description: "PV module strings & panel arrays" },
  { value: "COMBINER_BOX", label: "Combiner Box", description: "DC string combiner / junction boxes" },
  { value: "TRANSFORMER", label: "Transformer", description: "Step-up & power transformers" },
  { value: "OTHER", label: "Other", description: "Switchgear, sensors, tracker controllers & auxiliary" },
];

export const ASSET_STATUS_OPTIONS: { value: AssetStatus; label: string; color: string }[] = [
  { value: "OPERATIONAL", label: "Operational", color: "emerald" },
  { value: "DEGRADED", label: "Degraded", color: "amber" },
  { value: "FAULTED", label: "Faulted", color: "rose" },
  { value: "MAINTENANCE", label: "Maintenance", color: "blue" },
  { value: "DECOMMISSIONED", label: "Decommissioned", color: "neutral" },
];

export interface AssetSummary {
  id: string;
  assetTag: string;
  name: string;
  assetType: AssetType;
  block: string;
  row?: string | null;
  status: AssetStatus;
  siteId: string;
  siteName?: string;
  manufacturer?: string | null;
  model?: string | null;
  ratedCapacityKw?: number | null;
  incidentCount?: number;
}

export interface AssetSearchQuery {
  siteId?: string;
  searchTerm?: string;
  assetType?: AssetType;
  status?: AssetStatus;
  block?: string;
  limit?: number;
  page?: number;
}
