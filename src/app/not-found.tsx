import React from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Sun } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4 py-12">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20 shadow-xs">
          <Sun className="h-7 w-7" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-200/60 text-[11px] font-mono font-bold text-neutral-700">
            <AlertCircle className="h-3.5 w-3.5 text-neutral-500" />
            <span>404 — PAGE NOT FOUND</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Resource or Equipment Route Not Found
          </h1>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
            The requested plant telemetry page, incident report, or asset record does not exist or has been relocated within the solar park registry.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href="/field"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <span>Voice Field Console</span>
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-800 text-xs font-semibold shadow-2xs transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

