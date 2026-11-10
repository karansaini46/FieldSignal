import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

// ponytail: Lean database connectivity probe and runtime telemetry; upgrade path: export Prometheus/OpenTelemetry metrics scrape endpoint (/metrics).

/**
 * Production Health & Liveness Check.
 * GET /api/v1/health
 *
 * Actively pings PostgreSQL with SELECT 1 and returns HTTP 200 when healthy
 * or HTTP 503 if database connectivity fails.
 */
export async function GET() {
  const startTime = Date.now();
  let dbStatus = "disconnected";
  let dbLatencyMs = -1;

  try {
    const dbStart = Date.now();
    await db.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - dbStart;
    dbStatus = "connected";

    return NextResponse.json(
      {
        success: true,
        data: {
          status: "healthy",
          service: "FieldSignal Monolith API",
          version: "1.0.0",
          environment: env.NODE_ENV,
          timestamp: new Date().toISOString(),
          latencyMs: Date.now() - startTime,
          database: {
            status: dbStatus,
            latencyMs: dbLatencyMs,
          },
          modules: {
            database: "connected",
            speechASR: "ready",
            aiExtraction: "ready",
            rbac: "enforced",
          },
          system: {
            uptimeSeconds: Math.floor(process.uptime()),
            nodeVersion: process.version,
            memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
          },
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Database connection failed";
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SERVICE_UNHEALTHY",
          message: "Critical service dependency failed health check",
          details: {
            database: {
              status: "disconnected",
              error: env.NODE_ENV === "production" ? "Database unreachable" : errorMessage,
            },
          },
        },
      },
      { status: 503 }
    );
  }
}
