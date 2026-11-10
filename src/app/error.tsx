"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log exception to client console
    console.error("[FieldSignal Segment Error]", error);
  }, [error]);

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full text-center space-y-6 rounded-xl border border-neutral-200 bg-white p-8 shadow-xs">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600 ring-1 ring-rose-200">
          <AlertTriangle className="h-6 w-6" />
        </div>

        <div className="space-y-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded">
            Operational Service Interruption
          </span>
          <h2 className="text-lg font-bold text-neutral-900">
            An Unexpected System Error Occurred
          </h2>
          <p className="text-xs text-neutral-500 leading-relaxed">
            FieldSignal encountered an unhandled exception while loading this operational view. Plant telemetry safety monitors remain unaffected.
          </p>
          {error.digest && (
            <p className="text-[10px] font-mono text-neutral-400 pt-1">
              Incident Digest: {error.digest}
            </p>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Try Again</span>
          </button>
          <Link
            href="/field"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 text-xs font-semibold shadow-2xs transition-colors"
          >
            <Home className="h-3.5 w-3.5" />
            <span>Field Console</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
