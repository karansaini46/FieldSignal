import { IncidentStatus } from "@prisma/client";
import { ValidationError } from "@/lib/errors";

export interface AiApprovalCheckParams {
  isAiExtracted?: boolean;
  fromVoice?: boolean;
  userConfirmed?: boolean;
  targetStatus?: IncidentStatus;
}

/**
 * Enforces the strict safety requirement:
 * "Do not allow an AI extraction result to create a confirmed incident without user approval."
 *
 * If a payload originates from speech ASR or automated extraction, it must either remain in
 * DRAFT state or provide explicit user confirmation before becoming an active incident.
 */
export function assertAiExtractionApproval({
  isAiExtracted,
  fromVoice,
  userConfirmed,
  targetStatus = "SUBMITTED",
}: AiApprovalCheckParams): void {
  const isAutomated = Boolean(isAiExtracted || fromVoice);

  if (isAutomated && targetStatus !== "DRAFT" && !userConfirmed) {
    throw new ValidationError(
      "AI extraction results require explicit user review and confirmation before creating a confirmed incident."
    );
  }
}

