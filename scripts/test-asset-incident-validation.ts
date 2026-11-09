/**
 * Comprehensive Test Suite: Deterministic Asset Matching & Incident Validation
 *
 * Verifies all 9 requirements and critical constraints:
 * 1. Match extracted asset codes against actual database assets.
 * 2. Ensure the asset belongs to the selected site.
 * 3. Reject unknown asset references (never silently select an unrelated asset).
 * 4. Identify ambiguous asset matches (request manual selection).
 * 5. Validate extracted equipment type (and asset compatibility).
 * 6. Validate incident field lengths and types.
 * 7. Detect missing required information (triage completeness).
 * 8. Detect contradictory extracted fields (domain heuristics).
 * 9. Preserve the original transcript verbatim.
 */

import { PrismaClient, AssetType, FaultCategory, IncidentPriority, IncidentStatus } from "@prisma/client";
import {
  DeterministicAssetMatcher,
  getAssetMatcher,
  MatchedAssetCandidate,
} from "../src/modules/assets/asset-matcher";
import {
  IncidentValidationService,
  getIncidentValidationService,
  validateFieldLengthsAndTypes,
  validateEquipmentType,
  detectMissingInformation,
  detectContradictoryFields,
  validateTranscriptPreservation,
} from "../src/modules/incidents/incident-validator";
import { getIncidentExtractionEngine, ExtractionInput } from "../src/modules/extraction";
import { POST as postIncidentsRoute, GET as getIncidentsRoute } from "../src/app/api/v1/incidents/route";
import { createSessionToken } from "../src/lib/session";
import { NextRequest } from "next/server";

