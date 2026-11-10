"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Loader2,
  Settings2,
  AlertCircle,
  Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface TtsPlayerProps {
  /** The text prompt to speak */
  text: string;
  /** Optional button label (e.g. "Listen to Question", "Read Confirmation") */
  label?: string;
  /** Whether to render in compact/icon-only mode */
  compact?: boolean;
  /** Target Gnani Timbre voice (e.g. "Shivani", "Avinash") */
  initialVoice?: string;
  /** Target language code (e.g. "hi-IN", "en-IN", "hi-en") */
  initialLanguage?: string;
  /** Playback speed (0.8, 1.0, 1.2) */
  initialSpeed?: number;
  /** Whether to display voice setting controls (speed/voice) */
  allowSettings?: boolean;
  /** Custom wrapper styling */
  className?: string;
  /** Optional callback when audio starts playing */
  onPlay?: () => void;
  /** Optional callback when audio finishes */
  onEnded?: () => void;
}

export function TtsPlayer({
  text,
  label = "Listen to Audio",
  compact = false,
  initialVoice = "Shivani",
  initialLanguage = "hi-IN",
  initialSpeed = 1.0,
  allowSettings = false,
  className,
  onPlay,
  onEnded,
}: TtsPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Configurable voice parameters
  const [voice, setVoice] = useState(initialVoice);
  const [speed, setSpeed] = useState(initialSpeed);
  const [language, setLanguage] = useState(initialLanguage);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Cache blob URLs per text+voice+speed so repeated plays are instantaneous
  // ponytail: In-memory Map cache for audio blob URLs; upgrade path: IndexedDB audio blob cache for offline PWA storage.
  const blobCacheRef = useRef<Map<string, string>>(new Map());

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      blobCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
      blobCacheRef.current.clear();
    };
  }, []);

  async function handleTogglePlay() {
    setErrorNotice(null);

    // If currently playing, pause it
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    // If audio is already loaded and paused, resume playback
    if (audioRef.current && audioUrl) {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
        onPlay?.();
        return;
      } catch (err) {
        // Fallback to synthesizing again if audio playback fails
      }
    }

    // Fetch synthesis from server-side Gnani Timbre endpoint
    setIsLoading(true);
    const cacheKey = `${text}-${voice}-${speed}-${language}`;

    try {
      let url = blobCacheRef.current.get(cacheKey);

      if (!url) {
        const res = await fetch("/api/v1/speech/synthesize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            voice,
            language,
            speed,
            model: "timbre-v3.0",
            format: "wav",
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.error?.message || `TTS synthesis failed (HTTP ${res.status})`);
        }

        const blob = await res.blob();
        url = URL.createObjectURL(blob);
        blobCacheRef.current.set(cacheKey, url);
      }

      setAudioUrl(url);

      if (!audioRef.current) {
        audioRef.current = new Audio(url);
      } else {
        audioRef.current.src = url;
      }

      audioRef.current.playbackRate = speed;

      audioRef.current.onended = () => {
        setIsPlaying(false);
        onEnded?.();
      };

      audioRef.current.onerror = () => {
        setIsPlaying(false);
        setErrorNotice("Audio playback failed. Please read the visible text.");
      };

      await audioRef.current.play();
      setIsPlaying(true);
      onPlay?.();
    } catch (err: unknown) {
      console.warn("[TtsPlayer] Gnani Timbre synthesis error:", err);
      // Requirement 6: Fallback to visible text if TTS fails
      setErrorNotice(
        err instanceof Error
          ? `${err.message}. Visible text is displayed below.`
          : "Spoken audio unavailable. Visible text is displayed below."
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleReplay() {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      handleTogglePlay();
    }
  }

  return (
    <div className={cn("inline-flex flex-col gap-1", className)}>
      <div className="inline-flex items-center gap-1.5 flex-wrap">
        {/* Main Play / Pause / Load Button */}
        <button
          type="button"
          disabled={isLoading}
          onClick={handleTogglePlay}
          title={isPlaying ? "Pause spoken response" : label}
          className={cn(
            "inline-flex items-center gap-1.5 rounded transition-all cursor-pointer font-medium",
            compact
              ? "p-1.5 text-xs rounded-full border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700"
              : "px-2.5 py-1 text-xs border rounded-md shadow-2xs",
            isPlaying
              ? "border-blue-500 bg-blue-50 text-blue-700 font-semibold"
              : "border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700"
          )}
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
          ) : isPlaying ? (
            <Pause className="h-3.5 w-3.5 text-blue-600 animate-pulse" />
          ) : (
            <Volume2 className="h-3.5 w-3.5 text-blue-600" />
          )}

          {!compact && (
            <span className="text-[11px]">
              {isLoading ? "Synthesizing..." : isPlaying ? "Pause Audio" : label}
            </span>
          )}
        </button>

        {/* Replay Button (visible once audio is ready) */}
        {audioUrl && !isLoading && (
          <button
            type="button"
            onClick={handleReplay}
            title="Replay from start"
            className="p-1 rounded text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Voice Settings Toggle (Req 2: Configurable voice settings) */}
        {allowSettings && (
          <button
            type="button"
            onClick={() => setShowSettingsModal((prev) => !prev)}
            title="Voice & Speed Settings"
            className={cn(
              "p-1 rounded transition-colors cursor-pointer",
              showSettingsModal
                ? "bg-blue-100 text-blue-700"
                : "text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
            )}
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Popover Voice Settings Panel */}
      {showSettingsModal && (
        <div className="p-2.5 mt-1 rounded-md border border-neutral-200 bg-white shadow-md text-xs space-y-2 z-20 max-w-xs animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-1">
            <span className="font-bold text-neutral-800 text-[11px] font-mono">
              Gnani Timbre Settings
            </span>
            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">
              timbre-v3.0
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <label className="text-neutral-500 block mb-0.5">Voice:</label>
              <select
                value={voice}
                onChange={(e) => {
                  setVoice(e.target.value);
                  setAudioUrl(null); // invalidate cached audio
                }}
                className="w-full p-1 rounded border border-neutral-200 bg-neutral-50 text-neutral-800 text-[11px]"
              >
                <option value="Shivani">Shivani (Female)</option>
                <option value="Lakshmi">Lakshmi (Female)</option>
                <option value="Avinash">Avinash (Male)</option>
                <option value="Shubham">Shubham (Male)</option>
              </select>
            </div>

            <div>
              <label className="text-neutral-500 block mb-0.5">Speed:</label>
              <select
                value={speed}
                onChange={(e) => {
                  const s = parseFloat(e.target.value);
                  setSpeed(s);
                  if (audioRef.current) audioRef.current.playbackRate = s;
                }}
                className="w-full p-1 rounded border border-neutral-200 bg-neutral-50 text-neutral-800 text-[11px]"
              >
                <option value="0.85">0.85x (Slower)</option>
                <option value="1.0">1.0x (Normal)</option>
                <option value="1.15">1.15x (Faster)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Fallback Error Banner (Req 6: Fallback to visible text if TTS fails) */}
      {errorNotice && (
        <div className="flex items-center gap-1.5 text-[10px] text-amber-800 bg-amber-50 p-1.5 rounded border border-amber-200 animate-in fade-in">
          <AlertCircle className="h-3 w-3 text-amber-600 shrink-0" />
          <span>{errorNotice}</span>
        </div>
      )}
    </div>
  );
}

