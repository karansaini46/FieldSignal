import { apiSuccess } from "@/lib/api-response";
import { handleApiError } from "@/lib/errors";

/**
 * Health check endpoint.
 * GET /api/v1/health
 */
export async function GET() {
  try {
    return apiSuccess({
      status: "healthy",
      service: "FieldSignal Monolith API",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      modules: {
        database: "configured",
        speechASR: "ready",
        aiExtraction: "ready",
        rbac: "enforced",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
