"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  validateAudioPayload,
  SUPPORTED_AUDIO_MIME_TYPES,
  MAX_AUDIO_BYTES,
  MIN_AUDIO_BYTES,
} from "../audio-validator";

export type RecorderStatus =
  | "unsupported"
  | "permission_denied"
  | "idle"
  | "requesting_permission"
  | "recording"
  | "recorded"
  | "error";

export interface RecordedAudioData {
  blob: Blob;
  url: string;
  durationSeconds: number;
  mimeType: string;
  fileSizeBytes: number;
  fileName: string;
}

export interface UseAudioRecorderOptions {
  /** Maximum recording duration in seconds (default: 30 to align with Gnani REST API limit) */
  maxDurationSeconds?: number;
  /** Minimum recording duration in seconds to prevent accidental click noise (default: 1) */
  minDurationSeconds?: number;
  /** Preferred audio mime type */
  preferredMimeType?: string;
  /** Optional callback when audio is recorded and validated */
  onRecorded?: (data: RecordedAudioData) => void;
  /** Optional callback on error */
  onError?: (errorMessage: string) => void;
}

export interface UseAudioRecorderReturn {
  status: RecorderStatus;
  isRecording: boolean;
  duration: number;
  maxDuration: number;
  audioLevel: number;
  recordedData: RecordedAudioData | null;
  error: string | null;
  // Actions
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  cancelRecording: () => void;
  resetRecording: () => void;
  // Playback
  isPlaying: boolean;
  playbackCurrentTime: number;
  playbackDuration: number;
  togglePlayback: () => void;
  seekPlayback: (timeSeconds: number) => void;
}

/**
 * Intelligent MIME type selector with mobile/iOS Safari fallback priority
 */
export function getBestSupportedMimeType(preferred?: string): string {
  if (typeof window === "undefined" || !(window as any).MediaRecorder) {
    return "audio/webm";
  }

  const mr = (window as any).MediaRecorder;
  if (preferred && mr.isTypeSupported(preferred)) {
    return preferred;
  }

  const candidateTypes = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/aac",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/wav",
  ];

  for (const type of candidateTypes) {
    if (mr.isTypeSupported(type)) {
      return type;
    }
  }

  return "";
}

/**
 * Browser-based audio recording hook tailored for field operations.
 * Handles MediaRecorder lifecycle, audio level monitoring, mobile browser codecs,
 * duration counting, format/size validation, and local playback preview.
 */
