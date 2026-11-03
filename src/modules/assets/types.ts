import { Asset, AssetType, AssetStatus } from "@prisma/client";

export type { Asset, AssetType, AssetStatus };

export interface AssetSummary {
  id: string;
  assetTag: string;
  name: string;
  assetType: AssetType;
  block: string;
  status: AssetStatus;
  siteId: string;
}

export interface AssetSearchQuery {
  siteId: string;
  searchTerm?: string;
  assetType?: AssetType;
  block?: string;
  limit?: number;
}
