"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IncidentPriority, FaultCategory, AssetType, UserRole } from "@prisma/client";
import {
  INCIDENT_PRIORITY_META,
  FAULT_CATEGORY_LABELS,
} from "@/modules/incidents/types";
import { suggestIncidentPriority } from "@/modules/incidents/priority-suggester";
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Layers,
  MapPin,
  Save,
  Loader2,
  Sparkles,
  ShieldAlert,
  HelpCircle,
  Mic,
  Radio,
  Send,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AudioRecorder, RecordedAudioData } from "@/modules/speech";
import { HistoricalIntelligenceCard } from "./historical-intelligence-card";
import { HistoricalIntelligenceReport } from "../historical-intelligence";

interface SiteOption {
  id: string;
  name: string;
  code: string;
}

interface AssetOption {
  id: string;
  assetTag: string;
  name: string;
  assetType: AssetType;
  siteId: string;
}

interface UserOption {
  id: string;
  name: string;
  role: UserRole;
  siteId?: string | null;
}

interface IncidentCreateFormProps {
  sites: SiteOption[];
  defaultSiteId?: string;
  isSiteLocked?: boolean;
  assets: AssetOption[];
  users: UserOption[];
  userRole: UserRole;
  cancelHref: string;
  initialTranscript?: string;
  initialAudioRecordingId?: string;
}

