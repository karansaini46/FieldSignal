"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  HistoricalIntelligenceReport,
  HistoricalIncidentItem,
  HistoricalIncidentLabel,
  RepeatedSymptomItem,
} from "../historical-intelligence";
import { INCIDENT_STATUS_META } from "../types";
import {
  History,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Layers,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Wrench,
  Tag,
  Activity,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface HistoricalIntelligenceCardProps {
  report: HistoricalIntelligenceReport;
  className?: string;
  isCompact?: boolean;
}

export function HistoricalIntelligenceCard({
  report,
  className,
  isCompact = false,
}: HistoricalIntelligenceCardProps) {
  const [selectedFilter, setSelectedFilter] = useState<"ALL" | "SAME_ASSET" | "SIMILAR_SYMPTOM" | "UNRESOLVED">("ALL");
  const [isExpanded, setIsExpanded] = useState(true);

  const incidentsToDisplay = report.allRelevantIncidents.filter((inc) => {
    if (selectedFilter === "SAME_ASSET") return inc.labels.includes("Same asset");
    if (selectedFilter === "SIMILAR_SYMPTOM") return inc.labels.includes("Similar reported symptom");
    if (selectedFilter === "UNRESOLVED") return inc.labels.includes("Unresolved incident");
    return true;
  });

  return (
    <div
      className={cn(
        "rounded-lg border border-neutral-200 bg-white p-5 space-y-4 shadow-2xs",
        className
      )}
    >
      {/* Header with Title and Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-neutral-200 gap-2">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-indigo-600" />
          <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-neutral-900">
            Historical Incident Intelligence
          </h2>
          {report.targetAsset && (
            <span className="text-[11px] font-mono bg-indigo-50 text-indigo-800 px-2 py-0.5 rounded border border-indigo-200 flex items-center gap-1 font-semibold">
              <Cpu className="h-3 w-3" />
              {report.targetAsset.assetTag}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-neutral-500">
            {report.totalPreviousIncidents} historical record
            {report.totalPreviousIncidents !== 1 ? "s" : ""}
          </span>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-neutral-400 hover:text-neutral-700 p-1"
            title={isExpanded ? "Collapse section" : "Expand section"}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-4">
          {/* CRITICAL SAFETY INVARIANT DISCLAIMER */}
          <div className="rounded-md border border-amber-300 bg-amber-50/80 p-3 space-y-1 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-amber-900">
              <ShieldAlert className="h-4 w-4 text-amber-700 shrink-0" />
              <span>{report.rootCauseDisclaimerTitle}</span>
            </div>
            <p className="text-amber-800 text-[11px] leading-relaxed">
              {report.rootCauseDisclaimer}
            </p>
          </div>

          {/* Unresolved Incidents Alert Banner */}
          {report.unresolvedCount > 0 && (
            <div className="rounded-md border border-rose-300 bg-rose-50 p-3 flex items-start gap-2 text-xs">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold text-rose-950">
                  {report.unresolvedCount} Unresolved Incident
                  {report.unresolvedCount !== 1 ? "s" : ""} Currently Open on This Asset
                </span>
                <p className="text-rose-800 text-[11px]">
                  Review active tickets before initiating duplicate work orders:{" "}
                  {report.unresolvedIncidents.map((u, i) => (
                    <Link
                      key={u.id}
                      href={`/incidents/${u.id}`}
                      className="font-mono font-bold underline hover:text-rose-950 inline-block mr-2"
                    >
                      {u.ticketNumber} ({u.status})
                    </Link>
                  ))}
                </p>
              </div>
            </div>
          )}

          {/* Metrics summary pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
            <div className="bg-neutral-50 p-2.5 rounded border border-neutral-200">
              <span className="text-neutral-400 block text-[10px] uppercase">Same Asset</span>
              <span className="text-sm font-bold text-indigo-700">{report.sameAssetCount}</span>
            </div>
            <div className="bg-neutral-50 p-2.5 rounded border border-neutral-200">
              <span className="text-neutral-400 block text-[10px] uppercase">Similar Symptoms</span>
              <span className="text-sm font-bold text-purple-700">{report.similarSymptomsCount}</span>
            </div>
            <div className="bg-neutral-50 p-2.5 rounded border border-neutral-200">
              <span className="text-neutral-400 block text-[10px] uppercase">Unresolved Tickets</span>
              <span className={cn("text-sm font-bold", report.unresolvedCount > 0 ? "text-rose-700" : "text-emerald-700")}>
                {report.unresolvedCount}
              </span>
            </div>
            <div className="bg-neutral-50 p-2.5 rounded border border-neutral-200">
              <span className="text-neutral-400 block text-[10px] uppercase">Repeated Patterns</span>
              <span className="text-sm font-bold text-neutral-800">{report.repeatedSymptoms.length}</span>
            </div>
          </div>

          {/* Repeated Reported Symptoms Section (Requirement 5) */}
          {report.repeatedSymptoms.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-neutral-100">
              <div className="flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-neutral-600" />
                <span className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-800">
                  Repeated Reported Symptoms (Recurring Patterns)
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {report.repeatedSymptoms.map((symptom, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-center gap-2 px-2.5 py-1.5 rounded border text-xs font-mono",
                      symptom.isCurrentIncidentMatch
                        ? "bg-purple-50 text-purple-900 border-purple-300 font-semibold"
                        : "bg-neutral-50 text-neutral-700 border-neutral-200"
                    )}
                  >
                    <span>{symptom.displayName}</span>
                    <span
                      className={cn(
                        "px-1.5 py-0.2 rounded text-[10px] font-bold",
                        symptom.isCurrentIncidentMatch
                          ? "bg-purple-200 text-purple-900"
                          : "bg-neutral-200 text-neutral-800"
                      )}
                    >
                      {symptom.occurrenceCount}x reported
                    </span>
                    {symptom.isCurrentIncidentMatch && (
                      <span className="text-[10px] text-purple-700 bg-purple-100 px-1 py-0.2 rounded border border-purple-200">
                        Current Match
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-100 text-xs">
            <div className="flex items-center gap-1.5 font-mono text-neutral-500 text-[11px]">
              <Filter className="h-3 w-3" />
              <span>Filter View:</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedFilter("ALL")}
                className={cn(
                  "px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer",
                  selectedFilter === "ALL"
                    ? "bg-neutral-900 text-white font-bold"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                )}
              >
                All ({report.allRelevantIncidents.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedFilter("SAME_ASSET")}
                className={cn(
                  "px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer",
                  selectedFilter === "SAME_ASSET"
                    ? "bg-indigo-700 text-white font-bold"
                    : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                )}
              >
                Same Asset ({report.sameAssetCount})
              </button>
              <button
                type="button"
                onClick={() => setSelectedFilter("SIMILAR_SYMPTOM")}
                className={cn(
                  "px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer",
                  selectedFilter === "SIMILAR_SYMPTOM"
                    ? "bg-purple-700 text-white font-bold"
                    : "bg-purple-50 text-purple-700 hover:bg-purple-100"
                )}
              >
                Similar Symptom ({report.similarSymptomsCount})
              </button>
              <button
                type="button"
                onClick={() => setSelectedFilter("UNRESOLVED")}
                className={cn(
                  "px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer",
                  selectedFilter === "UNRESOLVED"
                    ? "bg-rose-700 text-white font-bold"
                    : "bg-rose-50 text-rose-800 hover:bg-rose-100"
                )}
              >
                Unresolved ({report.unresolvedCount})
              </button>
            </div>
          </div>

          {/* List of Previous Incidents */}
          <div className="space-y-3 pt-1">
            {incidentsToDisplay.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-neutral-200 rounded-lg font-mono text-xs text-neutral-400">
                No historical incidents found matching the selected filter.
              </div>
            ) : (
              incidentsToDisplay.map((item) => (
                <HistoricalIncidentListItem key={item.id} item={item} isCompact={isCompact} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function HistoricalIncidentListItem({
  item,
  isCompact,
}: {
  item: HistoricalIncidentItem;
  isCompact?: boolean;
}) {
  const statusMeta = INCIDENT_STATUS_META[item.status] || {
    label: item.status,
    badge: "bg-neutral-100 text-neutral-700 border-neutral-200",
    dot: "bg-neutral-400",
  };

  const formattedDate = new Date(item.createdAt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50/60 p-3.5 space-y-2 hover:bg-white transition-colors">
      {/* Top line: Ticket number, date, status, and required labels */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/incidents/${item.id}`}
            className="font-mono text-xs font-bold text-blue-700 hover:underline flex items-center gap-1"
          >
            {item.ticketNumber}
            <ExternalLink className="h-3 w-3" />
          </Link>
          <span className="text-[11px] font-mono text-neutral-400 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formattedDate}
          </span>
          <span
            className={cn(
              "text-[10px] font-mono px-2 py-0.5 rounded-full border flex items-center gap-1 font-semibold",
              statusMeta.badge
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", statusMeta.dot)} />
            {statusMeta.label}
          </span>
        </div>

        {/* Required Labels as specified in Requirements */}
        <div className="flex flex-wrap items-center gap-1">
          {item.labels.map((label: HistoricalIncidentLabel, idx: number) => {
            let badgeStyle = "bg-neutral-100 text-neutral-700 border-neutral-200";
            if (label === "Same asset") {
              badgeStyle = "bg-indigo-50 text-indigo-700 border-indigo-200 font-bold";
            } else if (label === "Similar reported symptom") {
              badgeStyle = "bg-purple-50 text-purple-700 border-purple-200 font-bold";
            } else if (label === "Unresolved incident") {
              badgeStyle = "bg-amber-50 text-amber-800 border-amber-300 font-bold";
            } else if (label === "Previous incident") {
              badgeStyle = "bg-neutral-100 text-neutral-600 border-neutral-200";
            }

            return (
              <span
                key={idx}
                className={cn("text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border", badgeStyle)}
              >
                {label}
              </span>
            );
          })}
        </div>
      </div>

      {/* Title & Asset reference */}
      <div className="space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <h4 className="text-xs font-bold text-neutral-900 leading-snug">{item.title}</h4>
          {item.asset && (
            <span className="text-[10px] font-mono text-neutral-500 bg-white px-1.5 py-0.5 rounded border border-neutral-200 shrink-0">
              {item.asset.assetTag}
            </span>
          )}
        </div>
        <p className="text-[11px] text-neutral-700 leading-relaxed line-clamp-2">
          {item.description}
        </p>
      </div>

      {/* Reported Symptoms & Similarity keywords */}
      {(item.symptoms || item.matchingSymptomKeywords.length > 0 || item.errorCode) && (
        <div className="bg-white p-2 rounded border border-neutral-200/80 font-mono text-[10px] space-y-1">
          {item.symptoms && (
            <div>
              <span className="text-neutral-400">Reported Symptoms: </span>
              <span className="text-neutral-800 font-medium">{item.symptoms}</span>
            </div>
          )}
          {item.errorCode && (
            <div>
              <span className="text-neutral-400">Alarm Code: </span>
              <span className="text-rose-700 font-bold bg-rose-50 px-1 rounded">{item.errorCode}</span>
            </div>
          )}
          {item.matchingSymptomKeywords.length > 0 && (
            <div className="flex items-center gap-1 pt-0.5">
              <span className="text-purple-600 font-semibold">Matched Patterns:</span>
              <div className="flex flex-wrap gap-1">
                {item.matchingSymptomKeywords.map((kw, i) => (
                  <span key={i} className="bg-purple-50 text-purple-700 px-1 py-0.2 rounded border border-purple-200">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Previously Recorded Actions (Requirement 4) */}
      {(item.recordedActions.length > 0 || item.resolutionNotes) && (
        <div className="bg-emerald-50/60 p-2.5 rounded border border-emerald-200/80 space-y-1 font-mono text-[10px]">
          <span className="font-bold text-emerald-900 flex items-center gap-1 uppercase tracking-wider text-[9px]">
            <Wrench className="h-3 w-3 text-emerald-700" />
            Previously Recorded Actions &amp; Resolution
          </span>
          <div className="space-y-1 text-emerald-950">
            {item.recordedActions.map((action, i) => (
              <div key={i} className="flex items-start gap-1">
                <span className="text-emerald-600 font-bold">•</span>
                <span className="leading-snug">{action}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