export function useAudioRecorder(
  options: UseAudioRecorderOptions = {}
): UseAudioRecorderReturn {
  const {
    maxDurationSeconds = 30,
    minDurationSeconds = 1,
    preferredMimeType,
    onRecorded,
    onError,
  } = options;

  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [duration, setDuration] = useState<number>(0);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [recordedData, setRecordedData] = useState<RecordedAudioData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackCurrentTime, setPlaybackCurrentTime] = useState<number>(0);
  const [playbackDuration, setPlaybackDuration] = useState<number>(0);

  // Internal refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const actualMimeTypeRef = useRef<string>("audio/webm");

  // Check browser support on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hasMediaDevices = !!(
        navigator.mediaDevices && navigator.mediaDevices.getUserMedia
      );
      const hasMediaRecorder = !!window.MediaRecorder;

      if (!hasMediaDevices || !hasMediaRecorder) {
        setStatus("unsupported");
        setError(
          "Audio recording is not supported in this browser. Please use modern Chrome, Safari, Firefox, or Edge."
        );
      }
    }
  }, []);

  // Cleanup helper to stop tracks and close audio context
  const cleanupMedia = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore if already stopped
      }
      mediaRecorderRef.current = null;
    }

    setAudioLevel(0);
  }, []);

  // Audio level monitoring using Web Audio API AnalyserNode
  const monitorAudioLevel = useCallback((stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] ?? 0;
        }
        const average = sum / dataArray.length;
        const normalized = Math.min(1, Math.max(0, average / 128));
        setAudioLevel(normalized);

        animFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (e) {
      // AudioContext failed to initialize (e.g. strict autoplay policy), fallback gracefully
      console.warn("Audio level visualizer initialization skipped:", e);
    }
  }, []);

  // Stop recording action
  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  // Start recording action
  const startRecording = useCallback(async () => {
    setError(null);

    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      const msg = "Audio recording is not supported in this browser environment.";
      setError(msg);
      setStatus("unsupported");
      onError?.(msg);
      return;
    }

    // Reset previous recording
    if (recordedData?.url) {
      URL.revokeObjectURL(recordedData.url);
      setRecordedData(null);
    }
    setDuration(0);
    audioChunksRef.current = [];

    setStatus("requesting_permission");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1, // Mono preferred for speech recognition
        },
      });
      mediaStreamRef.current = stream;
    } catch (err: any) {
      cleanupMedia();
      let msg = "Failed to access microphone.";

      if (
        err.name === "NotAllowedError" ||
        err.name === "PermissionDeniedError" ||
        err.message?.includes("Permission denied")
      ) {
        msg =
          "Microphone permission was denied. Please allow microphone access in your browser site settings and try again.";
        setStatus("permission_denied");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        msg = "No microphone hardware detected on your device. Please plug in a microphone.";
        setStatus("error");
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        msg = "Microphone is currently in use by another application.";
        setStatus("error");
      } else if (err.name === "SecurityError") {
        msg = "Audio recording requires a secure HTTPS connection or localhost.";
        setStatus("error");
      } else {
        msg = `Microphone access error: ${err.message || "Unknown error"}`;
        setStatus("error");
      }

      setError(msg);
      onError?.(msg);
      return;
    }

    // Determine codec
    const mimeType = getBestSupportedMimeType(preferredMimeType);
    actualMimeTypeRef.current = mimeType || "audio/webm";

    let recorder: MediaRecorder;
    try {
      const recorderOptions: MediaRecorderOptions = mimeType ? { mimeType } : {};
      recorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorderRef.current = recorder;
    } catch (recorderInitErr: any) {
      cleanupMedia();
      const msg = `Failed to initialize MediaRecorder: ${recorderInitErr.message}`;
      setError(msg);
      setStatus("error");
      onError?.(msg);
      return;
    }

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    recorder.onerror = (event: any) => {
      cleanupMedia();
      const msg = `Recording error: ${event.error?.message || "Unknown recording error"}`;
      setError(msg);
      setStatus("error");
      onError?.(msg);
    };

    recorder.onstop = () => {
      const finalDuration = Math.round((Date.now() - startTimeRef.current) / 1000);
      cleanupMedia();

      // Validate duration
      if (finalDuration < minDurationSeconds) {
        const msg = `Voice note was too short (${finalDuration}s). Please speak for at least ${minDurationSeconds} second.`;
        setError(msg);
        setStatus("error");
        onError?.(msg);
        return;
      }

      const mime = actualMimeTypeRef.current || "audio/webm";
      const blob = new Blob(audioChunksRef.current, { type: mime });

      // Validate size and format
      try {
        validateAudioPayload(blob.size, mime);
      } catch (validationErr: any) {
        const msg = validationErr.message || "Recorded audio failed validation.";
        setError(msg);
        setStatus("error");
        onError?.(msg);
        return;
      }

      const url = URL.createObjectURL(blob);
      const ext = mime.includes("mp4") ? "mp4" : mime.includes("ogg") ? "ogg" : "webm";
      const data: RecordedAudioData = {
        blob,
        url,
        durationSeconds: finalDuration,
        mimeType: mime,
        fileSizeBytes: blob.size,
        fileName: `field_note_${Date.now()}.${ext}`,
      };

      setRecordedData(data);
      setStatus("recorded");
      setDuration(finalDuration);
      setPlaybackDuration(finalDuration);
      setPlaybackCurrentTime(0);

      onRecorded?.(data);
    };

    // Start recording & timers
    startTimeRef.current = Date.now();
    recorder.start(250); // Emit data every 250ms chunks
    setStatus("recording");
    monitorAudioLevel(stream);

    timerIntervalRef.current = setInterval(() => {
      const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
      setDuration(elapsed);

      // Auto-stop if max duration reached
      if (elapsed >= maxDurationSeconds) {
        stopRecording();
      }
    }, 200);
  }, [
    cleanupMedia,
    maxDurationSeconds,
    minDurationSeconds,
    monitorAudioLevel,
    onError,
    onRecorded,
    preferredMimeType,
    recordedData?.url,
    stopRecording,
  ]);

  // Cancel and discard recording
  const cancelRecording = useCallback(() => {
    cleanupMedia();
    if (recordedData?.url) {
      URL.revokeObjectURL(recordedData.url);
    }
    audioChunksRef.current = [];
    setRecordedData(null);
    setDuration(0);
    setError(null);
    setStatus("idle");
    setIsPlaying(false);
  }, [cleanupMedia, recordedData]);

  // Reset to re-record
  const resetRecording = useCallback(() => {
    cancelRecording();
  }, [cancelRecording]);

  // Audio playback controls
  const togglePlayback = useCallback(() => {
    if (!recordedData?.url) return;

    if (!audioElementRef.current) {
      const audio = new Audio(recordedData.url);
      audioElementRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
        setPlaybackCurrentTime(0);
      };

      audio.ontimeupdate = () => {
        setPlaybackCurrentTime(audio.currentTime);
      };

      audio.onloadedmetadata = () => {
        if (!isNaN(audio.duration) && audio.duration > 0) {
          setPlaybackDuration(audio.duration);
        }
      };
    }

    const audio = audioElementRef.current;
    if (audio.src !== recordedData.url) {
      audio.src = recordedData.url;
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch((playErr) => {
          console.error("Playback failed:", playErr);
          setIsPlaying(false);
        });
    }
  }, [isPlaying, recordedData]);

  const seekPlayback = useCallback((timeSeconds: number) => {
    if (audioElementRef.current) {
      audioElementRef.current.currentTime = timeSeconds;
      setPlaybackCurrentTime(timeSeconds);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupMedia();
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current = null;
      }
      if (recordedData?.url) {
        URL.revokeObjectURL(recordedData.url);
      }
    };
  }, [cleanupMedia, recordedData?.url]);

  return {
    status,
    isRecording: status === "recording",
    duration,
    maxDuration: maxDurationSeconds,
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
  };
}
