"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AssetType, AssetStatus } from "@prisma/client";
import {
  SUPPORTED_EQUIPMENT_TYPES,
  ASSET_STATUS_OPTIONS,
} from "@/modules/assets/types";
import {
  ASSET_CODE_REGEX,
  validateAssetCodeFormat,
  sanitizeAssetCode,
} from "@/modules/assets/validation";
import {
  Layers,
  Save,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Cpu,
  MapPin,
  HelpCircle,
} from "lucide-react";

interface SiteOption {
  id: string;
  name: string;
  code: string;
}

interface ParentAssetOption {
  id: string;
  assetTag: string;
  name: string;
  siteId: string;
}

interface AssetFormProps {
  mode: "create" | "edit";
  initialData?: {
    id: string;
    siteId: string;
    assetTag: string;
    name: string;
    assetType: AssetType;
    status: AssetStatus;
    block: string;
    row?: string | null;
    parentAssetId?: string | null;
    manufacturer?: string | null;
    model?: string | null;
    serialNumber?: string | null;
    ratedCapacityKw?: number | null;
    commissionDate?: string | Date | null;
  };
  sites: SiteOption[];
  defaultSiteId?: string;
  isSiteLocked?: boolean;
  availableParents: ParentAssetOption[];
  cancelHref: string;
}

