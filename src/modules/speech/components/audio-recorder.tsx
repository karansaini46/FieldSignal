"use client";

import React, { useState } from "react";
import {
  Mic,
  Square,
  X,
  RotateCcw,
  Play,
  Pause,
  AlertCircle,
  CheckCircle2,
  Volume2,
  FileAudio,
  Loader2,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAudioRecorder, RecordedAudioData } from "../hooks/use-audio-recorder";
import { AudioVisualizer } from "./audio-visualizer";

export interface AudioRecorderProps {
  /** Callback triggered ONLY when technician explicitly confirms/submits recording */
  onSubmit?: (data: RecordedAudioData) => void | Promise<void>;
  /** Optional callback when technician cancels */
  onCancel?: () => void;
  /** Label for submit button */
  submitLabel?: string;
  /** Maximum recording duration in seconds */
  maxDurationSeconds?: number;
  /** Optional loading state during submission */
  isSubmitting?: boolean;
  /** Additional styling */
  className?: string;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AudioRecorder({
  onSubmit,
  onCancel,
  submitLabel = "Use Voice Note",
  maxDurationSeconds = 30,
  isSubmitting = false,
  className,
}: AudioRecorderProps) {
  const {
    status,
    isRecording,
    duration,
    maxDuration,
    audioLevel,
    recordedData,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
    resetRecording,
    isPlaying,
    playbackCurrentTime,
    playbackDuration,
    togglePlayback,
    seekPlayback,
  } = useAudioRecorder({
    maxDurationSeconds,
    minDurationSeconds: 1,
  });

  const [localSubmitting, setLocalSubmitting] = useState(false);

  async function handleConfirmSubmit() {
    if (!recordedData || busy) return;
    setLocalSubmitting(true);
    try {
      await onSubmit?.(recordedData);
    } finally {
      setLocalSubmitting(false);
    }
  }

  function handleCancelAction() {
    cancelRecording();
    onCancel?.();
  }

  const busy = isSubmitting || localSubmitting;

  return (
    <div
      className={cn(
        "rounded-lg border border-neutral-200 bg-white p-4 sm:p-5 shadow-xs transition-all",
        isRecording && "border-rose-300 ring-2 ring-rose-100",
        className
      )}
    >
      {/* 1. Permission Denied State */}
      {status === "permission_denied" && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-4 space-y-3">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-rose-900">
                Microphone Permission Blocked
              </h4>
              <p className="text-xs text-rose-700 leading-relaxed">
                Browser microphone access was denied. To record voice notes on this device,
                tap the <strong>padlock</strong> or <strong>settings icon</strong> in your browser address bar
                and set Microphone to <strong>Allow</strong>.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={startRecording}
              className="px-3 py-1.5 rounded bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold cursor-pointer"
            >
              Retry Permission
            </button>
            <button
              type="button"
              onClick={handleCancelAction}
              className="px-3 py-1.5 rounded border border-rose-300 bg-white hover:bg-rose-50 text-rose-800 text-xs font-medium cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* 2. Unsupported Browser State */}
      {status === "unsupported" && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <h4 className="font-bold text-amber-900">Audio Recording Unsupported</h4>
            <p className="text-amber-800 leading-relaxed">
              Your current browser does not support HTML5 MediaRecorder. Please open FieldSignal
              in Chrome, Safari, or Firefox to capture voice notes.
            </p>
          </div>
        </div>
      )}

      {/* 3. General Error State */}
      {status === "error" && error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 mb-3 flex items-start justify-between gap-2 text-xs">
          <div className="flex items-start gap-2 text-rose-800">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={resetRecording}
            className="text-xs font-semibold text-rose-700 hover:text-rose-900 underline shrink-0 cursor-pointer"
          >
            Reset
          </button>
        </div>
      )}

      {/* 4. Active Recording State */}
      {isRecording && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-600" />
              </span>
              <span className="text-xs font-bold font-mono uppercase tracking-wider text-rose-700">
                Recording Active
              </span>
            </div>

            {/* Live Duration Counter with Max Limit */}
            <div
              role="timer"
              aria-live="polite"
              className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-900"
            >
              {formatDuration(duration)} / {formatDuration(maxDuration)}
            </div>
          </div>

          {/* Real-time Audio Level Visualizer */}
          <AudioVisualizer isRecording={true} audioLevel={audioLevel} barCount={24} />

          {/* Progress bar towards max duration limit */}
          <div className="w-full bg-neutral-100 h-1 rounded-full overflow-hidden">
            <div
              className="bg-rose-500 h-full transition-all duration-200"
              style={{ width: `${Math.min(100, (duration / maxDuration) * 100)}%` }}
            />
          </div>

          {/* Action buttons (Big tactile targets for gloves) */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={cancelRecording}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md border border-neutral-300 bg-white hover:bg-neutral-50 active:bg-neutral-100 text-neutral-700 text-xs font-semibold transition-colors min-h-[44px] cursor-pointer"
              aria-label="Cancel recording without saving"
            >
              <X className="h-4 w-4 text-neutral-500" />
              <span>Cancel</span>
            </button>

            <button
              type="button"
              onClick={stopRecording}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-md bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-xs font-bold shadow-sm transition-all min-h-[44px] cursor-pointer"
              aria-label="Stop recording and review"
            >
              <Square className="h-4 w-4 fill-current" />
              <span>Finish &amp; Review</span>
            </button>
          </div>
        </div>
      )}

      {/* 5. Review & Playback State (Pre-Submission) */}
      {status === "recorded" && recordedData && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-bold text-neutral-900">
                Voice Note Ready for Review
              </span>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200">
              {formatDuration(recordedData.durationSeconds)} · {formatFileSize(recordedData.fileSizeBytes)}
            </span>
          </div>

          {/* Audio Player Strip */}
          <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 space-y-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={togglePlayback}
                aria-label={isPlaying ? "Pause playback" : "Play recording"}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-900 hover:bg-neutral-800 text-white shadow-xs transition-colors cursor-pointer"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
              </button>

              <div className="flex-1 space-y-1">
                {/* Custom Audio Scrubber Slider */}
                <input
                  type="range"
                  min="0"
                  max={playbackDuration || recordedData.durationSeconds || 1}
                  step="0.1"
                  value={playbackCurrentTime}
                  onChange={(e) => seekPlayback(parseFloat(e.target.value))}
                  aria-label="Seek audio playback"
                  className="w-full h-1.5 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-neutral-900"
                />

                <div className="flex justify-between text-[10px] font-mono text-neutral-500">
                  <span>{formatDuration(playbackCurrentTime)}</span>
                  <span>{formatDuration(playbackDuration || recordedData.durationSeconds)}</span>
                </div>
              </div>
            </div>

            {/* Audio Metadata & Validation Status */}
            <div className="pt-2 border-t border-neutral-200 flex items-center justify-between text-[11px] text-neutral-500 font-mono">
              <span className="flex items-center gap-1">
                <FileAudio className="h-3 w-3 text-neutral-400" />
                {recordedData.mimeType.split(";")[0]}
              </span>
              <span className="text-emerald-700 font-medium">
                ✓ Validated for Gnani ASR
              </span>
            </div>
          </div>

          {/* Action Buttons: Discard, Re-record, or Submit */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={resetRecording}
                disabled={busy}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 min-h-[40px]"
              >
                <RotateCcw className="h-3.5 w-3.5 text-neutral-500" />
                <span>Re-record</span>
              </button>

              <button
                type="button"
                onClick={handleCancelAction}
                disabled={busy}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 min-h-[40px]"
              >
                <X className="h-3.5 w-3.5 text-neutral-500" />
                <span>Discard</span>
              </button>
            </div>

            {/* Explicit submission button: No audio is sent until this is clicked */}
            <button
              type="button"
              onClick={handleConfirmSubmit}
              disabled={busy}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-950 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50 min-h-[42px]"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing Voice Note...</span>
                </>
              ) : (
                <>
                  <span>{submitLabel}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 6. Idle State: Ready to Record */}
      {status === "idle" && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs font-semibold text-neutral-800">
              <Volume2 className="h-3.5 w-3.5 text-amber-600" />
              <span>Voice Incident Dispatch</span>
            </div>
            <p className="text-xs text-neutral-500 leading-relaxed max-w-sm">
              Press record and speak equipment tag and fault symptoms (Hindi, Hinglish, or English).
              Max 30s.
            </p>
          </div>

          <button
            type="button"
            onClick={startRecording}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-lg bg-amber-600 hover:bg-amber-500 active:scale-98 text-white text-xs font-bold shadow-sm shadow-amber-600/20 transition-all min-h-[48px] cursor-pointer"
            aria-label="Start recording audio voice note"
          >
            <Mic className="h-5 w-5" />
            <span>Record Voice Note</span>
          </button>
        </div>
      )}

      {/* 7. Requesting Permission State */}
      {status === "requesting_permission" && (
        <div className="flex items-center justify-center py-6 gap-3 text-xs text-neutral-600">
          <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
          <span>Waiting for microphone permission from browser...</span>
        </div>
      )}
    </div>
  );
}

