import { NextResponse } from "next/server";
import { ApiSuccessResponse, PaginationMeta } from "@/types/api";

/**
 * Standard HTTP success response helper.
 */
export function apiSuccess<T>(
  data: T,
  meta?: PaginationMeta | Record<string, unknown>,
  status = 200
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      ...(meta ? { meta } : {}),
    },
    { status }
  );
}

/**
 * HTTP 201 Created response helper.
 */
export function apiCreated<T>(data: T): NextResponse<ApiSuccessResponse<T>> {
  return apiSuccess(data, undefined, 201);
}

/**
 * Standard paginated response helper.
 */
export function apiPaginated<T>(
  items: T[],
  page: number,
  limit: number,
  totalCount: number
): NextResponse<ApiSuccessResponse<T[]>> {
  const totalPages = Math.ceil(totalCount / limit);
  const meta: PaginationMeta = {
    page,
    limit,
    totalCount,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };

  return apiSuccess(items, meta, 200);
}
