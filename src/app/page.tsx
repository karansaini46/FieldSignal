import React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Mic,
  Cpu,
  Layers,
  Database,
  ShieldCheck,
  CheckCircle2,
  Server,
  Zap,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export default function Home() {
  const architecturalModules = [
    {
      title: "Voice-First Speech Engine",
      badge: "Gnani AI",
      badgeVariant: "secondary" as const,
      icon: Mic,
      description:
        "High-performance speech-to-text contract configured for Hindi, Hinglish, and Indian English with solar vocabulary boosting (SMB, SCB, IGBT, Inverter).",
      status: "Contract Configured",
    },
    {
      title: "AI Structured Extraction",
      badge: "Zod & LLM",
      badgeVariant: "outline" as const,
      icon: Cpu,
      description:
        "Extracts colloquial transcripts into strict incident schemas: Asset ID, Fault Category, Severity, Error Codes, and Symptoms.",
      status: "Schema Ready",
    },
    {
      title: "Asset Hierarchy & Validation",
      badge: "PostgreSQL",
      badgeVariant: "secondary" as const,
      icon: Database,
      description:
        "Relational model mapping Plant → Block → Inverter Station → SMB. Validates asset existence and detects missing report fields.",
      status: "Prisma Models Ready",
    },
    {
      title: "Lifecycle State Machine & RBAC",
      badge: "Deterministic",
      badgeVariant: "outline" as const,
      icon: Layers,
      description:
        "7-state incident workflow (Draft → Open → Assigned → In Progress → Resolved → Closed) with strict role-based permission enforcement.",
      status: "Transitions Enforced",
    },
  ];

  return (
    <div className="container mx-auto max-w-6xl px-4 py-12 sm:px-8">
      {/* Hero / System Foundation Banner */}
      <div className="flex flex-col gap-6 text-center sm:text-left">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
          <Badge
            variant="outline"
            className="gap-1.5 py-1 px-3 text-xs border-amber-500/40 text-amber-600 bg-amber-500/5"
          >
            <Zap className="h-3.5 w-3.5" />
            Solar O&M Platform Architecture
          </Badge>
          <Badge variant="secondary" className="gap-1.5 py-1 px-3 text-xs">
            <Sparkles className="h-3.5 w-3.5 text-blue-500" />
            Modular Monolith Foundation
          </Badge>
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-foreground">
            FieldSignal System Foundation
          </h1>
          <p className="max-w-3xl text-base text-muted-foreground sm:text-lg">
            Voice-first maintenance fault reporting and intelligence platform for solar plant O&M
            teams. Designed for single-developer velocity with modular domain boundaries.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-2">
          <Link
            href="/api/v1/health"
            target="_blank"
            className={buttonVariants({ variant: "default", className: "gap-2" })}
          >
            <Server className="h-4 w-4" />
            <span>Verify Health API</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="file:///home/karan/Desktop/FieldSignal/docs/PRD.md"
            className={buttonVariants({ variant: "outline" })}
          >
            View PRD
          </a>
          <a
            href="file:///home/karan/Desktop/FieldSignal/docs/ARCHITECTURE.md"
            className={buttonVariants({ variant: "outline" })}
          >
            View Architecture Spec
          </a>
        </div>
      </div>

      {/* System Status Alert */}
      <div className="mt-10">
        <Alert className="border-emerald-500/30 bg-emerald-500/5">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <AlertTitle className="text-emerald-700 font-semibold">
            Foundation Ready — Zero Compilation Errors
          </AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground mt-1">
            TypeScript is strictly configured, Prisma Client is generated, Zod environment
            validation is enforced, and unified API error handling is wired up.
          </AlertDescription>
        </Alert>
      </div>

      {/* Architecture Modules Grid */}
      <div className="mt-12 space-y-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Modular Monolith Domains
          </h2>
          <p className="text-sm text-muted-foreground">
            Cleanly decoupled domains ready for subsequent Phase feature implementation.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {architecturalModules.map((module) => {
            const Icon = module.icon;
            return (
              <Card key={module.title} className="transition-all hover:border-foreground/20">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <Badge variant={module.badgeVariant}>{module.badge}</Badge>
                  </div>
                  <CardTitle className="mt-4 text-base">{module.title}</CardTitle>
                  <CardDescription className="text-xs leading-relaxed">
                    {module.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-xs font-medium text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>{module.status}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Technical Guardrails Summary */}
      <div className="mt-12 rounded-xl border bg-muted/20 p-6">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span>Technical Guardrails & Ponytail Principles</span>
        </h3>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-muted-foreground">
          <div>
            <span className="font-medium text-foreground block mb-1">Single Process Monolith</span>
            Shared TypeScript types between Next.js client, server actions, and route handlers.
          </div>
          <div>
            <span className="font-medium text-foreground block mb-1">Deterministic Errors</span>
            Custom <code className="text-[11px] bg-muted px-1 rounded">AppError</code> hierarchy
            with Zod and Prisma exception mapping.
          </div>
          <div>
            <span className="font-medium text-foreground block mb-1">Human-in-the-Loop Safe</span>
            AI extractions are strictly staged as drafts before database ticket persistence.
          </div>
        </div>
      </div>
    </div>
  );
}