export function IncidentCreateForm({
  sites,
  defaultSiteId,
  isSiteLocked = false,
  assets,
  users,
  userRole,
  cancelHref,
  initialTranscript,
  initialAudioRecordingId,
}: IncidentCreateFormProps) {
  const router = useRouter();

  const [siteId, setSiteId] = useState<string>(defaultSiteId || sites[0]?.id || "");
  const [assetId, setAssetId] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>(initialTranscript || "");
  const [symptoms, setSymptoms] = useState<string>("");
  const [errorCode, setErrorCode] = useState<string>("");
  const [faultCategory, setFaultCategory] = useState<FaultCategory>("OTHER");
  const [priority, setPriority] = useState<IncidentPriority>("MEDIUM");
  const [assignedToUserId, setAssignedToUserId] = useState<string>("");
  const [audioRecordingId, setAudioRecordingId] = useState<string | null>(initialAudioRecordingId || null);
  const [originalTranscript, setOriginalTranscript] = useState<string>(initialTranscript || "");

  // Embedded Voice Recorder & Extraction state
  const [showVoiceRecorder, setShowVoiceRecorder] = useState<boolean>(false);
  const [isTranscribingVoice, setIsTranscribingVoice] = useState<boolean>(false);
  const [voiceTranscribeError, setVoiceTranscribeError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<any | null>(null);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);

  // Priority suggestion state
  const [suggestedPriority, setSuggestedPriority] = useState<IncidentPriority>("MEDIUM");
  const [suggestionReasoning, setSuggestionReasoning] = useState<string[]>([]);
  const [suggestionConfidence, setSuggestionConfidence] = useState<number>(0.85);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Clarification interactive state
  const [clarificationAnswer, setClarificationAnswer] = useState("");
  const [isAnsweringClarification, setIsAnsweringClarification] = useState(false);
  const [clarificationHistory, setClarificationHistory] = useState<any[]>([]);
  const [showClarificationVoice, setShowClarificationVoice] = useState(false);

  // Historical intelligence state during incident review
  const [historicalReport, setHistoricalReport] = useState<HistoricalIntelligenceReport | null>(null);

  const filteredAssets = assets.filter((a) => a.siteId === siteId);
  const selectedAsset = assets.find((a) => a.id === assetId);
  const isSupervisorOrAdmin = userRole === "SUPERVISOR" || userRole === "ADMIN";

  async function handleAnswerClarification(answerText: string, fromVoice = false) {
    if (!extractedData || !answerText.trim() || !siteId) return;

    let field = "asset";
    const qLower = (extractedData.clarificationQuestion || "").toLowerCase();
    if (qLower.includes("alarm") || qLower.includes("error code")) field = "alarm_code";
    else if (qLower.includes("current") || qLower.includes("status")) field = "current_status";
    else if (qLower.includes("result") || qLower.includes("outcome")) field = "repair_result";
    else if (qLower.includes("which") || qLower.includes("equipment") || qLower.includes("tag")) field = "asset";
    else if (qLower.includes("symptom")) field = "symptoms";

    setIsAnsweringClarification(true);
    try {
      const res = await fetch("/api/v1/incidents/clarify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId,
          field,
          response: answerText.trim(),
          fromVoice,
          currentExtraction: extractedData,
          history: clarificationHistory,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        const { updatedExtraction, history: newHistory } = json.data;
        setExtractedData(updatedExtraction);
        setClarificationHistory(newHistory);
        setClarificationAnswer("");
        setShowClarificationVoice(false);

        if (updatedExtraction.matchedAssetId && !assetId) {
          setAssetId(updatedExtraction.matchedAssetId);
        }
        if (updatedExtraction.reportedAlarm && !errorCode) {
          setErrorCode(updatedExtraction.reportedAlarm);
        }
        if (updatedExtraction.symptoms && updatedExtraction.symptoms.length > 0) {
          setSymptoms(updatedExtraction.symptoms.join(", "));
        }
        if (updatedExtraction.faultDescription && (!description || description === initialTranscript)) {
          setDescription(updatedExtraction.faultDescription);
        }
      }
    } catch (err) {
      console.warn("Clarification error:", err);
    } finally {
      setIsAnsweringClarification(false);
    }
  }

  // Function to run extraction engine on transcript/description
  async function runExtraction(transcriptText: string) {
    if (!transcriptText.trim()) return;
    setIsExtracting(true);
    try {
      const res = await fetch("/api/v1/incidents/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: transcriptText,
          siteId,
          assetId: assetId || undefined,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        const ex = json.data;
        setExtractedData(ex);

        // Autofill verified fields without overwriting user choices
        if (ex.matchedAssetId && !assetId) {
          setAssetId(ex.matchedAssetId);
        }
        if (ex.reportedAlarm && !errorCode) {
          setErrorCode(ex.reportedAlarm);
        }
        if (ex.symptoms && ex.symptoms.length > 0 && !symptoms) {
          setSymptoms(ex.symptoms.join(", "));
        }
        if (ex.faultCategory && ex.faultCategory !== "OTHER") {
          setFaultCategory(ex.faultCategory);
        }
        if (ex.suggestedPriority) {
          setPriority(ex.suggestedPriority);
        }
        if (ex.faultDescription && (!description || description === transcriptText)) {
          setDescription(ex.faultDescription);
        }
        if (!title && ex.faultDescription) {
          setTitle(`${ex.assetCode || "Equipment"}: ${ex.faultDescription.slice(0, 50)}`);
        }
      }
    } catch (err) {
      console.warn("Incident extraction error:", err);
    } finally {
      setIsExtracting(false);
    }
  }

  // Auto-run extraction on initialTranscript if present
  useEffect(() => {
    if (initialTranscript) {
      runExtraction(initialTranscript);
    }
  }, []);

  // Live Historical Incident Intelligence for review during draft creation
  useEffect(() => {
    if (!siteId || (!assetId && !extractedData?.assetCode)) {
      setHistoricalReport(null);
      return;
    }

    let isMounted = true;
    const fetchHistorical = async () => {
      try {
        const res = await fetch("/api/v1/incidents/historical-intelligence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId,
            assetId: assetId || undefined,
            assetTag: extractedData?.assetCode || undefined,
            symptoms: symptoms || undefined,
            description: description || undefined,
            errorCode: errorCode || undefined,
          }),
        });
        const json = await res.json();
        if (json.success && json.data && isMounted) {
          setHistoricalReport(json.data);
        }
      } catch (err) {
        console.warn("Failed to fetch historical intelligence:", err);
      }
    };

    const timer = setTimeout(fetchHistorical, 400);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [siteId, assetId, extractedData?.assetCode, symptoms, errorCode, description]);

  async function handleVoiceNoteSubmit(data: RecordedAudioData) {
    if (isTranscribingVoice) return; // Prevent duplicate submissions

    setIsTranscribingVoice(true);
    setVoiceTranscribeError(null);
    try {
      const formData = new FormData();
      formData.append("audio_file", data.blob, data.fileName);
      if (siteId) {
        formData.append("siteId", siteId);
      }

      const res = await fetch("/api/v1/speech/transcribe", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to transcribe audio note");
      }

      if (json.data.isEmptyTranscript || !json.data.transcript?.trim()) {
        setVoiceTranscribeError(
          "No speech was detected in this audio recording. Please speak clearly and try again."
        );
        return;
      }

      const transcriptText = json.data.transcript;
      setAudioRecordingId(json.data.recordingId);
      setOriginalTranscript(transcriptText);
      setDescription(transcriptText);
      setShowVoiceRecorder(false);

      // Immediately run extraction engine on the newly transcribed voice note
      await runExtraction(transcriptText);
    } catch (err: unknown) {
      setVoiceTranscribeError(err instanceof Error ? err.message : "Error transcribing audio");
    } finally {
      setIsTranscribingVoice(false);
    }
  }

  // Re-calculate priority suggestion whenever category, asset, title, or symptoms change
  useEffect(() => {
    const result = suggestIncidentPriority({
      faultCategory,
      assetType: selectedAsset?.assetType,
      title,
      symptoms,
      errorCode,
    });

    setSuggestedPriority(result.suggestedPriority);
    setSuggestionReasoning(result.reasoning);
    setSuggestionConfidence(result.confidence);
  }, [faultCategory, selectedAsset, title, symptoms, errorCode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!siteId) {
      setFormError("Please select a solar facility site");
      return;
    }
    if (!title.trim() || title.trim().length < 3) {
      setFormError("Incident title must be at least 3 characters");
      return;
    }
    if (!description.trim() || description.trim().length < 5) {
      setFormError("Incident description must be at least 5 characters");
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        siteId,
        assetId: assetId || null,
        title: title.trim(),
        description: description.trim(),
        symptoms: symptoms.trim() || null,
        errorCode: errorCode.trim() || null,
        faultCategory,
        priority,
        status: extractedData?.needsClarification ? "NEEDS_CLARIFICATION" : "SUBMITTED",
        missingFields: extractedData?.missingInformation || [],
        assignedToUserId: isSupervisorOrAdmin && assignedToUserId ? assignedToUserId : null,
        audioRecordingId: audioRecordingId || null,
        originalTranscript:
          originalTranscript.trim() ||
          initialTranscript ||
          (extractedData?.originalTranscript ?? null),
        userConfirmed: true, // Explicit user confirmation
      };

      const res = await fetch("/api/v1/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to create incident");
      }

      router.push(`/incidents/${data.data.id}`);
      router.refresh();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to create incident");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {formError && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 flex items-start gap-2.5 text-xs text-rose-800">
          <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold">Error creating incident</span>
            <p>{formError}</p>
          </div>
        </div>
      )}

      {/* AI Extraction Clarification Required Banner with Interactive Text & Voice Workflow */}
      {extractedData && extractedData.needsClarification && (
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 space-y-3 text-xs shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-purple-900 flex items-center gap-1.5">
              <HelpCircle className="h-4 w-4 text-purple-600" />
              <span>Clarification Required (Voice Extraction)</span>
            </span>
            <span className="font-mono text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-bold border border-purple-200">
              Status: NEEDS_CLARIFICATION
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-mono text-purple-700 uppercase font-semibold">
              Current Focused Question:
            </span>
            <p className="font-medium text-purple-950 text-xs leading-relaxed italic bg-white p-2.5 rounded border border-purple-200">
              &ldquo;{extractedData.clarificationQuestion}&rdquo;
            </p>
          </div>

          {/* Interactive Answer Box: Text or Voice Note */}
          <div className="space-y-2 pt-1 border-t border-purple-100">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-purple-800 font-semibold">
                {showClarificationVoice ? "Speak response (Gnani ASR):" : "Type response to question:"}
              </span>
              <button
                type="button"
                onClick={() => setShowClarificationVoice(!showClarificationVoice)}
                className="inline-flex items-center gap-1 text-[11px] font-mono text-purple-700 hover:text-purple-900 bg-white px-2 py-0.5 rounded border border-purple-200 shadow-2xs hover:bg-purple-100 transition-colors cursor-pointer"
              >
                {showClarificationVoice ? (
                  <>
                    <MessageSquare className="h-3 w-3 text-purple-600" />
                    <span>Switch to Text</span>
                  </>
                ) : (
                  <>
                    <Radio className="h-3 w-3 text-purple-600 animate-pulse" />
                    <span>Speak Answer</span>
                  </>
                )}
              </button>
            </div>

            {showClarificationVoice ? (
              <div className="bg-white p-2.5 rounded border border-purple-200">
                <AudioRecorder
                  onSubmit={async (data) => {
                    const formData = new FormData();
                    formData.append("audio_file", data.blob, data.fileName);
                    const res = await fetch("/api/v1/speech/transcribe", { method: "POST", body: formData });
                    const json = await res.json();
                    if (json.success && json.data.transcript) {
                      await handleAnswerClarification(json.data.transcript, true);
                    }
                  }}
                  submitLabel="Transcribe &amp; Answer"
                  maxDurationSeconds={30}
                  isSubmitting={isAnsweringClarification}
                />
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={clarificationAnswer}
                  onChange={(e) => setClarificationAnswer(e.target.value)}
                  placeholder="Enter answer (e.g. INV-01, E-402, still tripped)..."
                  disabled={isAnsweringClarification}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAnswerClarification(clarificationAnswer, false);
                    }
                  }}
                  className="flex-1 px-3 py-1.5 text-xs rounded border border-purple-200 bg-white focus:outline-hidden focus:ring-1 focus:ring-purple-600 font-mono text-neutral-900 placeholder:text-neutral-400"
                />
                <button
                  type="button"
                  disabled={isAnsweringClarification || !clarificationAnswer.trim()}
                  onClick={() => handleAnswerClarification(clarificationAnswer, false)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-purple-700 text-white text-xs font-semibold hover:bg-purple-800 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
                >
                  {isAnsweringClarification ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  <span>Answer</span>
                </button>
              </div>
            )}
          </div>

          {/* Clarification History */}
          {clarificationHistory.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-purple-200/60">
              <span className="text-[10px] font-mono text-purple-700 uppercase font-semibold">
                Clarification History ({clarificationHistory.length}):
              </span>
              <div className="space-y-1 font-mono text-[11px]">
                {clarificationHistory.map((item, i) => (
                  <div key={i} className="bg-white/90 p-2 rounded border border-purple-200 flex items-start justify-between gap-2">
                    <div>
                      <span className="text-neutral-500 block text-[10px]">Q: {item.question}</span>
                      <span className="text-emerald-800 font-bold">A: &ldquo;{item.response}&rdquo;</span>
                    </div>
                    {item.fromVoice && (
                      <span className="text-[9px] bg-purple-50 text-purple-700 px-1 py-0.5 rounded border border-purple-200 shrink-0">
                        Voice
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-purple-800 font-mono pt-1">
            <span className="font-bold">Remaining missing details:</span>
            {extractedData.missingInformation.map((m: string, idx: number) => (
              <span key={idx} className="bg-purple-100 px-1.5 py-0.5 rounded border border-purple-200">
                {m}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* AI Extraction Verified Summary Banner */}
      {extractedData && !extractedData.needsClarification && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-900 shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>
              Voice extraction applied: <strong>{extractedData.assetCode || "Plant Equipment"}</strong> ({extractedData.faultCategory})
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px]">
            <span className="bg-white px-2 py-0.5 rounded border border-emerald-200">
              Confidence: {Math.round(extractedData.extractionConfidence * 100)}%
            </span>
            <span className="bg-white px-2 py-0.5 rounded border border-emerald-200">
              Priority: {extractedData.suggestedPriority}
            </span>
          </div>
        </div>
      )}

      {/* Section 1: Location & Equipment Selection */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5 space-y-4 shadow-2xs">
        <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
          <MapPin className="h-4 w-4 text-blue-600" />
          <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-800">
            Plant Location & Equipment Mapping
          </h2>
        </div>

        {/* Ambiguous Asset Disambiguation Alert */}
        {extractedData?.isAmbiguous && extractedData?.candidateAssets && extractedData.candidateAssets.length > 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-2 text-xs text-amber-900">
            <div className="flex items-center gap-2 font-bold text-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>Ambiguous Asset Reference — Manual Selection Required</span>
            </div>
            <p className="text-[11px] text-amber-700 leading-relaxed">
              Multiple solar equipment units matched your spoken description. To prevent misattribution, please click the matching unit below or select it from the dropdown:
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {extractedData.candidateAssets.map((candidate: any) => (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => setAssetId(candidate.id)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-mono font-medium rounded border transition-colors",
                    assetId === candidate.id
                      ? "bg-amber-600 text-white border-amber-700 shadow-xs"
                      : "bg-white text-neutral-800 border-neutral-300 hover:bg-amber-100"
                  )}
                >
                  {candidate.assetTag} ({candidate.name})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Contradiction Warnings Alert */}
        {extractedData?.contradictions && extractedData.contradictions.length > 0 && (
          <div className="rounded-md border border-rose-300 bg-rose-50 p-3 space-y-2 text-xs text-rose-900">
            <div className="flex items-center gap-2 font-bold text-rose-800">
              <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" />
              <span>Operational Contradiction Detected</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-rose-700">
              {extractedData.contradictions.map((c: any, i: number) => (
                <li key={i}>
                  <span className="font-semibold">{c.message}</span> — {c.resolution}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Site Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700">Solar Plant Facility *</label>
            <select
              value={siteId}
              disabled={isSiteLocked}
              onChange={(e) => {
                setSiteId(e.target.value);
                setAssetId("");
              }}
              className="w-full px-3 py-2 text-xs rounded border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600 disabled:opacity-60"
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          {/* Asset Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700 flex items-center justify-between">
              <span>Affected Solar Asset</span>
              <span className="text-[10px] font-mono text-neutral-400">Optional / Site-Wide</span>
            </label>
            <select
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600 font-mono"
            >
              <option value="">None (Site-Wide / Unassigned)</option>
              {filteredAssets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.assetTag} — {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Section 2: Fault Categorization & Priority Recommendation */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5 space-y-4 shadow-2xs">
        <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
          <ShieldAlert className="h-4 w-4 text-blue-600" />
          <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-800">
            Fault Classification & Priority Recommendation
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Fault Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700">Fault Category *</label>
            <select
              value={faultCategory}
              onChange={(e) => setFaultCategory(e.target.value as FaultCategory)}
              className="w-full px-3 py-2 text-xs rounded border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600"
            >
              {Object.entries(FAULT_CATEGORY_LABELS).map(([cat, label]) => (
                <option key={cat} value={cat}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Ticket Priority Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700">Incident Priority *</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as IncidentPriority)}
              className="w-full px-3 py-2 text-xs rounded border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600 font-semibold"
            >
              <option value="CRITICAL">CRITICAL (Fire / Substation Trip / Safety Hazard)</option>
              <option value="HIGH">HIGH (Major Inverter Fault / Earth Fault)</option>
              <option value="MEDIUM">MEDIUM (Tracker Failure / SMB Defect)</option>
              <option value="LOW">LOW (Blown Fuse / Sensor Drift)</option>
            </select>
          </div>

          {/* Priority Suggestion Callout Banner */}
          <div className="sm:col-span-2 p-3 rounded-lg border border-blue-200 bg-blue-50/60 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                <span>Priority Suggestion Engine</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-100 text-blue-700">
                  {Math.round(suggestionConfidence * 100)}% Confidence
                </span>
              </div>
              {priority !== suggestedPriority && (
                <button
                  type="button"
                  onClick={() => setPriority(suggestedPriority)}
                  className="text-[11px] font-mono text-blue-700 hover:text-blue-900 underline font-semibold cursor-pointer"
                >
                  Accept Suggested: {suggestedPriority}
                </button>
              )}
            </div>

            <div className="text-xs text-blue-950 font-mono space-y-1">
              <div>
                <span className="text-blue-600">Recommendation: </span>
                <span className="font-bold">{suggestedPriority}</span>
              </div>
              <ul className="list-disc list-inside text-[11px] text-blue-800 space-y-0.5">
                {suggestionReasoning.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Incident Details & Observations */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5 space-y-4 shadow-2xs">
        <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
          <Layers className="h-4 w-4 text-blue-600" />
          <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-800">
            Observation & Symptom Documentation
          </h2>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700">Incident Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Inverter 1 IGBT Over-Temperature Alarm & Blower Failure"
              required
              className="w-full px-3 py-2 text-xs rounded border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-neutral-700">Detailed Description *</label>
              <button
                type="button"
                onClick={() => setShowVoiceRecorder(!showVoiceRecorder)}
                className="inline-flex items-center gap-1.5 text-[11px] font-mono text-amber-700 hover:text-amber-800 font-semibold cursor-pointer"
              >
                <Mic className="h-3.5 w-3.5 text-amber-600" />
                <span>{showVoiceRecorder ? "Close Voice Input" : "Record Voice Note"}</span>
              </button>
            </div>

            {/* Embedded Audio Recorder */}
            {showVoiceRecorder && (
              <div className="my-2 p-3 bg-neutral-50 rounded-lg border border-neutral-200 space-y-2">
                <div className="text-[11px] font-semibold text-neutral-700 flex items-center justify-between">
                  <span>Speak incident symptoms into microphone</span>
                  <span className="font-mono text-[10px] text-neutral-400">Gnani AI Engine</span>
                </div>
                <AudioRecorder
                  onSubmit={handleVoiceNoteSubmit}
                  submitLabel="Transcribe & Append to Description"
                  isSubmitting={isTranscribingVoice}
                />
                {voiceTranscribeError && (
                  <p className="text-xs text-rose-600 font-medium">{voiceTranscribeError}</p>
                )}
              </div>
            )}

            {/* Audio Recording Attachment Badge */}
            {audioRecordingId && (
              <div className="flex items-center gap-2 p-2 rounded bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>Audio recording attached (ID: {audioRecordingId.slice(0, 8)}...)</span>
              </div>
            )}

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe physical observations, smoke, sounds, thermal imaging readings, or inverter status codes..."
              rows={3}
              required
              className="w-full px-3 py-2 text-xs rounded border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600 leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700">
                Symptoms / Observations (Optional)
              </label>
              <input
                type="text"
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder="e.g. Grinding noise, high fan current, thermal cutout"
                className="w-full px-3 py-2 text-xs rounded border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700">
                OEM Error Code (Optional)
              </label>
              <input
                type="text"
                value={errorCode}
                onChange={(e) => setErrorCode(e.target.value)}
                placeholder="e.g. E-14, F-042, ERR-309"
                className="w-full px-3 py-2 text-xs font-mono uppercase rounded border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600"
              />
            </div>
          </div>

          {/* Supervisor Assignment at Creation */}
          {isSupervisorOrAdmin && (
            <div className="space-y-1.5 pt-2 border-t border-neutral-100">
              <label className="text-xs font-semibold text-neutral-700">
                Assign Immediately to Technician (Optional)
              </label>
              <select
                value={assignedToUserId}
                onChange={(e) => setAssignedToUserId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600"
              >
                <option value="">Leave Unassigned (Dispatch Queue)</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Historical Incident Intelligence Context during Review */}
      {historicalReport && historicalReport.totalPreviousIncidents > 0 && (
        <HistoricalIntelligenceCard report={historicalReport} isCompact={true} />
      )}

      {/* Form Controls */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Link
          href={cancelHref}
          className="px-4 py-2 rounded border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 text-xs font-semibold transition-colors"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 px-5 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
        >
          {submitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Submitting Incident...</span>
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5" />
              <span>Confirm & Submit Incident</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}

