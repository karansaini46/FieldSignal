import { z } from "zod";
import { AssetType, AssetStatus } from "@prisma/client";
import { db } from "@/lib/db";

// Asset code format: 2-50 characters, alphanumeric, hyphens, underscores, dots, slashes
export const ASSET_CODE_REGEX = /^[A-Za-z0-9_\-\./]+$/;

export function sanitizeAssetCode(code: string): string {
  return code.trim().toUpperCase();
}

export function validateAssetCodeFormat(code: string): { isValid: boolean; error?: string } {
  const sanitized = sanitizeAssetCode(code);
  if (!sanitized) {
    return { isValid: false, error: "Asset code is required" };
  }
  if (sanitized.length < 2) {
    return { isValid: false, error: "Asset code must be at least 2 characters long" };
  }
  if (sanitized.length > 50) {
    return { isValid: false, error: "Asset code cannot exceed 50 characters" };
  }
  if (!ASSET_CODE_REGEX.test(sanitized)) {
    return {
      isValid: false,
      error: "Asset code may only contain uppercase letters, numbers, hyphens, and underscores",
    };
  }
  return { isValid: true };
}

/**
 * Checks whether an asset code is already registered at the given site.
 * Used for both asset creation and editing (with excludeAssetId).
 */
export async function checkAssetCodeUniqueness(
  siteId: string,
  assetCode: string,
  excludeAssetId?: string
): Promise<{ isUnique: boolean; conflictAssetId?: string }> {
  const sanitized = sanitizeAssetCode(assetCode);
  const existing = await db.asset.findFirst({
    where: {
      siteId,
      assetTag: { equals: sanitized, mode: "insensitive" },
      ...(excludeAssetId ? { id: { not: excludeAssetId } } : {}),
    },
    select: { id: true },
  });

  return {
    isUnique: !existing,
    conflictAssetId: existing?.id,
  };
}

export const assetInputSchema = z.object({
  siteId: z.string().uuid("Please select a valid solar site"),
  assetTag: z
    .string()
    .min(2, "Asset code must be at least 2 characters")
    .max(50, "Asset code cannot exceed 50 characters")
    .regex(
      ASSET_CODE_REGEX,
      "Asset code may only contain letters, numbers, hyphens, underscores, and dots"
    )
    .transform(sanitizeAssetCode),
  name: z.string().min(2, "Asset name must be at least 2 characters").max(120),
  assetType: z.nativeEnum(AssetType),
  status: z.nativeEnum(AssetStatus).default(AssetStatus.OPERATIONAL),
  block: z.string().min(1, "Block identifier is required").max(60),
  row: z.string().max(60).optional().nullable(),
  parentAssetId: z.string().uuid().optional().nullable(),
  manufacturer: z.string().max(100).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  serialNumber: z.string().max(100).optional().nullable(),
  ratedCapacityKw: z
    .number()
    .positive("Rated capacity must be positive")
    .optional()
    .nullable(),
  commissionDate: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : null)),
});

export type AssetInput = z.infer<typeof assetInputSchema>;

