import React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Activity, ShieldCheck, Sun, Radio } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-8">
        {/* Brand & Solar Context */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 transition hover:opacity-90">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20">
              <Sun className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-bold tracking-tight text-foreground">
                <span>FieldSignal</span>
                <Badge
                  variant="outline"
                  className="text-[10px] font-semibold text-amber-600 border-amber-500/30"
                >
                  O&M Solar
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">Voice-First Fault Intelligence</p>
            </div>
          </Link>
        </div>

        {/* Status Indicators & Metadata */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
            <Radio className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
            <span>Pilot Site:</span>
            <span className="font-medium text-foreground">Bhadla Solar Park IV (50 MW)</span>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="flex items-center gap-1 text-xs">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />
              <span>RBAC Active</span>
            </Badge>
            <Badge
              variant="outline"
              className="flex items-center gap-1 text-xs border-emerald-500/30 text-emerald-600"
            >
              <Activity className="h-3.5 w-3.5" />
              <span>Modular Monolith</span>
            </Badge>
          </div>
        </div>
      </div>
    </header>
  );
}
