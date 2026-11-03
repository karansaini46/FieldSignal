import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth, assertSiteAccess } from "@/lib/auth-guard";
import { handleApiError, NotFoundError } from "@/lib/errors";
import { apiSuccess, apiPaginated } from "@/lib/api-response";
import { IncidentPriority, FaultCategory, IncidentStatus, Prisma } from "@prisma/client";

const createIncidentSchema = z.object({
  siteId: z.string().uuid("Invalid site ID"),
  assetId: z.string().uuid("Invalid asset ID").optional().nullable(),
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(5, "Description must be at least 5 characters"),
  symptoms: z.string().optional().nullable(),
  errorCode: z.string().optional().nullable(),
  priority: z.nativeEnum(IncidentPriority).default(IncidentPriority.MEDIUM),
  faultCategory: z.nativeEnum(FaultCategory).default(FaultCategory.OTHER),
  originalTranscript: z.string().optional().nullable(),
  detectedLanguage: z.string().optional().nullable(),
  audioRecordingId: z.string().uuid().optional().nullable(),
});

/**
 * GET /api/v1/incidents
 * Lists incidents scoped strictly to user's Organization and Site.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);

    const { searchParams } = new URL(req.url);
    const targetSiteId = searchParams.get("siteId");
    const status = searchParams.get("status") as IncidentStatus | null;
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip = (page - 1) * limit;

    // Validate site access if requested specifically
    if (targetSiteId) {
      assertSiteAccess(targetSiteId, session);
    }

    // Build multi-tenant scoped WHERE clause
    const where: Prisma.IncidentWhereInput = {
      site: {
        organizationId: session.organizationId,
      },
    };

    // Apply site scoping based on role and query
    if (targetSiteId) {
      where.siteId = targetSiteId;
    } else if (session.role === "TECHNICIAN" && session.siteId) {
      where.siteId = session.siteId;
    } else if (session.role === "SUPERVISOR" && session.siteId) {
      where.siteId = session.siteId;
    }

    if (status && Object.values(IncidentStatus).includes(status)) {
      where.status = status;
    }

    const [incidents, totalCount] = await Promise.all([
      db.incident.findMany({
        where,
        include: {
          site: { select: { id: true, name: true, code: true } },
          asset: { select: { id: true, assetTag: true, name: true, block: true } },
          reportedBy: { select: { id: true, name: true, role: true } },
          assignedTo: { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.incident.count({ where }),
    ]);

    return apiPaginated(incidents, page, limit, totalCount);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/v1/incidents
 * Creates a new maintenance incident ticket.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const body = await req.json();
    const data = createIncidentSchema.parse(body);

    // Enforce site-level access for the reporter
    assertSiteAccess(data.siteId, session);

    // Verify site belongs to reporter's organization
    const site = await db.site.findFirst({
      where: {
        id: data.siteId,
        organizationId: session.organizationId,
      },
    });

    if (!site) {
      throw new NotFoundError("Site not found or does not belong to your organization.");
    }

    // If assetId is supplied, verify it belongs to this site
    if (data.assetId) {
      const asset = await db.asset.findFirst({
        where: {
          id: data.assetId,
          siteId: data.siteId,
        },
      });

      if (!asset) {
        throw new NotFoundError("Asset not found at this site.");
      }
    }

    // Generate unique sequential ticket number
    const count = await db.incident.count({
      where: { site: { organizationId: session.organizationId } },
    });
    const ticketNumber = `INC-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

    const incident = await db.incident.create({
      data: {
        ticketNumber,
        siteId: data.siteId,
        assetId: data.assetId,
        reportedByUserId: session.userId,
        title: data.title,
        description: data.description,
        symptoms: data.symptoms,
        errorCode: data.errorCode,
        priority: data.priority,
        faultCategory: data.faultCategory,
        status: IncidentStatus.OPEN,
        originalTranscript: data.originalTranscript,
        detectedLanguage: data.detectedLanguage,
        audioRecordingId: data.audioRecordingId,
        confirmedAt: new Date(),
        events: {
          create: {
            userId: session.userId,
            eventType: "CONFIRMATION",
            fromStatus: IncidentStatus.DRAFT,
            toStatus: IncidentStatus.OPEN,
            title: "Incident Reported",
            description: `Incident logged by ${session.name} (${session.role}).`,
          },
        },
      },
      include: {
        site: { select: { id: true, name: true, code: true } },
        asset: { select: { id: true, assetTag: true, name: true } },
        reportedBy: { select: { id: true, name: true, role: true } },
      },
    });

    return apiSuccess(incident, undefined, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
