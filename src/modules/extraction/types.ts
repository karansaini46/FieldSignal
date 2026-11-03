import { FaultCategory, Priority } from "@prisma/client";

/**
 * AI Incident Extraction schema contracts.
 */
export interface ExtractedIncidentData {
  assetTag: string | null;
  blockIdentifier: string | null;
  faultCategory: FaultCategory;
  errorCode: string | null;
  severity: Priority;
  title: string;
  description: string;
  symptoms: string | null;
  immediateActionTaken: string | null;
  confidenceScore: number;
}

export interface IExtractionService {
  extractIncidentFromTranscript(
    transcript: string,
    plantContext?: { plantName: string; knownAssetTags?: string[] }
  ): Promise<ExtractedIncidentData>;
}
