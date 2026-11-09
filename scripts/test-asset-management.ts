/**
 * FieldSignal — Automated Integration Test Suite for Asset Management
 *
 * Verifies all 8 features:
 * 1. Asset listing
 * 2. Asset search
 * 3. Filter by site and equipment type (INVERTER, SOLAR_MODULE, COMBINER_BOX, TRANSFORMER, OTHER)
 * 4. Asset detail page data retrieval
 * 5. Asset creation and editing for authorized users (Admin/Supervisor vs Technician 403)
 * 6. Asset status transitions
 * 7. Asset history section
 * 8. Asset code validation (format & unique per site)
 */

import { PrismaClient, UserRole, AssetType, AssetStatus } from "@prisma/client";
import { createSessionToken } from "../src/lib/session";
import {
  validateAssetCodeFormat,
  checkAssetCodeUniqueness,
  sanitizeAssetCode,
} from "../src/modules/assets/validation";
import { GET as getAssetsRoute, POST as postAssetsRoute } from "../src/app/api/v1/assets/route";
import { GET as getAssetByIdRoute, PATCH as patchAssetByIdRoute } from "../src/app/api/v1/assets/[id]/route";
import { NextRequest } from "next/server";

const prisma = new PrismaClient();

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
  }
}

async function runTestSuite() {
  console.log("==================================================================");
  console.log("⚡ FieldSignal Solar Asset Management Integration Test Suite");
  console.log("==================================================================\n");

  // Fetch test users & sites
  const orgSunrise = await prisma.organization.findUniqueOrThrow({
    where: { code: "SUNRISE-SOLAR" },
  });
  const orgApex = await prisma.organization.findUniqueOrThrow({ where: { code: "APEX-SOLAR" } });

  const siteBhadla = await prisma.site.findUniqueOrThrow({ where: { code: "SUN-BHA-04" } });
  const sitePavagada = await prisma.site.findUniqueOrThrow({ where: { code: "SUN-PAV-02" } });
  const siteApex = await prisma.site.findUniqueOrThrow({ where: { code: "APEX-REW-01" } });

  const techRajesh = await prisma.user.findUniqueOrThrow({ where: { phone: "+919876500002" } });
  const supervisorVikram = await prisma.user.findUniqueOrThrow({
    where: { phone: "+919876500001" },
  });
  const adminPooja = await prisma.user.findUniqueOrThrow({ where: { phone: "+919876500000" } });

  // Issue session tokens for testing
  const adminToken = await createSessionToken({
    userId: adminPooja.id,
    name: adminPooja.name,
    phone: adminPooja.phone,
    role: adminPooja.role,
    organizationId: adminPooja.organizationId,
    siteId: adminPooja.siteId,
  });

  const supervisorToken = await createSessionToken({
    userId: supervisorVikram.id,
    name: supervisorVikram.name,
    phone: supervisorVikram.phone,
    role: supervisorVikram.role,
    organizationId: supervisorVikram.organizationId,
    siteId: supervisorVikram.siteId,
  });

  const techToken = await createSessionToken({
    userId: techRajesh.id,
    name: techRajesh.name,
    phone: techRajesh.phone,
    role: techRajesh.role,
    organizationId: techRajesh.organizationId,
    siteId: techRajesh.siteId,
  });

  // ---------------------------------------------------------------------------
  // FEATURE 8: Asset Code Validation
  // ---------------------------------------------------------------------------
  console.log("FEATURE 8: Asset Code Validation (Format & Site Uniqueness)");

  // 8a. Format checks
  const emptyCheck = validateAssetCodeFormat("");
  assert(!emptyCheck.isValid, "Rejects empty asset code");

  const shortCheck = validateAssetCodeFormat("A");
  assert(!shortCheck.isValid, "Rejects asset code shorter than 2 characters");

  const invalidCharsCheck = validateAssetCodeFormat("INV@01#$");
  assert(!invalidCharsCheck.isValid, "Rejects invalid special characters in asset code");

  const validCheck = validateAssetCodeFormat("inv-01");
  assert(validCheck.isValid, "Accepts valid alphanumeric and hyphens");
  assert(sanitizeAssetCode("  inv-01  ") === "INV-01", "Trims and normalizes code to uppercase");

  // 8b. Uniqueness within site check
  const existingUniqueness = await checkAssetCodeUniqueness(siteBhadla.id, "INV-01");
  assert(!existingUniqueness.isUnique, "Identifies existing asset code 'INV-01' in Bhadla site");

  const newUniqueness = await checkAssetCodeUniqueness(siteBhadla.id, "INV-NEW-99");
  assert(newUniqueness.isUnique, "Confirms unused asset code 'INV-NEW-99' is unique in Bhadla site");

  // Same code in DIFFERENT site should be allowed
  const diffSiteUniqueness = await checkAssetCodeUniqueness(sitePavagada.id, "INV-01");
  assert(diffSiteUniqueness.isUnique, "Allows same asset code 'INV-01' across different sites");

  // ---------------------------------------------------------------------------
  // FEATURE 1 & 2: Asset Listing & Search
  // ---------------------------------------------------------------------------
  console.log("\nFEATURE 1 & 2: Asset Listing & Search via API");

  // 1a. List assets for Admin (portfolio view)
  const listReq = new NextRequest("http://localhost:3000/api/v1/assets", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const listRes = await getAssetsRoute(listReq);
  const listJson = await listRes.json();
  assert(listJson.success === true, "GET /api/v1/assets returns success");
  assert(Array.isArray(listJson.data) && listJson.data.length >= 10, "Returns database-backed assets list");

  // 2a. Search by code
  const searchReq = new NextRequest("http://localhost:3000/api/v1/assets?q=INV-01", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const searchRes = await getAssetsRoute(searchReq);
  const searchJson = await searchRes.json();
  assert(searchJson.data.some((a: { assetTag: string }) => a.assetTag === "INV-01"), "Search by code finds matching asset");

  // 2b. Search by name/block
  const blockSearchReq = new NextRequest("http://localhost:3000/api/v1/assets?q=Substation", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const blockSearchRes = await getAssetsRoute(blockSearchReq);
  const blockSearchJson = await blockSearchRes.json();
  assert(
    blockSearchJson.data.every((a: { block: string; name: string }) =>
      a.block.includes("Substation") || a.name.includes("Substation")
    ),
    "Search by block/name filters results appropriately"
  );

  // ---------------------------------------------------------------------------
  // FEATURE 3: Filter by Site and Equipment Type
  // ---------------------------------------------------------------------------
  console.log("\nFEATURE 3: Filter by Site and Equipment Type");

  // 3a. Site filter
  const siteFilterReq = new NextRequest(`http://localhost:3000/api/v1/assets?siteId=${siteBhadla.id}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const siteFilterRes = await getAssetsRoute(siteFilterReq);
  const siteFilterJson = await siteFilterRes.json();
  assert(
    siteFilterJson.data.every((a: { siteId: string }) => a.siteId === siteBhadla.id),
    "Filters assets strictly by specified siteId"
  );

  // 3b. All 5 equipment types verification
  const supportedTypes: AssetType[] = [
    "INVERTER",
    "SOLAR_MODULE",
    "COMBINER_BOX",
    "TRANSFORMER",
    "OTHER",
  ];

  for (const eqType of supportedTypes) {
    const typeFilterReq = new NextRequest(`http://localhost:3000/api/v1/assets?assetType=${eqType}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const typeFilterRes = await getAssetsRoute(typeFilterReq);
    const typeFilterJson = await typeFilterRes.json();
    assert(
      typeFilterJson.success === true &&
        typeFilterJson.data.every((a: { assetType: string }) => a.assetType === eqType),
      `Successfully filters by equipment type: ${eqType}`
    );
  }

  // ---------------------------------------------------------------------------
  // FEATURE 4 & 7: Asset Detail Page & History Section
  // ---------------------------------------------------------------------------
  console.log("\nFEATURE 4 & 7: Asset Detail Page Data & Maintenance History");

  const inv01 = await prisma.asset.findFirstOrThrow({
    where: { assetTag: "INV-01", siteId: siteBhadla.id },
  });

  const detailReq = new NextRequest(`http://localhost:3000/api/v1/assets/${inv01.id}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const detailRes = await getAssetByIdRoute(detailReq, { params: Promise.resolve({ id: inv01.id }) });
  const detailJson = await detailRes.json();

  assert(detailJson.success === true, "GET /api/v1/assets/[id] returns success");
  assert(detailJson.data.assetTag === "INV-01", "Returns full asset details");
  assert(detailJson.data.site.name === siteBhadla.name, "Returns attached site information");
  assert(detailJson.data.children !== undefined, "Returns hierarchy children");
  assert(Array.isArray(detailJson.data.incidents), "Returns asset maintenance incidents history");

  // ---------------------------------------------------------------------------
  // FEATURE 5: Asset Creation and Editing for Authorized Users
  // ---------------------------------------------------------------------------
  console.log("\nFEATURE 5: Asset Creation & Editing for Authorized Users");

  // 5a. Technician is prohibited from creating assets (403 Forbidden)
  const techCreateReq = new NextRequest("http://localhost:3000/api/v1/assets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${techToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      siteId: siteBhadla.id,
      assetTag: "TECH-FAIL-01",
      name: "Technician Inverter Attempt",
      assetType: "INVERTER",
      block: "Block-A",
      status: "OPERATIONAL",
    }),
  });
  const techCreateRes = await postAssetsRoute(techCreateReq);
  assert(techCreateRes.status === 403, "Technician rejected from creating asset with 403 Forbidden");

  // 5b. Supervisor creates an asset for their assigned site
  const testAssetTag = `TEST-INV-${Date.now()}`;
  const supervisorCreateReq = new NextRequest("http://localhost:3000/api/v1/assets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${supervisorToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      siteId: siteBhadla.id,
      assetTag: testAssetTag,
      name: "Supervisor Commissioned Inverter",
      assetType: "INVERTER",
      status: "OPERATIONAL",
      block: "Block-Test-01",
      row: "Row 01",
      manufacturer: "Sungrow",
      model: "SG3125HV",
      ratedCapacityKw: 3125,
    }),
  });
  const supervisorCreateRes = await postAssetsRoute(supervisorCreateReq);
  const supervisorCreateJson = await supervisorCreateRes.json();
  assert(supervisorCreateRes.status === 201, "Supervisor authorized to create asset at their site (201 Created)");
  assert(supervisorCreateJson.data.assetTag === testAssetTag, "Created asset has correct asset code");

  const createdAssetId = supervisorCreateJson.data.id;

  // 5c. Prevent duplicate asset code within same site (Uniqueness enforcement)
  const dupCreateReq = new NextRequest("http://localhost:3000/api/v1/assets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      siteId: siteBhadla.id,
      assetTag: testAssetTag, // Duplicate code!
      name: "Duplicate Tag Inverter",
      assetType: "INVERTER",
      status: "OPERATIONAL",
      block: "Block-Test-02",
    }),
  });
  const dupCreateRes = await postAssetsRoute(dupCreateReq);
  assert(
    dupCreateRes.status === 422 || dupCreateRes.status === 409,
    "Creation rejected when asset code is duplicated within site"
  );

  // ---------------------------------------------------------------------------
  // FEATURE 6: Asset Status & Editing
  // ---------------------------------------------------------------------------
  console.log("\nFEATURE 6: Asset Status Transitions & Modification");

  // 6a. Technician cannot edit asset (403 Forbidden)
  const techEditReq = new NextRequest(`http://localhost:3000/api/v1/assets/${createdAssetId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${techToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      status: "MAINTENANCE",
    }),
  });
  const techEditRes = await patchAssetByIdRoute(techEditReq, {
    params: Promise.resolve({ id: createdAssetId }),
  });
  assert(techEditRes.status === 403, "Technician rejected from editing asset with 403 Forbidden");

  // 6b. Admin updates asset status to FAULTED, then MAINTENANCE, then OPERATIONAL
  for (const newStatus of ["FAULTED", "MAINTENANCE", "OPERATIONAL"] as AssetStatus[]) {
    const editReq = new NextRequest(`http://localhost:3000/api/v1/assets/${createdAssetId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: newStatus,
        model: "Updated Model SG3125HV-Pro",
      }),
    });
    const editRes = await patchAssetByIdRoute(editReq, {
      params: Promise.resolve({ id: createdAssetId }),
    });
    const editJson = await editRes.json();
    assert(editRes.status === 200, `Admin successfully updated status to ${newStatus}`);
    assert(editJson.data.status === newStatus, `Asset status correctly persisted in DB as ${newStatus}`);
  }

  // Clean up created test asset
  await prisma.asset.delete({ where: { id: createdAssetId } });
  console.log("\n  🧹 Test asset successfully cleaned up from database");

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log("\n==================================================================");
  console.log(`📊 Asset Management Results: ${passedTests} Passed, ${failedTests} Failed`);
  console.log("==================================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite()
  .catch((e) => {
    console.error("Test execution failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

