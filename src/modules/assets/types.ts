import { Asset, AssetType, AssetStatus } from "@prisma/client";

export type { Asset, AssetType, AssetStatus };

export interface AssetSummary {
  id: string;
  assetTag: string;
  name: string;
  assetType: AssetType;
  blockIdentifier: string;
  status: AssetStatus;
  plantId: string;
}

export interface AssetSearchQuery {
  plantId: string;
  searchTerm?: string;
  assetType?: AssetType;
  blockIdentifier?: string;
  limit?: number;
}