export function AssetForm({
  mode,
  initialData,
  sites,
  defaultSiteId,
  isSiteLocked = false,
  availableParents,
  cancelHref,
}: AssetFormProps) {
  const router = useRouter();

  const [siteId, setSiteId] = useState<string>(
    initialData?.siteId || defaultSiteId || (sites[0]?.id ?? "")
  );
  const [assetTag, setAssetTag] = useState<string>(initialData?.assetTag || "");
  const [name, setName] = useState<string>(initialData?.name || "");
  const [assetType, setAssetType] = useState<AssetType>(
    initialData?.assetType || "INVERTER"
  );
  const [status, setStatus] = useState<AssetStatus>(
    initialData?.status || "OPERATIONAL"
  );
  const [block, setBlock] = useState<string>(initialData?.block || "");
  const [row, setRow] = useState<string>(initialData?.row || "");
  const [parentAssetId, setParentAssetId] = useState<string>(
    initialData?.parentAssetId || ""
  );
  const [manufacturer, setManufacturer] = useState<string>(
    initialData?.manufacturer || ""
  );
  const [model, setModel] = useState<string>(initialData?.model || "");
  const [serialNumber, setSerialNumber] = useState<string>(
    initialData?.serialNumber || ""
  );
  const [ratedCapacityKw, setRatedCapacityKw] = useState<string>(
    initialData?.ratedCapacityKw !== null && initialData?.ratedCapacityKw !== undefined
      ? String(initialData.ratedCapacityKw)
      : ""
  );
  const [commissionDate, setCommissionDate] = useState<string>(() => {
    if (!initialData?.commissionDate) return "";
    try {
      return new Date(initialData.commissionDate).toISOString().split("T")[0] || "";
    } catch {
      return "";
    }
  });

  // Validation States
  const [codeValidationStatus, setCodeValidationStatus] = useState<
    "idle" | "validating" | "valid" | "invalid"
  >("idle");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Filter parents by the currently selected site and exclude self
  const filteredParents = availableParents.filter(
    (p) => p.siteId === siteId && (mode === "create" || p.id !== initialData?.id)
  );

  // Real-time debounced asset code validation
  useEffect(() => {
    if (!assetTag.trim()) {
      setCodeValidationStatus("idle");
      setCodeError(null);
      return;
    }

    const sanitized = sanitizeAssetCode(assetTag);
    const format = validateAssetCodeFormat(sanitized);

    if (!format.isValid) {
      setCodeValidationStatus("invalid");
      setCodeError(format.error || "Invalid asset code");
      return;
    }

    // If in edit mode and code unchanged, it's valid
    if (mode === "edit" && sanitized === initialData?.assetTag && siteId === initialData?.siteId) {
      setCodeValidationStatus("valid");
      setCodeError(null);
      return;
    }

    setCodeValidationStatus("validating");
    setCodeError(null);

    const timer = setTimeout(async () => {
      try {
        const queryParams = new URLSearchParams({
          siteId,
          code: sanitized,
          ...(mode === "edit" && initialData?.id ? { excludeId: initialData.id } : {}),
        });

        const res = await fetch(`/api/v1/assets/validate-code?${queryParams.toString()}`);
        const data = await res.json();

        if (data.success && data.data.isValid) {
          setCodeValidationStatus("valid");
          setCodeError(null);
        } else {
          setCodeValidationStatus("invalid");
          setCodeError(data.data?.error || data.error?.message || "Asset code already in use");
        }
      } catch {
        setCodeValidationStatus("idle");
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [assetTag, siteId, mode, initialData]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    // Client validation
    if (!siteId) {
      setFormError("Please select a solar site");
      return;
    }

    const sanitizedCode = sanitizeAssetCode(assetTag);
    const format = validateAssetCodeFormat(sanitizedCode);
    if (!format.isValid) {
      setFormError(format.error || "Please enter a valid asset code");
      return;
    }

    if (codeValidationStatus === "invalid") {
      setFormError(codeError || "Asset code is invalid or already taken");
      return;
    }

    if (!name.trim()) {
      setFormError("Asset name is required");
      return;
    }

    if (!block.trim()) {
      setFormError("Block identifier is required (e.g. Block-A, Inverter Station 01)");
      return;
    }

    const payload = {
      siteId,
      assetTag: sanitizedCode,
      name: name.trim(),
      assetType,
      status,
      block: block.trim(),
      row: row.trim() || null,
      parentAssetId: parentAssetId || null,
      manufacturer: manufacturer.trim() || null,
      model: model.trim() || null,
      serialNumber: serialNumber.trim() || null,
      ratedCapacityKw: ratedCapacityKw ? parseFloat(ratedCapacityKw) : null,
      commissionDate: commissionDate || null,
    };

    setSubmitting(true);

    try {
      const url = mode === "create" ? "/api/v1/assets" : `/api/v1/assets/${initialData?.id}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error?.message || "Failed to save asset");
      }

      const targetId = result.data.id;
      router.push(`/assets/${targetId}`);
      router.refresh();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "An unexpected error occurred");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {formError && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 flex items-start gap-2.5 text-xs text-rose-800">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold">Error saving asset</span>
            <p>{formError}</p>
          </div>
        </div>
      )}

      {/* Section 1: Identification & Site Location */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5 space-y-4 shadow-2xs">
        <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
          <MapPin className="h-4 w-4 text-blue-600" />
          <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-800">
            Plant & Asset Identification
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Site Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700 flex items-center justify-between">
              <span>Solar Plant Facility *</span>
              {isSiteLocked && (
                <span className="text-[10px] font-mono text-neutral-400">Assigned Site</span>
              )}
            </label>
            <select
              value={siteId}
              disabled={isSiteLocked}
              onChange={(e) => {
                setSiteId(e.target.value);
                setParentAssetId(""); // Reset parent if site changes
              }}
              className="w-full px-3 py-2 text-xs rounded border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name} ({site.code})
                </option>
              ))}
            </select>
          </div>

          {/* Asset Code (Tag) with Validation Feedback */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700 flex items-center justify-between">
              <span>Asset Code (Tag) *</span>
              <span className="text-[10px] font-mono text-neutral-400">Unique within site</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={assetTag}
                onChange={(e) => setAssetTag(e.target.value.toUpperCase())}
                placeholder="e.g. INV-01, SCB-02-A, TR-01"
                required
                className={`w-full px-3 py-2 text-xs font-mono font-semibold uppercase rounded border transition-colors ${
                  codeValidationStatus === "invalid"
                    ? "border-rose-400 bg-rose-50/40 focus:border-rose-600 focus:ring-rose-500"
                    : codeValidationStatus === "valid"
                      ? "border-emerald-400 bg-emerald-50/30 focus:border-emerald-600 focus:ring-emerald-500"
                      : "border-neutral-200 bg-neutral-50 focus:bg-white focus:border-blue-600"
                } focus:outline-hidden focus:ring-1`}
              />
              <div className="absolute right-2.5 top-2.5">
                {codeValidationStatus === "validating" && (
                  <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
                )}
                {codeValidationStatus === "valid" && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                )}
                {codeValidationStatus === "invalid" && (
                  <AlertCircle className="h-4 w-4 text-rose-600" />
                )}
              </div>
            </div>
            {codeError && (
              <p className="text-[11px] font-mono text-rose-600">{codeError}</p>
            )}
            {codeValidationStatus === "valid" && (
              <p className="text-[11px] font-mono text-emerald-700">
                Asset code is available for this site
              </p>
            )}
          </div>

          {/* Asset Name */}
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-semibold text-neutral-700">
              Descriptive Asset Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Central Inverter 1 (SMA 2.5MW) or Main Power Transformer 1"
              required
              className="w-full px-3 py-2 text-xs rounded border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600"
            />
          </div>

          {/* Block Identifier */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700">
              Block / Location Identifier *
            </label>
            <input
              type="text"
              value={block}
              onChange={(e) => setBlock(e.target.value)}
              placeholder="e.g. Block-A, Inverter Station 01, Substation-01"
              required
              className="w-full px-3 py-2 text-xs rounded border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600"
            />
          </div>

          {/* Row / String */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700">
              Row / String Number (Optional)
            </label>
            <input
              type="text"
              value={row}
              onChange={(e) => setRow(e.target.value)}
              placeholder="e.g. Row 04, String 12-16"
              className="w-full px-3 py-2 text-xs rounded border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Equipment Classification & Operational Status */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5 space-y-4 shadow-2xs">
        <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
          <Layers className="h-4 w-4 text-blue-600" />
          <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-800">
            Equipment Classification & Status
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Equipment Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700">
              Equipment Type *
            </label>
            <select
              value={assetType}
              onChange={(e) => setAssetType(e.target.value as AssetType)}
              className="w-full px-3 py-2 text-xs rounded border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600"
            >
              {SUPPORTED_EQUIPMENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label} ({type.description})
                </option>
              ))}
            </select>
          </div>

          {/* Operational Status */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700">
              Operational Status *
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as AssetStatus)}
              className="w-full px-3 py-2 text-xs rounded border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600 font-semibold"
            >
              {ASSET_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Parent Equipment Hierarchy */}
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-semibold text-neutral-700 flex items-center justify-between">
              <span>Parent Equipment (Hierarchy Link)</span>
              <span className="text-[10px] font-mono text-neutral-400">Optional</span>
            </label>
            <select
              value={parentAssetId}
              onChange={(e) => setParentAssetId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600 font-mono"
            >
              <option value="">None (Top-Level Equipment)</option>
              {filteredParents.map((parent) => (
                <option key={parent.id} value={parent.id}>
                  {parent.assetTag} — {parent.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Section 3: Technical Specifications & OEM Data */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5 space-y-4 shadow-2xs">
        <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
          <Cpu className="h-4 w-4 text-blue-600" />
          <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-800">
            Technical Specifications & OEM Information
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Manufacturer */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700">Manufacturer (OEM)</label>
            <input
              type="text"
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
              placeholder="e.g. SMA, ABB, Schneider, LONGi, Hensel"
              className="w-full px-3 py-2 text-xs rounded border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600"
            />
          </div>

          {/* Model */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700">Model Name / Number</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. Sunny Central 2500-EV, SG250HX"
              className="w-full px-3 py-2 text-xs rounded border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600"
            />
          </div>

          {/* Serial Number */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700">Serial Number</label>
            <input
              type="text"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder="e.g. SMA-SC2500-0194"
              className="w-full px-3 py-2 text-xs font-mono rounded border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600"
            />
          </div>

          {/* Rated Capacity (kW) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700">Rated Capacity (kW)</label>
            <input
              type="number"
              step="any"
              min="0"
              value={ratedCapacityKw}
              onChange={(e) => setRatedCapacityKw(e.target.value)}
              placeholder="e.g. 2500"
              className="w-full px-3 py-2 text-xs font-mono rounded border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600"
            />
          </div>

          {/* Commission Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700">Commission Date</label>
            <input
              type="date"
              value={commissionDate}
              onChange={(e) => setCommissionDate(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono rounded border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600"
            />
          </div>
        </div>
      </div>

      {/* Form Action Controls */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Link
          href={cancelHref}
          className="px-4 py-2 rounded border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 text-xs font-semibold transition-colors"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={submitting || codeValidationStatus === "invalid"}
          className="inline-flex items-center gap-2 px-5 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
        >
          {submitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Saving Equipment...</span>
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5" />
              <span>{mode === "create" ? "Register Asset" : "Save Changes"}</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
