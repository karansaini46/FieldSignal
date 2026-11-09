"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Mic,
  MicOff,
  Radio,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Thermometer,
  Sun,
  ShieldCheck,
  ChevronRight,
  ArrowRight,
  Check,
  Layers,
  FileText,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface IncidentItem {
  id: string;
  ticketNumber: string;
  title: string;
  priority: string;
  status: string;
  faultCategory: string;
  createdAt: Date | string;
  asset?: {
    assetTag: string;
    block?: string | null;
  } | null;
  site: {
    name: string;
    code: string;
  };
}

interface TechnicianDashboardProps {
  technicianName: string;
  siteName: string;
  siteCode: string;
  assignedIncidents: IncidentItem[];
}

export function TechnicianDashboard({
  technicianName,
  siteName,
  siteCode,
  assignedIncidents,
}: TechnicianDashboardProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [checklist, setChecklist] = useState({
    loto: true,
    ppe: true,
    hydration: false,
    permit: true,
  });

  function handleRecordToggle() {
    if (!isRecording) {
      setIsRecording(true);
      setTranscript(null);
      // ponytail: Simulated field voice recording state for technician interface testing
      setTimeout(() => {
        setIsRecording(false);
        setTranscript(
          "BHA-INV-01 mein IGBT over-temperature alarm aaya hai. Error code E-402 show ho raha hai, inverter trip kar gaya hai."
        );
      }, 3500);
    } else {
      setIsRecording(false);
    }
  }

  const priorityStyles: Record<string, string> = {
    CRITICAL: "bg-rose-50 text-rose-800 border-rose-200",
    HIGH: "bg-amber-50 text-amber-800 border-amber-200",
    MEDIUM: "bg-blue-50 text-blue-800 border-blue-200",
    LOW: "bg-neutral-100 text-neutral-700 border-neutral-200",
  };

  const statusStyles: Record<string, string> = {
    ASSIGNED: "bg-amber-50 text-amber-800 border-amber-200",
    IN_PROGRESS: "bg-blue-50 text-blue-800 border-blue-200",
    RESOLVED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* 1. Field Operator Header & Environmental Telemetry */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-mono font-semibold text-neutral-500 uppercase tracking-wider">
              Field Technician Console
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 mt-0.5">
            {technicianName}
          </h1>
          <p className="text-xs text-neutral-500 flex items-center gap-1.5 mt-0.5">
            <MapPin className="h-3.5 w-3.5 text-neutral-400" />
            <span className="font-medium text-neutral-700">{siteName}</span>
            <span className="font-mono text-[11px] text-neutral-400">({siteCode})</span>
          </p>
        </div>

        {/* Ambient Site Telemetry Strip (Identified Demo SCADA Feed) */}
        <div className="flex items-center gap-2 text-xs font-mono bg-white border border-neutral-200 rounded-md p-2 shadow-2xs">
          <div className="px-2 border-r border-neutral-200">
            <div className="text-[10px] text-neutral-400 uppercase font-sans">Irradiance</div>
            <div className="font-bold text-neutral-800 flex items-center gap-1">
              <Sun className="h-3 w-3 text-amber-500" />
              915 W/m²
            </div>
          </div>
          <div className="px-2 border-r border-neutral-200">
            <div className="text-[10px] text-neutral-400 uppercase font-sans">Ambient Temp</div>
            <div className="font-bold text-neutral-800 flex items-center gap-1">
              <Thermometer className="h-3 w-3 text-rose-500" />
              42.8 °C
            </div>
          </div>
          <div className="px-2">
            <div className="text-[10px] text-neutral-400 uppercase font-sans">SCADA Link</div>
            <div className="text-emerald-700 font-semibold flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Active
            </div>
          </div>
        </div>
      </div>

      {/* 2. Primary Voice Incident Capture Console (Large Rugged Button) */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-1.5 text-center sm:text-left max-w-md">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-amber-50 text-amber-800 border border-amber-200">
              <Radio className="h-3 w-3 text-amber-600" />
              Voice-First Incident Engine
            </div>
            <h2 className="text-base sm:text-lg font-bold text-neutral-900">
              Report Equipment Fault via Voice
            </h2>
            <p className="text-xs text-neutral-600 leading-relaxed">
              Speak in Hindi, Hinglish, or English. Include the asset tag (e.g.{" "}
              <code className="font-mono bg-neutral-100 px-1 py-0.2 rounded text-neutral-800">
                BHA-INV-01
              </code>
              ) and inverter error code.
            </p>
          </div>

          <div className="flex flex-col items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleRecordToggle}
              className={cn(
                "relative flex h-18 w-18 items-center justify-center rounded-full transition-all focus:outline-none focus:ring-4 select-none",
                isRecording
                  ? "bg-rose-600 text-white ring-rose-200 shadow-lg scale-105"
                  : "bg-amber-600 text-white hover:bg-amber-500 active:scale-95 shadow-md shadow-amber-600/20 ring-amber-200"
              )}
            >
              {isRecording ? <MicOff className="h-8 w-8 animate-pulse" /> : <Mic className="h-8 w-8" />}
            </button>
            <span className="text-[11px] font-mono text-neutral-500">
              {isRecording ? "Listening... (Tap to Finish)" : "Tap & Hold to Speak"}
            </span>
          </div>
        </div>

        {/* Real-time speech transcription preview */}
        {transcript && (
          <div className="mt-4 pt-4 border-t border-neutral-100 bg-neutral-50 rounded-md p-3 text-xs space-y-2">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="font-semibold text-neutral-700 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Audio Transcribed (Gnani AI)
              </span>
              <span className="font-mono text-[10px]">Confidence: 94.2%</span>
            </div>
            <p className="font-mono text-neutral-800 text-xs italic bg-white p-2 rounded border border-neutral-200">
              &ldquo;{transcript}&rdquo;
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Link
                href="/incidents"
                className="px-3 py-1.5 rounded bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition-colors"
              >
                Confirm Incident Draft
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* 3. Assigned Work Orders Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wide">
              Assigned Field Work Orders
            </h2>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200">
              {assignedIncidents.length} Active
            </span>
          </div>
          <Link
            href="/incidents"
            className="text-xs font-semibold text-neutral-600 hover:text-neutral-900 flex items-center gap-1"
          >
            <span>View All Tickets</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {assignedIncidents.length === 0 ? (
          <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center space-y-2">
            <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto" />
            <h3 className="text-sm font-semibold text-neutral-900">All Field Tasks Clear</h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              No pending incident repairs assigned to your shift. Report any anomalies using the
              voice engine above.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {assignedIncidents.map((incident) => (
              <div
                key={incident.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-neutral-200 bg-white p-3.5 sm:p-4 hover:border-neutral-300 transition-colors gap-3"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-neutral-900">
                      {incident.ticketNumber}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border",
                        priorityStyles[incident.priority] || priorityStyles.MEDIUM
                      )}
                    >
                      {incident.priority}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded border",
                        statusStyles[incident.status] || "bg-neutral-100 text-neutral-700 border-neutral-200"
                      )}
                    >
                      {incident.status}
                    </span>
                    {incident.asset && (
                      <span className="font-mono text-xs bg-neutral-100 text-neutral-800 px-1.5 py-0.2 rounded border border-neutral-200">
                        {incident.asset.assetTag}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-neutral-900">{incident.title}</h3>
                  <div className="flex items-center gap-3 text-[11px] text-neutral-500 font-mono">
                    <span>Category: {incident.faultCategory.replace(/_/g, " ")}</span>
                    {incident.asset?.block && <span>Block: {incident.asset.block}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/incidents?selected=${incident.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-neutral-200 hover:bg-neutral-50 text-neutral-700 text-xs font-medium"
                  >
                    <FileText className="h-3.5 w-3.5 text-neutral-400" />
                    <span>Details</span>
                  </Link>
                  <Link
                    href={`/incidents?action=update&id=${incident.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold"
                  >
                    <span>Update Status</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4. Safety & Shift Protocols Checklist (Industrial Utility) */}
      <section className="rounded-lg border border-neutral-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wide">
              Site Work Safety Verification
            </h3>
          </div>
          <span className="text-[10px] font-mono text-neutral-500">Standard Operating Procedure</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
          <button
            type="button"
            onClick={() => setChecklist({ ...checklist, loto: !checklist.loto })}
            className={cn(
              "flex items-center justify-between p-2 rounded border text-xs text-left transition-colors",
              checklist.loto
                ? "bg-emerald-50/60 border-emerald-200 text-emerald-900 font-medium"
                : "bg-neutral-50 border-neutral-200 text-neutral-600"
            )}
          >
            <span>Lock-Out Tag-Out (LOTO)</span>
            {checklist.loto && <Check className="h-3.5 w-3.5 text-emerald-700" />}
          </button>

          <button
            type="button"
            onClick={() => setChecklist({ ...checklist, ppe: !checklist.ppe })}
            className={cn(
              "flex items-center justify-between p-2 rounded border text-xs text-left transition-colors",
              checklist.ppe
                ? "bg-emerald-50/60 border-emerald-200 text-emerald-900 font-medium"
                : "bg-neutral-50 border-neutral-200 text-neutral-600"
            )}
          >
            <span>Arc-Flash Gear &amp; PPE</span>
            {checklist.ppe && <Check className="h-3.5 w-3.5 text-emerald-700" />}
          </button>

          <button
            type="button"
            onClick={() => setChecklist({ ...checklist, permit: !checklist.permit })}
            className={cn(
              "flex items-center justify-between p-2 rounded border text-xs text-left transition-colors",
              checklist.permit
                ? "bg-emerald-50/60 border-emerald-200 text-emerald-900 font-medium"
                : "bg-neutral-50 border-neutral-200 text-neutral-600"
            )}
          >
            <span>Permit-To-Work Active</span>
            {checklist.permit && <Check className="h-3.5 w-3.5 text-emerald-700" />}
          </button>

          <button
            type="button"
            onClick={() => setChecklist({ ...checklist, hydration: !checklist.hydration })}
            className={cn(
              "flex items-center justify-between p-2 rounded border text-xs text-left transition-colors",
              checklist.hydration
                ? "bg-emerald-50/60 border-emerald-200 text-emerald-900 font-medium"
                : "bg-neutral-50 border-neutral-200 text-neutral-600"
            )}
          >
            <span>High Heat Hydration Log</span>
            {checklist.hydration && <Check className="h-3.5 w-3.5 text-emerald-700" />}
          </button>
        </div>
      </section>
    </div>
  );
}
