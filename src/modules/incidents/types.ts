import { Incident, IncidentStatus, Priority, FaultCategory } from "@prisma/client";

export type { Incident, IncidentStatus, Priority, FaultCategory };

export interface DraftIncident {
  draftId: string;
  audioRecordId: string;
  transcript: string;
  extractedData: {
    assetTag: string | null;
    blockIdentifier: string | null;
    faultCategory: FaultCategory;
    errorCode: string | null;
    severity: Priority;
    title: string;
    description: string;
    symptoms: string | null;
    immediateActionTaken: string | null;
  };
  validation: {
    matchedAssetId: string | null;
    isAssetAmbiguous: boolean;
    missingFields: string[];
    technicianPrompt: string | null;
  };
  assetHistory: {
    hasRecentIncidents: boolean;
    repeatCount30d: number;
    warningMessage: string | null;
  };
}

export interface IncidentFilterOptions {
  plantId: string;
  status?: IncidentStatus;
  priority?: Priority;
  assetId?: string;
  block?: string;
  assignedToUserId?: string;
  page?: number;
  limit?: number;
}
