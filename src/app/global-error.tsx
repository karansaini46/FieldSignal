"use client";

import React from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full flex items-center justify-center bg-neutral-100 font-sans p-4 antialiased text-neutral-900">
        <div className="max-w-md w-full bg-white border border-neutral-300 rounded-xl p-8 text-center space-y-4 shadow-sm">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-700 font-bold text-xl">
            !
          </div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">
            Critical Application Error
          </h1>
          <p className="text-xs text-neutral-600 leading-relaxed">
            FieldSignal failed to initialize the application root layout.
          </p>
          {error?.digest && (
            <p className="text-[10px] font-mono text-neutral-400">
              Error Digest: {error.digest}
            </p>
          )}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => reset()}
              className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-md shadow-xs"
            >
              Reload Application
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
