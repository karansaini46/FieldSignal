"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Cpu, ClipboardList, Radio, ArrowRight, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickJumpModalProps {
  isOpen: boolean;
  onClose: () => void;
  siteId?: string | null;
}

// Realistic solar equipment quick jump registry items
const QUICK_ITEMS = [
  {
    category: "Equipment Tags",
    items: [
      { id: "inv-01", label: "BHA-INV-01", detail: "Central Inverter Station #1 • Block 04", href: "/assets?tag=BHA-INV-01", type: "Inverter", status: "FAULTED" },
      { id: "inv-02", label: "BHA-INV-02", detail: "Central Inverter Station #2 • Block 04", href: "/assets?tag=BHA-INV-02", type: "Inverter", status: "OPERATIONAL" },
      { id: "tr-01", label: "BHA-TR-01", detail: "Main Step-Up Transformer 33kV/132kV", href: "/assets?tag=BHA-TR-01", type: "Transformer", status: "DEGRADED" },
      { id: "scb-01", label: "BHA-SCB-04-01", detail: "String Combiner Box #1 • Block 04", href: "/assets?tag=BHA-SCB-04-01", type: "SCB", status: "OPERATIONAL" },
      { id: "trk-01", label: "BHA-TRK-01", detail: "Single-Axis Solar Tracker Controller #1", href: "/assets?tag=BHA-TRK-01", type: "Tracker", status: "OPERATIONAL" },
    ],
  },
  {
    category: "Operational Consoles",
    items: [
      { id: "c-voice", label: "Voice Field Reporting", detail: "PTT Incident capture in Hindi / Hinglish", href: "/field", type: "Action", status: "LIVE" },
      { id: "c-triage", label: "Incident Triage Board", detail: "Review unassigned alarms and fault matrix", href: "/dashboard", type: "Console", status: "READY" },
      { id: "c-incidents", label: "Incident Ticket Index", detail: "Full chronological list of site incident logs", href: "/incidents", type: "Index", status: "READY" },
      { id: "c-assets", label: "Site Asset Hierarchy", detail: "Inverter, transformer & string topology", href: "/assets", type: "Index", status: "READY" },
    ],
  },
];

export function QuickJumpModal({ isOpen, onClose }: QuickJumpModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredCategories = QUICK_ITEMS.map((cat) => ({
    ...cat,
    items: cat.items.filter(
      (item) =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        item.detail.toLowerCase().includes(query.toLowerCase()) ||
        item.type.toLowerCase().includes(query.toLowerCase())
    ),
  })).filter((cat) => cat.items.length > 0);

  function handleSelect(href: string) {
    onClose();
    router.push(href);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/40 backdrop-blur-2xs">
      <div className="w-full max-w-xl rounded-lg border border-neutral-200 bg-white shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100">
        {/* Search Input Bar */}
        <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-neutral-200 bg-neutral-50/50">
          <Search className="h-4 w-4 text-neutral-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search equipment tags (e.g. BHA-INV-01), faults, or views..."
            className="flex-1 bg-transparent text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-neutral-400 hover:text-neutral-600 p-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-medium text-neutral-400 bg-neutral-100 border border-neutral-200 rounded">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-3">
          {filteredCategories.length === 0 ? (
            <div className="py-8 text-center text-xs text-neutral-500">
              No equipment tags or consoles match &ldquo;{query}&rdquo;
            </div>
          ) : (
            filteredCategories.map((group) => (
              <div key={group.category} className="space-y-1">
                <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  {group.category}
                </span>
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelect(item.href)}
                      className="flex w-full items-center justify-between px-2 py-2 rounded-md hover:bg-neutral-100 text-left transition-colors group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-6 w-6 items-center justify-center rounded bg-neutral-100 border border-neutral-200 text-neutral-600 font-mono text-xs">
                          {item.type === "Inverter" ? (
                            <Cpu className="h-3.5 w-3.5" />
                          ) : item.type === "Action" ? (
                            <Radio className="h-3.5 w-3.5 text-amber-600" />
                          ) : (
                            <ClipboardList className="h-3.5 w-3.5" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-neutral-900 group-hover:text-amber-700">
                              {item.label}
                            </span>
                            <span
                              className={cn(
                                "text-[9px] font-mono px-1 py-0.2 rounded border",
                                item.status === "FAULTED"
                                  ? "bg-rose-50 text-rose-700 border-rose-200"
                                  : item.status === "DEGRADED"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-neutral-50 text-neutral-600 border-neutral-200"
                              )}
                            >
                              {item.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-neutral-500">{item.detail}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] font-medium text-neutral-400 group-hover:text-neutral-700">
                        <span className="hidden sm:inline">Jump</span>
                        <CornerDownLeft className="h-3 w-3" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between px-3 py-2 bg-neutral-50 border-t border-neutral-200 text-[10px] text-neutral-500 font-mono">
          <span>Field Operations Registry Jump</span>
          <span>Tip: Press / anywhere to open</span>
        </div>
      </div>
    </div>
  );
}
