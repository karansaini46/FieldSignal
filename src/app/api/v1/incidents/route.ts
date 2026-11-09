import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth, assertSiteAccess, assertTechnicianMutationAllowed } from "@/lib/auth-guard";
import { handleApiError, NotFoundError, ForbiddenError, ValidationError } from "@/lib/errors";
import { apiSuccess, apiPaginated } from "@/lib/api-response";
import { IncidentPriority, FaultCategory, IncidentStatus, Prisma } from "@prisma/client";
import { assertAiExtractionApproval } from "@/modules/incidents/ai-guard";
import { getIncidentValidationService } from "@/modules/incidents";

const createIncidentSchema = z.object({
  siteId: z.string().uuid("Invalid site ID"),
  assetId: z.string().uuid("Invalid asset ID").optional().nullable(),
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title cannot exceed 200 characters"),
  description: z
    .string()
    .min(5, "Description must be at least 5 characters")
    .max(5000, "Description cannot exceed 5000 characters"),
  symptoms: z.string().max(2000, "Symptoms cannot exceed 2000 characters").optional().nullable(),
  errorCode: z.string().max(50, "Error code cannot exceed 50 characters").optional().nullable(),
  priority: z.nativeEnum(IncidentPriority).default(IncidentPriority.MEDIUM),
  faultCategory: z.nativeEnum(FaultCategory).default(FaultCategory.OTHER),
  status: z.nativeEnum(IncidentStatus).optional(),
  assignedToUserId: z.string().uuid().optional().nullable(),
  isAiExtracted: z.boolean().optional().default(false),
  userConfirmed: z.boolean().optional().default(false),
  originalTranscript: z.string().max(10000).optional().nullable(),
  detectedLanguage: z.string().max(20).optional().nullable(),
  audioRecordingId: z.string().uuid().optional().nullable(),
  missingFields: z.array(z.string()).optional().default([]),
});

