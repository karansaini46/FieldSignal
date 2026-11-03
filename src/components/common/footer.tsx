import React from "react";
import { Cpu, Terminal, Shield } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t bg-muted/30 py-6 text-xs text-muted-foreground">
      <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-8">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-primary" />
          <span>
            FieldSignal Platform Foundation — Built with Next.js, Prisma, PostgreSQL & Zod
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Terminal className="h-3.5 w-3.5" />
            <span>Strict TypeScript</span>
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Shield className="h-3.5 w-3.5" />
            <span>Human-in-the-Loop Safe</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