const prisma = new PrismaClient();

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName}${details ? ` -> ${details}` : ""}`);
    failedCount++;
  }
}

async function runTests() {
  console.log("==================================================================");
  console.log("🧪 FieldSignal Asset Matching & Incident Validation Test Suite");
  console.log("==================================================================\n");

  const matcher = getAssetMatcher();
  const validator = getIncidentValidationService();
  const engine = getIncidentExtractionEngine();

  // Load test sites and assets from database
  const siteBhadla = await prisma.site.findUniqueOrThrow({ where: { code: "SUN-BHA-04" } });
  const sitePavagada = await prisma.site.findUniqueOrThrow({ where: { code: "SUN-PAV-02" } });

  const techUser = await prisma.user.findUniqueOrThrow({ where: { phone: "+919876500002" } });
  const supervisorUser = await prisma.user.findUniqueOrThrow({ where: { phone: "+919876500001" } });

  const supervisorToken = await createSessionToken({
    userId: supervisorUser.id,
    name: supervisorUser.name,
    phone: supervisorUser.phone,
    role: supervisorUser.role,
    organizationId: supervisorUser.organizationId,
    siteId: supervisorUser.siteId,
  });

  const bhadlaAssets = await prisma.asset.findMany({
    where: { siteId: siteBhadla.id },
  });
  const pavagadaAssets = await prisma.asset.findMany({
    where: { siteId: sitePavagada.id },
  });

  const bhadlaAssetCandidates: MatchedAssetCandidate[] = bhadlaAssets.map((a) => ({
    id: a.id,
    assetTag: a.assetTag,
    name: a.name,
    assetType: a.assetType,
    block: a.block,
    row: a.row,
    model: a.model,
    siteId: a.siteId,
    siteName: siteBhadla.name,
    confidence: 0,
    matchReason: "",
  }));

  const pavagadaAssetCandidates: MatchedAssetCandidate[] = pavagadaAssets.map((a) => ({
    id: a.id,
    assetTag: a.assetTag,
    name: a.name,
    assetType: a.assetType,
    block: a.block,
    row: a.row,
    model: a.model,
    siteId: a.siteId,
    siteName: sitePavagada.name,
    confidence: 0,
    matchReason: "",
  }));

  // ===========================================================================
  // REQUIREMENT 1: Match Extracted Asset Codes Against Actual Database Assets
  // ===========================================================================
  console.log("📌 Group 1: Deterministic Matching Against Database Assets (Req 1)");

  // 1.1 Exact tag match
  const rExact = matcher.matchAsset(
    { extractedCode: "INV-01" },
    { siteId: siteBhadla.id, siteName: siteBhadla.name, siteAssets: bhadlaAssetCandidates }
  );
  assert(rExact.status === "EXACT_MATCH", "Exact tag 'INV-01' returns EXACT_MATCH");
  assert(rExact.matchedAsset?.assetTag === "INV-01", "Matches correct assetTag 'INV-01'");
  assert(rExact.confidence >= 0.95, "Exact match has confidence >= 0.95");
  assert(rExact.requiresManualSelection === false, "Does not require manual selection for exact match");

  // 1.2 Normalized tag match (case, spaces, hyphens)
  const rNorm = matcher.matchAsset(
    { extractedCode: "inv 01" },
    { siteId: siteBhadla.id, siteName: siteBhadla.name, siteAssets: bhadlaAssetCandidates }
  );
  assert(rNorm.status === "EXACT_MATCH", "Spaced lowercase 'inv 01' normalizes and matches");
  assert(rNorm.matchedAsset?.assetTag === "INV-01", "Resolves to canonical tag 'INV-01'");

  // 1.3 Full name match
  const inv01 = bhadlaAssets.find((a) => a.assetTag === "INV-01")!;
  const rName = matcher.matchAsset(
    { extractedCode: inv01.name },
    { siteId: siteBhadla.id, siteName: siteBhadla.name, siteAssets: bhadlaAssetCandidates }
  );
  assert(rName.status === "EXACT_MATCH", "Matches full asset name to correct asset tag");

  // 1.4 Live database asset lookup helper
  const rDb = await matcher.matchAssetAgainstDatabase(prisma, {
    siteId: siteBhadla.id,
    extractedCode: "SCB-01-A",
  });
  assert(rDb.status === "EXACT_MATCH", "matchAssetAgainstDatabase finds SCB-01-A from database");
  assert(rDb.matchedAsset?.assetTag === "SCB-01-A", "Resolves live database asset record");

  // ===========================================================================
  // REQUIREMENT 2: Ensure Asset Belongs to Selected Site
  // ===========================================================================
  console.log("\n📌 Group 2: Site Ownership Enforcement & Cross-Site Detection (Req 2)");

  // 2.1 Cross-site asset code: Pavagada string inverter queried against Bhadla site
  const strInvPav = pavagadaAssets.find((a) => a.assetTag === "STR-INV-01");
  assert(Boolean(strInvPav), "Pavagada has STR-INV-01 asset");

  const rCrossSite = matcher.matchAsset(
    { extractedCode: "STR-INV-01" },
    { siteId: siteBhadla.id, siteName: siteBhadla.name, siteAssets: bhadlaAssetCandidates },
    { checkCrossSite: true, crossSiteAssets: pavagadaAssetCandidates }
  );
  assert(rCrossSite.status === "SITE_MISMATCH", "Detects asset belongs to another site (SITE_MISMATCH)");
  assert(rCrossSite.matchedAsset === null, "Leaves matchedAsset as null on site mismatch");
  assert(rCrossSite.requiresManualSelection === true, "Enforces manual selection on site mismatch");
  assert(
    rCrossSite.clarificationPrompt?.includes("Pavagada") || rCrossSite.reason.includes("Pavagada"),
    "Clarification identifies the correct owner site"
  );

  // 2.2 Selected assetId belonging to another site is strictly rejected
  const rMismatchedId = matcher.matchAsset(
    { selectedAssetId: strInvPav!.id },
    { siteId: siteBhadla.id, siteName: siteBhadla.name, siteAssets: bhadlaAssetCandidates }
  );
  assert(rMismatchedId.status === "SITE_MISMATCH", "Rejects foreign assetId with SITE_MISMATCH");
  assert(rMismatchedId.matchedAsset === null, "matchedAsset is null for foreign assetId");

  // ===========================================================================
  // REQUIREMENT 3: Reject Unknown Asset References
  // ===========================================================================
  console.log("\n📌 Group 3: Unknown Asset Reference Rejection (Req 3)");

  const rUnknown = matcher.matchAsset(
    { extractedCode: "INV-9999" },
    { siteId: siteBhadla.id, siteName: siteBhadla.name, siteAssets: bhadlaAssetCandidates },
    { checkCrossSite: true, crossSiteAssets: pavagadaAssetCandidates }
  );
  assert(rUnknown.status === "NO_MATCH", "Rejects fictitious asset tag 'INV-9999' as NO_MATCH");
  assert(rUnknown.matchedAsset === null, "matchedAsset is null for unknown asset");
  assert(rUnknown.candidates.length === 0, "No candidate assets provided for unknown reference");
  assert(rUnknown.requiresManualSelection === true, "Requests manual selection for unknown asset");
  assert(
    !bhadlaAssetCandidates.some((a) => a.id === (rUnknown.matchedAsset as any)?.id),
    "Never silently selects an unrelated asset on unknown code"
  );

  // ===========================================================================
  // REQUIREMENT 4: Identify Ambiguous Asset Matches
  // ===========================================================================
  console.log("\n📌 Group 4: Identify Ambiguous Asset Matches (Req 4)");

  // Bhadla has INV-01 and INV-03, both Central Inverters
  // Querying "Inverter" or "Central Inverter" matches multiple inverters
  const rAmbiguousName = matcher.matchAsset(
    { extractedCode: "Central Inverter" },
    { siteId: siteBhadla.id, siteName: siteBhadla.name, siteAssets: bhadlaAssetCandidates }
  );
  assert(
    rAmbiguousName.status === "AMBIGUOUS_MATCH",
    "Generic 'Central Inverter' identified as AMBIGUOUS_MATCH"
  );
  assert(rAmbiguousName.matchedAsset === null, "matchedAsset is null for ambiguous match");
  assert(rAmbiguousName.candidates.length >= 2, "Identifies multiple candidates (INV-01, INV-03)");
  assert(rAmbiguousName.requiresManualSelection === true, "Flags requiresManualSelection = true");
  assert(
    Boolean(
      rAmbiguousName.clarificationPrompt?.includes("Which") ||
        rAmbiguousName.clarificationPrompt?.includes("Multiple")
    ),
    "Generates clarification prompt listing candidates for technician"
  );

  // Spoken transcript mentioning two assets: "INV-01 tripped and SCB-01-A has high heat"
  const multiCandidateTranscript =
    "INV-01 mein alarm aaya hai aur SCB-01-A mein bhi smoke dikh raha hai.";
  const extractedMentions = matcher.extractCandidateReferencesFromTranscript(
    multiCandidateTranscript,
    bhadlaAssetCandidates
  );
  assert(
    extractedMentions.includes("INV-01") && extractedMentions.includes("SCB-01-A"),
    "Transcript scanner identifies both mentioned assets"
  );

  // ===========================================================================
  // REQUIREMENT 5: Validate Extracted Equipment Type
  // ===========================================================================
  console.log("\n📌 Group 5: Equipment Type Validation & Asset Compatibility (Req 5)");

  // 5.1 Valid equipment types
  const evInverter = validateEquipmentType("INVERTER", AssetType.INVERTER);
  assert(evInverter.isValid === true, "INVERTER equipment type is valid and compatible with INVERTER asset");
  assert(evInverter.isCompatibleWithAsset === true, "isCompatibleWithAsset is true");

  // 5.2 Invalid / unknown equipment type
  const evInvalid = validateEquipmentType("WIND_TURBINE_BLADE");
  assert(evInvalid.isValid === false, "Rejects invalid equipment type 'WIND_TURBINE_BLADE'");
  assert(Boolean(evInvalid.error), "Provides descriptive error message for invalid equipment type");

  // 5.3 Equipment Type vs Asset Type Contradiction
  const evMismatch = validateEquipmentType("TRANSFORMER", AssetType.INVERTER);
  assert(evMismatch.isValid === false, "Rejects TRANSFORMER equipment classification on an INVERTER asset");
  assert(evMismatch.isCompatibleWithAsset === false, "isCompatibleWithAsset is false on mismatch");
  assert(
    evMismatch.contradiction?.code === "EQUIPMENT_TYPE_MISMATCH",
    "Produces EQUIPMENT_TYPE_MISMATCH contradiction"
  );

  // ===========================================================================
  // REQUIREMENT 6: Validate Incident Field Lengths and Types
  // ===========================================================================
  console.log("\n📌 Group 6: Incident Field Lengths and Types (Req 6)");

  // 6.1 Valid payload passes
  const validFields = validateFieldLengthsAndTypes({
    siteId: siteBhadla.id,
    title: "Inverter 1 IGBT Overtemp Fault",
    description: "Cooling blower fan seized resulting in 94C heatsink temperature.",
    symptoms: "Grinding sound, high heat",
    errorCode: "E-402",
    priority: IncidentPriority.HIGH,
    faultCategory: FaultCategory.OVER_TEMPERATURE,
    status: IncidentStatus.SUBMITTED,
  });
  assert(validFields.isValid === true, "Valid fields pass validation without errors");
  assert(validFields.errors.length === 0, "Zero errors on valid input");

  // 6.2 Missing / invalid siteId
  const invalidSite = validateFieldLengthsAndTypes({
    siteId: "not-a-uuid",
    title: "Valid Title",
    description: "Valid description text",
  });
  assert(invalidSite.isValid === false, "Rejects malformed siteId format");
  assert(invalidSite.errors.some((e) => e.field === "siteId"), "Reports error on siteId");

  // 6.3 Title length boundaries: < 3 chars, > 200 chars, whitespace-only
  const shortTitle = validateFieldLengthsAndTypes({
    siteId: siteBhadla.id,
    title: "AB",
    description: "Valid description text",
  });
  assert(shortTitle.errors.some((e) => e.field === "title" && e.code === "TOO_SHORT"), "Rejects title < 3 chars");

  const longTitle = validateFieldLengthsAndTypes({
    siteId: siteBhadla.id,
    title: "A".repeat(201),
    description: "Valid description text",
  });
  assert(longTitle.errors.some((e) => e.field === "title" && e.code === "TOO_LONG"), "Rejects title > 200 chars");

  const blankTitle = validateFieldLengthsAndTypes({
    siteId: siteBhadla.id,
    title: "     ",
    description: "Valid description text",
  });
  assert(blankTitle.errors.some((e) => e.field === "title" && e.code === "WHITESPACE_ONLY"), "Rejects whitespace-only title");

  // 6.4 Description length boundaries: < 5 chars, > 5000 chars
  const shortDesc = validateFieldLengthsAndTypes({
    siteId: siteBhadla.id,
    title: "Valid Title",
    description: "Trip",
  });
  assert(shortDesc.errors.some((e) => e.field === "description" && e.code === "TOO_SHORT"), "Rejects description < 5 chars");

  const longDesc = validateFieldLengthsAndTypes({
    siteId: siteBhadla.id,
    title: "Valid Title",
    description: "A".repeat(5001),
  });
  assert(longDesc.errors.some((e) => e.field === "description" && e.code === "TOO_LONG"), "Rejects description > 5000 chars");

  // 6.5 ErrorCode length boundary: > 50 chars
  const longError = validateFieldLengthsAndTypes({
    siteId: siteBhadla.id,
    title: "Valid Title",
    description: "Valid description text",
    errorCode: "E-" + "9".repeat(50),
  });
  assert(longError.errors.some((e) => e.field === "errorCode" && e.code === "TOO_LONG"), "Rejects errorCode > 50 chars");

  // 6.6 Invalid enum values
  const invalidPriority = validateFieldLengthsAndTypes({
    siteId: siteBhadla.id,
    title: "Valid Title",
    description: "Valid description text",
    priority: "SUPER_URGENT",
  });
  assert(invalidPriority.errors.some((e) => e.field === "priority" && e.code === "INVALID_ENUM"), "Rejects non-enum priority");

  // ===========================================================================
  // REQUIREMENT 7: Detect Missing Required Information
  // ===========================================================================
  console.log("\n📌 Group 7: Detect Missing Required Information (Req 7)");

  // 7.1 Missing asset
  const missingAssetReport = detectMissingInformation({
    siteId: siteBhadla.id,
    title: "Noise observed",
    description: "Screeching sound coming from equipment",
    symptoms: "Grinding noise",
  });
  assert(missingAssetReport.missingFields.includes("assetId"), "Detects missing asset in report");
  assert(missingAssetReport.needsClarification === true, "Flags needsClarification = true when asset missing");
  assert(
    missingAssetReport.clarificationQuestions.some((q) => q.toLowerCase().includes("which")),
    "Provides targeted question asking for equipment tag"
  );

  // 7.2 Missing fault symptoms AND error code
  const missingFaultEvidence = detectMissingInformation({
    siteId: siteBhadla.id,
    assetCode: "INV-01",
    title: "Asset Check",
    description: "Routine check performed on inverter.",
  });
  assert(
    missingFaultEvidence.missingFields.includes("symptomsOrErrorCode"),
    "Detects absence of both symptoms and error code"
  );
  assert(
    missingFaultEvidence.clarificationQuestions.some((q) => q.toLowerCase().includes("alarm") || q.toLowerCase().includes("symptoms")),
    "Provides clarification question asking for symptoms/alarm"
  );

  // 7.3 Complete report has 0 missing fields
  const completeReport = detectMissingInformation({
    siteId: siteBhadla.id,
    assetCode: "INV-01",
    title: "Inverter 1 Overtemp",
    description: "High temperature alarm on heatsink.",
    errorCode: "E-402",
    symptoms: "Heatsink 92C",
  });
  assert(completeReport.missingFields.length === 0, "Complete report has zero missing fields");
  assert(completeReport.needsClarification === false, "Complete report needsClarification = false");

  // ===========================================================================
  // REQUIREMENT 8: Detect Contradictory Extracted Fields
  // ===========================================================================
  console.log("\n📌 Group 8: Detect Contradictory Extracted Fields (Req 8)");

  // 8.1 Asset Type vs Fault Category Contradiction
  // TRACKER_FAILURE reported on an INVERTER asset
  const cTrackerOnInverter = detectContradictoryFields({
    matchedAsset: {
      id: inv01.id,
      assetTag: "INV-01",
      name: "Central Inverter 1",
      assetType: AssetType.INVERTER,
      siteId: siteBhadla.id,
      confidence: 1.0,
      matchReason: "",
    },
    faultCategory: FaultCategory.TRACKER_FAILURE,
    title: "Tracker slew motor stalled",
    description: "Slew drive motor mechanical failure on inverter.",
  });
  assert(
    cTrackerOnInverter.some((c) => c.code === "CATEGORY_ASSET_TYPE_CONTRADICTION"),
    "Detects TRACKER_FAILURE on INVERTER as fatal contradiction"
  );

  // 8.2 Safety Hazard (Fire/Smoke) with LOW priority contradiction
  const cFireWithLowPriority = detectContradictoryFields({
    priority: IncidentPriority.LOW,
    faultCategory: FaultCategory.DC_ARC_FIRE,
    title: "Arc flash and fire in combiner box",
    description: "Visible smoke and active flame at DC busbar.",
    symptoms: "Smoke and fire observed",
  });
  assert(
    cFireWithLowPriority.some((c) => c.code === "SAFETY_HAZARD_LOW_PRIORITY_CONTRADICTION"),
    "Detects fire/smoke hazard with LOW priority as ERROR contradiction"
  );

  // 8.3 Digital Inverter Alarm Code on Passive Solar Module
  const cAlarmOnModule = detectContradictoryFields({
    equipmentType: "SOLAR_MODULE",
    errorCode: "E-402",
    title: "PV Module Error",
    description: "Solar panel showing error code E-402.",
  });
  assert(
    cAlarmOnModule.some((c) => c.code === "ALARM_CODE_ON_PASSIVE_MODULE_CONTRADICTION"),
    "Flags inverter digital alarm code on passive SOLAR_MODULE"
  );

  // 8.4 RESOLVED status without resolution notes
  const cResolvedNoNotes = detectContradictoryFields({
    status: IncidentStatus.RESOLVED,
    resolutionNotes: null,
    title: "Resolved Inverter 1 Trip",
    description: "Issue was resolved.",
    assignedToUserId: techUser.id,
  });
  assert(
    cResolvedNoNotes.some((c) => c.code === "RESOLVED_WITHOUT_NOTES_CONTRADICTION"),
    "Detects RESOLVED status without resolution notes"
  );

  // 8.5 Master validator integrates contradiction checks and marks isValid = false
  const masterValidationReport = validator.validate({
    siteId: siteBhadla.id,
    title: "Combiner Box Fire",
    description: "Active flame and heavy smoke observed in combiner box.",
    priority: IncidentPriority.LOW, // Contradiction!
    faultCategory: FaultCategory.DC_ARC_FIRE,
  });
  assert(masterValidationReport.isValid === false, "Master validator marks incident invalid when fatal contradiction exists");
  assert(masterValidationReport.contradictions.length > 0, "Contains detected contradiction in report");

  // ===========================================================================
  // REQUIREMENT 9: Preserve Original Transcript
  // ===========================================================================
  console.log("\n📌 Group 9: Preserve Original Transcript Verbatim (Req 9)");

  const spokenTranscript =
    "INV-01 mein cooling fan band ho gaya hai. Error code E-402 show kar raha hai aur DC switch isolate kiya.";

  // 9.1 Validator verifies preservation
  const preservationCheck = validateTranscriptPreservation(spokenTranscript, "Summarized text");
  assert(preservationCheck.isPreserved === true, "Validates transcript is preserved");
  assert(preservationCheck.preservedTranscript === spokenTranscript, "Preserves verbatim text unchanged");

  // 9.2 Extraction engine preserves verbatim original transcript
  const extractedWithTranscript = await engine.extractIncident({
    transcript: spokenTranscript,
    site: { id: siteBhadla.id, name: siteBhadla.name, code: siteBhadla.code },
    knownSiteAssets: bhadlaAssetCandidates,
  });
  assert(
    extractedWithTranscript.originalTranscript === spokenTranscript,
    "ExtractionEngine strictly preserves verbatim input transcript"
  );

  // 9.3 API Route persists originalTranscript to database and allows retrieval
  const testTicketTitle = "Test Transcript Preservation Ticket";
  const createReq = new NextRequest("http://localhost:3000/api/v1/incidents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${supervisorToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      siteId: siteBhadla.id,
      assetId: inv01.id,
      title: testTicketTitle,
      description: "Inverter 1: Thermal overload observed with alarm E-402.",
      symptoms: "Cooling fan stopped",
      errorCode: "E-402",
      priority: IncidentPriority.HIGH,
      faultCategory: FaultCategory.OVER_TEMPERATURE,
      status: IncidentStatus.SUBMITTED,
      originalTranscript: spokenTranscript,
      detectedLanguage: "hinglish",
    }),
  });

  const createRes = await postIncidentsRoute(createReq);
  const createJson = await createRes.json();
  assert(createRes.status === 201, "API creates incident with originalTranscript (HTTP 201)");
  assert(
    createJson.data.originalTranscript === spokenTranscript,
    "API response reflects exact originalTranscript"
  );

  // Read back directly from database to prove permanent database persistence
  const persistedIncident = await prisma.incident.findUnique({
    where: { id: createJson.data.id },
    select: { originalTranscript: true, detectedLanguage: true, description: true },
  });
  assert(
    persistedIncident?.originalTranscript === spokenTranscript,
    "Database stores uncorrupted original transcript in originalTranscript column"
  );
  assert(
    persistedIncident?.description !== persistedIncident?.originalTranscript,
    "Preserves original transcript separate from edited/summarized description"
  );

  // Cleanup test incident
  await prisma.incidentEvent.deleteMany({ where: { incidentId: createJson.data.id } });
  await prisma.incident.delete({ where: { id: createJson.data.id } });

  // ===========================================================================
  // Summary
  // ===========================================================================
  console.log("\n==================================================================");
  console.log(`🏁 Test Summary: ${passedCount} Passed, ${failedCount} Failed`);
  console.log("==================================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests()
  .catch((err) => {
    console.error("Fatal test suite runner error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
