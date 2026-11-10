"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Mic,
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
  Loader2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AudioRecorder, RecordedAudioData } from "@/modules/speech";

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

interface TranscribedVoiceData {
  recordingId: string;
  transcript: string;
  isEmptyTranscript: boolean;
  detectedLanguage: string;
  confidence: number;
  processingTimeSeconds?: number;
  latencyMs: number;
  model: string;
  isDuplicate?: boolean;
}

export function TechnicianDashboard({
  technicianName,
  siteName,
  siteCode,
  assignedIncidents,
}: TechnicianDashboardProps) {
  const [transcriptionResult, setTranscriptionResult] = useState<TranscribedVoiceData | null>(null);
  const [extractedIncident, setExtractedIncident] = useState<any | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);

  const [checklist, setChecklist] = useState({
    loto: true,
    ppe: true,
    hydration: false,
    permit: true,
  });

  async function handleAudioSubmit(data: RecordedAudioData) {
    if (isTranscribing) return; // Prevent duplicate submissions

    setIsTranscribing(true);
    setTranscriptionError(null);
    setTranscriptionResult(null);
    setExtractedIncident(null);

    try {
      const formData = new FormData();
      formData.append("audio_file", data.blob, data.fileName);

      const response = await fetch("/api/v1/speech/transcribe", {
        method: "POST",
        body: formData,
      });

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to transcribe voice note");
      }

      const transcription = json.data;
      setTranscriptionResult({
        recordingId: transcription.recordingId,
        transcript: transcription.transcript,
        isEmptyTranscript: transcription.isEmptyTranscript || !transcription.transcript?.trim(),
        detectedLanguage: transcription.detectedLanguage,
        confidence: transcription.confidence,
        processingTimeSeconds: transcription.processingTimeSeconds,
        latencyMs: transcription.latencyMs,
        model: transcription.model,
        isDuplicate: transcription.isDuplicate,
      });

      // Run extraction on non-empty transcript
      if (transcription.transcript?.trim()) {
        try {
          const extractRes = await fetch("/api/v1/incidents/extract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transcript: transcription.transcript }),
          });
          const extractJson = await extractRes.json();
          if (extractJson.success && extractJson.data) {
            setExtractedIncident(extractJson.data);
          }
        } catch (exErr) {
          console.warn("Background extraction skipped:", exErr);
        }
      }
    } catch (err: unknown) {
      setTranscriptionError(err instanceof Error ? err.message : "Error processing voice note");
    } finally {
      setIsTranscribing(false);
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

        {/* Real Field Operational Status Strip */}
        <div className="flex items-center gap-2 text-xs font-mono bg-white border border-neutral-200 rounded-md p-2 shadow-2xs">
          <div className="px-2 border-r border-neutral-200">
            <div className="text-[10px] text-neutral-400 uppercase font-sans">Active Work Orders</div>
            <div className="font-bold text-neutral-800 flex items-center gap-1">
              <Layers className="h-3 w-3 text-neutral-500" />
              {assignedIncidents.length} Assigned
            </div>
          </div>
          <div className="px-2 border-r border-neutral-200">
            <div className="text-[10px] text-neutral-400 uppercase font-sans">Site Code</div>
            <div className="font-bold text-neutral-800 flex items-center gap-1 font-mono">
              {siteCode}
            </div>
          </div>
          <div className="px-2">
            <div className="text-[10px] text-neutral-400 uppercase font-sans">Shift Status</div>
            <div className="text-emerald-700 font-semibold flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              On Duty
            </div>
          </div>
        </div>
      </div>

      {/* 2. Primary Voice Incident Capture Console (Browser Audio Recorder) */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-amber-50 text-amber-800 border border-amber-200">
              <Radio className="h-3 w-3 text-amber-600" />
              <span>Voice-First Incident Engine</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-neutral-900">
              Report Equipment Fault via Voice Note
            </h2>
            <p className="text-xs text-neutral-600 leading-relaxed">
              Record spoken observations in Hindi, Hinglish, or English. Speak asset tag (e.g.{" "}
              <code className="font-mono bg-neutral-100 px-1 py-0.2 rounded text-neutral-800">
                BHA-INV-01
              </code>
              ) and inverter fault code.
            </p>
          </div>
          <div className="text-[11px] font-mono text-neutral-500 bg-neutral-50 px-2.5 py-1.5 rounded border border-neutral-200 shrink-0">
            Powered by Gnani AI ASR
          </div>
        </div>

        {/* Browser-Based Audio Recorder Component */}
        <AudioRecorder
          onSubmit={handleAudioSubmit}
          submitLabel="Transcribe &amp; Draft Ticket"
          maxDurationSeconds={30}
          isSubmitting={isTranscribing}
        />

        {/* Error Callout if transcription fails */}
        {transcriptionError && (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-3 flex items-start gap-2.5 text-xs text-rose-800">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold">Transcription Error</span>
              <p>{transcriptionError}</p>
            </div>
          </div>
        )}

        {/* Real Gnani AI Speech Transcription Result */}
        {transcriptionResult && (
          <div className="pt-2 border-t border-neutral-100 bg-neutral-50 rounded-md p-4 text-xs space-y-3">
            {transcriptionResult.isDuplicate && (
              <div className="p-2 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-mono flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span>Duplicate audio submission prevented. Retrieved previous transcript.</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 text-neutral-600">
              <span className="font-semibold text-neutral-900 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Verified Audio Transcript (Gnani AI STT)</span>
              </span>
              <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                <span className="bg-white px-2 py-0.5 rounded border border-neutral-200">
                  Model: {transcriptionResult.model}
                </span>
                <span className="bg-white px-2 py-0.5 rounded border border-neutral-200">
                  Lang: {transcriptionResult.detectedLanguage}
                </span>
                <span className="bg-white px-2 py-0.5 rounded border border-neutral-200">
                  Conf: {Math.round(transcriptionResult.confidence * 100)}%
                </span>
                <span className="bg-white px-2 py-0.5 rounded border border-neutral-200">
                  ASR: {typeof transcriptionResult.processingTimeSeconds === "number" ? `${transcriptionResult.processingTimeSeconds.toFixed(2)}s` : "0.0s"}
                </span>
                <span className="bg-white px-2 py-0.5 rounded border border-neutral-200">
                  RT: {transcriptionResult.latencyMs}ms
                </span>
              </div>
            </div>

            {transcriptionResult.isEmptyTranscript ? (
              <div className="p-3 bg-amber-50 rounded border border-amber-200 text-amber-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-xs text-amber-800">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <span>No Human Speech Detected</span>
                </div>
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  The audio recording did not contain audible speech (only silence, ambient wind, or static was detected by the Gnani ASR model).
                  Please re-record your voice note and speak clearly into your microphone.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <blockquote className="font-mono text-neutral-800 text-xs italic bg-white p-3 rounded border border-neutral-200 leading-relaxed shadow-2xs">
                  &ldquo;{transcriptionResult.transcript}&rdquo;
                </blockquote>

                {/* Live Extraction Preview Card */}
                {extractedIncident && (
                  <div className="rounded border border-blue-200 bg-blue-50/60 p-3 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-blue-900 flex items-center gap-1.5 text-xs">
                        <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                        <span>Incident Extraction Engine</span>
                      </span>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-mono font-bold",
                          extractedIncident.needsClarification
                            ? "bg-purple-100 text-purple-800"
                            : "bg-emerald-100 text-emerald-800"
                        )}
                      >
                        Status: {extractedIncident.suggestedStatus}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                      <div className="bg-white p-1.5 rounded border border-blue-200">
                        <div className="text-[9px] text-neutral-500 uppercase">Asset Code</div>
                        <div className="font-bold text-neutral-900">
                          {extractedIncident.assetCode ||
                            (extractedIncident.isAmbiguous
                              ? "Ambiguous (Manual Select)"
                              : "Unspecified")}
                        </div>
                      </div>
                      <div className="bg-white p-1.5 rounded border border-blue-200">
                        <div className="text-[9px] text-neutral-500 uppercase">Alarm Code</div>
                        <div className="font-bold text-neutral-900 font-mono">
                          {extractedIncident.reportedAlarm || "None"}
                        </div>
                      </div>
                      <div className="bg-white p-1.5 rounded border border-blue-200">
                        <div className="text-[9px] text-neutral-500 uppercase">Category</div>
                        <div className="font-bold text-neutral-900">
                          {extractedIncident.faultCategory}
                        </div>
                      </div>
                      <div className="bg-white p-1.5 rounded border border-blue-200">
                        <div className="text-[9px] text-neutral-500 uppercase">Suggested Priority</div>
                        <div className="font-bold text-neutral-900">
                          {extractedIncident.suggestedPriority}
                        </div>
                      </div>
                    </div>

                    {extractedIncident.needsClarification && extractedIncident.clarificationQuestion && (
                      <div className="p-2 rounded bg-purple-50 border border-purple-200 text-purple-900 text-[11px]">
                        <strong>Clarification Question:</strong> {extractedIncident.clarificationQuestion}
                      </div>
                    )}

                    {extractedIncident.isAmbiguous &&
                      extractedIncident.candidateAssets &&
                      extractedIncident.candidateAssets.length > 0 && (
                        <div className="p-2 rounded bg-amber-50 border border-amber-200 text-amber-900 text-[11px] space-y-1">
                          <span className="font-semibold text-amber-800">
                            Candidate Assets Identified:
                          </span>{" "}
                          <span className="font-mono text-[10px]">
                            {extractedIncident.candidateAssets.map((c: any) => c.assetTag).join(", ")}
                          </span>
                        </div>
                      )}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setTranscriptionResult(null)}
                className="px-3 py-1.5 rounded border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-600 text-xs font-medium cursor-pointer"
              >
                Clear
              </button>
              {!transcriptionResult.isEmptyTranscript && (
                <Link
                  href={`/incidents/new?transcript=${encodeURIComponent(
                    transcriptionResult.transcript
                  )}&recordingId=${transcriptionResult.recordingId}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition-colors shadow-2xs"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  <span>Log Incident with this Voice Note</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
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