/**
 * GET /api/v1/incidents
 * Lists and searches incidents scoped strictly to user's Organization and Site.
 * Supports filters by siteId, status, priority, faultCategory, assetId, and search keyword.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);

    const { searchParams } = new URL(req.url);
    const targetSiteId = searchParams.get("siteId");
    const status = searchParams.get("status") as IncidentStatus | null;
    const priority = searchParams.get("priority") as IncidentPriority | null;
    const faultCategory = searchParams.get("faultCategory") as FaultCategory | null;
    const assetId = searchParams.get("assetId");
    const search = searchParams.get("q") || searchParams.get("search");
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip = (page - 1) * limit;

    // Validate site access if requested specifically
    if (targetSiteId && targetSiteId !== "all") {
      assertSiteAccess(targetSiteId, session);
    }

    // Build multi-tenant scoped WHERE clause
    const where: Prisma.IncidentWhereInput = {
      site: {
        organizationId: session.organizationId,
      },
    };

    // Apply site scoping based on role and query
    if (targetSiteId && targetSiteId !== "all") {
      where.siteId = targetSiteId;
    } else if (session.role === "TECHNICIAN" && session.siteId) {
      where.siteId = session.siteId;
    } else if (session.role === "SUPERVISOR" && session.siteId) {
      where.siteId = session.siteId;
    }

    if (status && Object.values(IncidentStatus).includes(status)) {
      where.status = status;
    }

    if (priority && Object.values(IncidentPriority).includes(priority)) {
      where.priority = priority;
    }

    if (faultCategory && Object.values(FaultCategory).includes(faultCategory)) {
      where.faultCategory = faultCategory;
    }

    if (assetId) {
      where.assetId = assetId;
    }

    if (search && search.trim().length > 0) {
      const q = search.trim();
      where.OR = [
        { ticketNumber: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { symptoms: { contains: q, mode: "insensitive" } },
        { errorCode: { contains: q, mode: "insensitive" } },
        { asset: { assetTag: { contains: q, mode: "insensitive" } } },
        { asset: { name: { contains: q, mode: "insensitive" } } },
        { reportedBy: { name: { contains: q, mode: "insensitive" } } },
        { assignedTo: { name: { contains: q, mode: "insensitive" } } },
      ];
    }

    const [incidents, totalCount] = await Promise.all([
      db.incident.findMany({
        where,
        include: {
          site: { select: { id: true, name: true, code: true } },
          asset: { select: { id: true, assetTag: true, name: true, block: true } },
          reportedBy: { select: { id: true, name: true, role: true } },
          assignedTo: { select: { id: true, name: true, role: true } },
          _count: { select: { events: true } },
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
 * Creates a new maintenance incident ticket with mandatory user approval check for AI extraction.
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
      select: { id: true, name: true },
    });

    if (!site) {
      throw new NotFoundError("Site not found or does not belong to your organization.");
    }

    // Determine requested status (defaults to SUBMITTED for direct user creation)
    const targetStatus: IncidentStatus = data.status || IncidentStatus.SUBMITTED;

    // Enforce critical constraint: No AI extraction can create a confirmed incident without user approval
    assertAiExtractionApproval({
      isAiExtracted: data.isAiExtracted,
      userConfirmed: data.userConfirmed,
      targetStatus,
    });

    // Enforce technician assignment protection (only supervisor/admin can assign at creation)
    if (data.assignedToUserId && session.role === "TECHNICIAN") {
      throw new ForbiddenError("Technicians cannot assign incidents to users.");
    }

    // If assetId is supplied, verify it belongs to this site and calculate 30-day repeat fault history
    let isRepeatFault = false;
    let repeatCount30d = 0;
    let matchedAsset = null;

    if (data.assetId) {
      matchedAsset = await db.asset.findFirst({
        where: {
          id: data.assetId,
          siteId: data.siteId,
        },
        select: {
          id: true,
          assetTag: true,
          name: true,
          assetType: true,
          block: true,
          row: true,
          model: true,
          siteId: true,
        },
      });

      if (!matchedAsset) {
        throw new NotFoundError("Selected equipment does not belong to this site.");
      }

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      repeatCount30d = await db.incident.count({
        where: {
          assetId: data.assetId,
          createdAt: { gte: thirtyDaysAgo },
        },
      });
      isRepeatFault = repeatCount30d > 0;
    }

    // Comprehensive domain validation: lengths, types, contradictions, and transcript preservation
    const validationReport = getIncidentValidationService().validate({
      siteId: data.siteId,
      assetId: data.assetId,
      matchedAsset: matchedAsset
        ? { ...matchedAsset, confidence: 1.0, matchReason: "Selected asset" }
        : null,
      title: data.title,
      description: data.description,
      symptoms: data.symptoms,
      errorCode: data.errorCode,
      priority: data.priority,
      faultCategory: data.faultCategory,
      status: targetStatus,
      assignedToUserId: data.assignedToUserId,
      audioRecordingId: data.audioRecordingId,
      originalTranscript: data.originalTranscript,
      detectedLanguage: data.detectedLanguage,
      isAiExtracted: data.isAiExtracted,
      userConfirmed: data.userConfirmed,
    });

    if (!validationReport.isValid) {
      if (validationReport.errors.length > 0) {
        throw new ValidationError(
          validationReport.errors[0]?.message || "Validation failed",
          validationReport.errors
        );
      }
      const fatalContradiction = validationReport.contradictions.find(
        (c) => c.severity === "ERROR"
      );
      if (fatalContradiction) {
        throw new ValidationError(
          `Contradiction detected: ${fatalContradiction.message} (${fatalContradiction.resolution})`,
          fatalContradiction
        );
      }
    }

    // Generate unique sequential ticket number
    const count = await db.incident.count({
      where: { site: { organizationId: session.organizationId } },
    });
    const ticketNumber = `INC-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

    const isConfirmed = targetStatus !== IncidentStatus.DRAFT;

    // Create incident and initial audit event in transaction
    const incident = await db.$transaction(async (tx) => {
      const created = await tx.incident.create({
        data: {
          ticketNumber,
          siteId: data.siteId,
          assetId: data.assetId,
          reportedByUserId: session.userId,
          assignedToUserId: data.assignedToUserId || null,
          title: data.title,
          description: data.description,
          symptoms: data.symptoms,
          errorCode: data.errorCode,
          priority: data.priority,
          faultCategory: data.faultCategory,
          status: targetStatus,
          isRepeatFault,
          repeatCount30d,
          originalTranscript: data.originalTranscript,
          detectedLanguage: data.detectedLanguage,
          audioRecordingId: data.audioRecordingId,
          missingFields: data.missingFields || [],
          confirmedAt: isConfirmed ? new Date() : null,
          events: {
            create: {
              userId: session.userId,
              eventType: isConfirmed ? "CONFIRMATION" : "STATUS_CHANGE",
              fromStatus: isConfirmed ? IncidentStatus.DRAFT : null,
              toStatus: targetStatus,
              title: isConfirmed ? "Incident Ticket Confirmed & Submitted" : "Draft Incident Created",
              description: isConfirmed
                ? `Incident logged by ${session.name} (${session.role}).`
                : "Initial draft generated and stored awaiting technician review.",
              diff: {
                title: data.title,
                priority: data.priority,
                faultCategory: data.faultCategory,
                status: targetStatus,
              },
            },
          },
        },
        include: {
          site: { select: { id: true, name: true, code: true } },
          asset: { select: { id: true, assetTag: true, name: true } },
          reportedBy: { select: { id: true, name: true, role: true } },
          assignedTo: { select: { id: true, name: true, role: true } },
        },
      });

      return created;
    });

    return apiSuccess(incident, undefined, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
