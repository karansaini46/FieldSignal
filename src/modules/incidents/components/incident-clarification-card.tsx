"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  HelpCircle,
  CheckCircle2,
  Mic,
  Send,
  Loader2,
  Clock,
  Sparkles,
  AlertCircle,
  MessageSquare,
  Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AudioRecorder, RecordedAudioData } from "@/modules/speech";

export interface ClarificationRecord {
  id: string;
  question: string;
  missingField?: string | null;
  response?: string | null;
  status: "PENDING" | "RESOLVED" | "DISMISSED";
  createdAt: string | Date;
  respondedAt?: string | Date | null;
  requestedBy?: { name: string; role: string } | null;
  respondedBy?: { name: string; role: string } | null;
}

interface IncidentClarificationCardProps {
  incidentId: string;
  clarifications: ClarificationRecord[];
  isEditable?: boolean;
}

export function IncidentClarificationCard({
  incidentId,
  clarifications,
  isEditable = true,
}: IncidentClarificationCardProps) {
  const router = useRouter();

  // Find the single active pending clarification question (one focused question at a time)
  const pendingClarifications = clarifications.filter((c) => c.status === "PENDING");
  const currentClarification = pendingClarifications[0] || null;

  const [responseText, setResponseText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Voice recording mode state
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  async function handleTextSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentClarification || !responseText.trim()) return;

    await submitResponse(responseText.trim(), false);
  }

  async function handleVoiceAudioSubmit(audioData: RecordedAudioData) {
    setIsTranscribing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("audio_file", audioData.blob, audioData.fileName);

      const res = await fetch("/api/v1/speech/transcribe", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to transcribe voice response");
      }

      if (json.data.isEmptyTranscript || !json.data.transcript?.trim()) {
        throw new Error("No audible speech detected. Please speak clearly into your microphone.");
      }

      const voiceTranscript = json.data.transcript.trim();
      setResponseText(voiceTranscript);
      setShowVoiceRecorder(false);

      // Submit the transcribed answer
      await submitResponse(voiceTranscript, true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Voice response transcription failed");
    } finally {
      setIsTranscribing(false);
    }
  }

  async function submitResponse(text: string, fromVoice: boolean) {
    if (!currentClarification) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/incidents/${incidentId}/clarifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clarificationId: currentClarification.id,
          response: text,
          fromVoice,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to submit clarification");
      }

      setResponseText("");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit clarification response");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border border-purple-200 bg-white p-5 space-y-4 shadow-2xs">
      <div className="flex items-center justify-between pb-3 border-b border-purple-100">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-purple-600" />
          <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-purple-950">
            Field Clarification Workflow
          </h2>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[10px]">
          {pendingClarifications.length > 0 ? (
            <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-bold border border-purple-200">
              {pendingClarifications.length} Action Needed
            </span>
          ) : (
            <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded font-bold border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              All Questions Answered
            </span>
          )}
        </div>
      </div>

      {/* Error Callout */}
      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 flex items-start gap-2.5 text-xs text-rose-800">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Active Focused Question (One question at a time) */}
      {currentClarification && isEditable ? (
        <div className="rounded-lg border border-purple-200 bg-purple-50/70 p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-700 bg-white px-2 py-0.5 rounded border border-purple-200 inline-block">
                Focused Clarification Question
              </span>
              <p className="text-xs sm:text-sm font-semibold text-purple-950 leading-relaxed">
                {currentClarification.question}
              </p>
            </div>
          </div>

          {/* Toggle between Text and Voice Input */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-purple-800">
                {showVoiceRecorder ? "Voice Recording Mode (Gnani ASR)" : "Enter or speak response:"}
              </span>
              <button
                type="button"
                onClick={() => setShowVoiceRecorder(!showVoiceRecorder)}
                className="inline-flex items-center gap-1 text-[11px] font-mono text-purple-700 hover:text-purple-900 bg-white px-2 py-1 rounded border border-purple-200 shadow-2xs hover:bg-purple-50 transition-colors cursor-pointer"
              >
                {showVoiceRecorder ? (
                  <>
                    <MessageSquare className="h-3 w-3 text-purple-600" />
                    <span>Switch to Text Input</span>
                  </>
                ) : (
                  <>
                    <Radio className="h-3 w-3 text-purple-600 animate-pulse" />
                    <span>Answer via Voice Note</span>
                  </>
                )}
              </button>
            </div>

            {showVoiceRecorder ? (
              <div className="bg-white p-3 rounded-md border border-purple-200 space-y-2">
                <AudioRecorder
                  onSubmit={handleVoiceAudioSubmit}
                  submitLabel="Transcribe &amp; Submit Answer"
                  maxDurationSeconds={30}
                  isSubmitting={isTranscribing || submitting}
                />
              </div>
            ) : (
              <form onSubmit={handleTextSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder="Type clear answer (e.g. INV-01, E-402, still tripped)..."
                  disabled={submitting}
                  className="flex-1 px-3 py-2 text-xs rounded border border-purple-200 bg-white focus:outline-hidden focus:ring-1 focus:ring-purple-600 font-mono text-neutral-900 placeholder:text-neutral-400"
                />
                <button
                  type="submit"
                  disabled={submitting || !responseText.trim()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-purple-700 text-white text-xs font-semibold hover:bg-purple-800 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
                >
                  {submitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  <span>Submit</span>
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}

      {/* Clarification History Timeline */}
      {clarifications.length > 0 ? (
        <div className="space-y-2 pt-2 border-t border-neutral-100">
          <div className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider">
            Clarification History ({clarifications.length})
          </div>

          <div className="divide-y divide-neutral-100 space-y-2">
            {clarifications.map((item) => (
              <div key={item.id} className="pt-2 text-xs space-y-1">
                <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400">
                  <span>Question:</span>
                  <span>{new Date(item.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-neutral-800 font-medium">{item.question}</p>

                {item.status === "RESOLVED" && item.response ? (
                  <div className="bg-emerald-50/70 p-2 rounded border border-emerald-200 text-emerald-950 font-mono text-[11px] space-y-1 mt-1">
                    <div className="flex items-center justify-between text-[9px] text-emerald-700 font-semibold uppercase tracking-wider">
                      <span>Technician Response</span>
                      {item.respondedBy && <span>By {item.respondedBy.name}</span>}
                    </div>
                    <p className="font-sans font-medium text-xs text-neutral-900">
                      &ldquo;{item.response}&rdquo;
                    </p>
                  </div>
                ) : (
                  <div className="text-[11px] font-mono text-purple-700 italic">
                    Awaiting response...
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="py-4 text-center text-xs text-neutral-400 font-mono">
          No clarifications requested for this incident.
        </div>
      )}
    </div>
  );
}
