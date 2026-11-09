import { IncidentPriority, FaultCategory, AssetType } from "@prisma/client";

export interface PrioritySuggestionInput {
  faultCategory: FaultCategory;
  assetType?: AssetType | null;
  repeatCount30d?: number;
  title?: string;
  symptoms?: string | null;
  errorCode?: string | null;
}

export interface PrioritySuggestionResult {
  suggestedPriority: IncidentPriority;
  confidence: number; // 0.0 to 1.0
  reasoning: string[];
}

const PRIORITY_ORDER: IncidentPriority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

function escalatePriority(current: IncidentPriority, levels = 1): IncidentPriority {
  const currentIndex = PRIORITY_ORDER.indexOf(current);
  const newIndex = Math.min(PRIORITY_ORDER.length - 1, currentIndex + levels);
  return PRIORITY_ORDER[newIndex] || "CRITICAL";
}

/**
 * Deterministic, domain-grounded solar priority suggestion engine.
 * Evaluates safety hazards, asset generation capacity, and fault recurrence frequency.
 */
export function suggestIncidentPriority(
  input: PrioritySuggestionInput
): PrioritySuggestionResult {
  const reasoning: string[] = [];
  let basePriority: IncidentPriority = "MEDIUM";
  let confidence = 0.85;

  const fullText = `${input.title || ""} ${input.symptoms || ""} ${input.errorCode || ""}`.toLowerCase();

  // 1. Critical safety hazard keywords
  const safetyKeywords = ["smoke", "fire", "spark", "burn", "explosion", "shock", "flame", "blast"];
  const hasSafetyKeyword = safetyKeywords.some((w) => fullText.includes(w));

  if (input.faultCategory === "DC_ARC_FIRE" || hasSafetyKeyword) {
    reasoning.push("DC arc, smoke, or fire thermal hazard detected (Mandatory safety priority)");
    return {
      suggestedPriority: "CRITICAL",
      confidence: 0.98,
      reasoning,
    };
  }

  // 2. Base priority by fault category
  switch (input.faultCategory) {
    case "GRID_TRIP":
      basePriority = "CRITICAL";
      confidence = 0.95;
      reasoning.push("Grid trip causes total power export shutdown");
      break;
    case "INSULATION_FAILURE":
    case "EARTH_FAULT":
      basePriority = "HIGH";
      confidence = 0.9;
      reasoning.push("Earth fault / insulation failure presents personnel shock & equipment damage risk");
      break;
    case "OVER_TEMPERATURE":
      basePriority = input.assetType === "INVERTER" || input.assetType === "TRANSFORMER" ? "HIGH" : "MEDIUM";
      confidence = 0.88;
      reasoning.push(
        input.assetType === "INVERTER" || input.assetType === "TRANSFORMER"
          ? "High temperature on heavy generation equipment risks irreversible IGBT/winding breakdown"
          : "Elevated temperature warning"
      );
      break;
    case "TRACKER_FAILURE":
      basePriority = "MEDIUM";
      confidence = 0.85;
      reasoning.push("Tracker slew failure causes up to 25% generation loss on affected table");
      break;
    case "STRING_UNDERPERFORMANCE":
    case "FUSE_BLOWN":
      basePriority = "LOW";
      confidence = 0.82;
      reasoning.push("Single string or fuse issue localized to sub-branch");
      break;
    case "COMMUNICATION_LOSS":
      basePriority = "LOW";
      confidence = 0.8;
      reasoning.push("SCADA telemetry loss with nominal local power conversion");
      break;
    default:
      basePriority = "MEDIUM";
      confidence = 0.75;
      reasoning.push("Standard operational maintenance priority");
      break;
  }

  // 3. Equipment Impact Escalation
  if (input.assetType === "TRANSFORMER" && basePriority !== "CRITICAL") {
    basePriority = escalatePriority(basePriority, 1);
    reasoning.push("Substation transformer outage affects entire facility block (escalated +1)");
  } else if (input.assetType === "INVERTER" && basePriority === "LOW") {
    basePriority = "MEDIUM";
    reasoning.push("Central/String Inverter impacts multiple string feeds");
  }

  // 4. Repeat Fault Frequency Escalation
  const repeats = input.repeatCount30d || 0;
  if (repeats >= 3) {
    basePriority = "CRITICAL";
    confidence = Math.min(0.96, confidence + 0.1);
    reasoning.push(`Chronic repeat failure (${repeats} faults in past 30 days) indicates systemic defect`);
  } else if (repeats >= 1 && basePriority !== "CRITICAL") {
    basePriority = escalatePriority(basePriority, 1);
    confidence = Math.min(0.92, confidence + 0.05);
    reasoning.push(`Recurring fault (${repeats} previous trip in 30 days, escalated +1)`);
  }

  return {
    suggestedPriority: basePriority,
    confidence: Number(confidence.toFixed(2)),
    reasoning,
  };
}

