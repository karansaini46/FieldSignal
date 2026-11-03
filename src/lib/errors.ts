import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { ApiErrorResponse } from "@/types/api";

export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "UNPROCESSABLE_ENTITY"
  | "SPEECH_PROCESSING_ERROR"
  | "EXTRACTION_FAILED"
  | "ASSET_AMBIGUOUS"
  | "ASSET_NOT_FOUND"
  | "RATE_LIMIT_EXCEEDED"
  | "INTERNAL_SERVER_ERROR";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode = 500,
    code: ErrorCode = "INTERNAL_SERVER_ERROR",
    details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request", details?: unknown) {
    super(message, 400, "BAD_REQUEST", details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action") {
    super(message, 403, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found", details?: unknown) {
    super(message, 404, "NOT_FOUND", details);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: unknown) {
    super(message, 422, "VALIDATION_ERROR", details);
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, details?: unknown) {
    super(`${service} service error: ${message}`, 502, "INTERNAL_SERVER_ERROR", details);
  }
}

/**
 * Centralized API Error Handler for Next.js Route Handlers.
 * Transforms domain errors, Zod validation errors, and Prisma exceptions
 * into structured ApiErrorResponse envelopes.
 */
export function handleApiError(error: unknown): NextResponse<ApiErrorResponse> {
  const requestId = crypto.randomUUID();

  // 1. Known Domain Application Errors
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          requestId,
        },
      },
      { status: error.statusCode }
    );
  }

  // 2. Zod Schema Validation Errors
  if (error instanceof ZodError) {
    const formattedDetails = error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
      code: issue.code,
    }));

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Request payload failed schema validation",
          details: formattedDetails,
          requestId,
        },
      },
      { status: 422 }
    );
  }

  // 3. Prisma Database Errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = (error.meta?.target as string[])?.join(", ") ?? "field";
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CONFLICT",
            message: `A record with this ${target} already exists.`,
            requestId,
          },
        },
        { status: 409 }
      );
    }

    if (error.code === "P2025") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "The requested database record was not found.",
            requestId,
          },
        },
        { status: 404 }
      );
    }
  }

  // 4. Unexpected / Unhandled Server Errors
  console.error(`[Unhandled Error] [ReqID: ${requestId}]:`, error);

  return NextResponse.json(
    {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message:
          process.env.NODE_ENV === "production"
            ? "An unexpected internal server error occurred"
            : error instanceof Error
              ? error.message
              : "Unknown internal error",
        requestId,
      },
    },
    { status: 500 }
  );
}
