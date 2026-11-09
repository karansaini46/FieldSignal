"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface AudioVisualizerProps {
  isRecording: boolean;
  audioLevel: number; // 0.0 to 1.0
  barCount?: number;
  className?: string;
}

export function AudioVisualizer({
  isRecording,
  audioLevel,
  barCount = 16,
  className,
}: AudioVisualizerProps) {
  // Generate pseudo-frequency bars centered around current audioLevel
  const bars = Array.from({ length: barCount }, (_, index) => {
    if (!isRecording) {
      return 15; // resting height percentage
    }

    // Create organic symmetrical waveform shape
    const distanceFromCenter = Math.abs(index - (barCount - 1) / 2) / (barCount / 2);
    const waveFactor = 1 - Math.pow(distanceFromCenter, 1.5) * 0.6;
    
    // Introduce dynamic variation
    const jitter = Math.sin(index * 1.5 + Date.now() / 150) * 0.15;
    const computed = Math.min(100, Math.max(12, (audioLevel * waveFactor + jitter) * 100));

    return Math.round(computed);
  });

  return (
    <div
      role="img"
      aria-label={isRecording ? "Live microphone audio input level" : "Audio visualizer idle"}
      className={cn(
        "flex items-center justify-center gap-1 h-12 px-3 py-1 rounded bg-neutral-900/5 select-none",
        className
      )}
    >
      {bars.map((height, idx) => (
        <div
          key={idx}
          className={cn(
            "w-1 sm:w-1.5 rounded-full transition-all duration-75",
            isRecording
              ? height > 65
                ? "bg-rose-600"
                : height > 35
                ? "bg-amber-500"
                : "bg-emerald-500"
              : "bg-neutral-300"
          )}
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  );
}

