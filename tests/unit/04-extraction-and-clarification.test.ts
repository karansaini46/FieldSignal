import { describe, it, expect } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  IncidentClarificationService,
  ClarificationEvaluation,
} from "@/modules/incidents/clarification-service";
import { DeterministicExtractionEngine } from "@/modules/extraction/deterministic-extractor";
import { validateTranscriptPreservation } from "@/modules/incidents/incident-validator";

const prisma = new PrismaClient();

// ponytail: test suites 6, 7 covering extraction validation & clarification workflow
describe("Audit 6 & 7: Extraction Validation & Clarification Handling", () => {
  const clarificationService = new IncidentClarificationService();
  const extractor = new DeterministicExtractionEngine();

  it("extracts equipment, alarm codes, and symptoms from technician transcripts", async () => {
    const bhadlaSite = await prisma.site.findFirst({
      where: { code: "SUN-BHA-04" },
      include: { assets: true },
    });
    expect(bhadlaSite).not.toBeNull();

    const transcript = "Inverter INV-01 tripped with alarm code E04 ground fault detected";
    const extracted = extractor.extract({
      transcript,
      site: { id: bhadlaSite!.id, name: bhadlaSite!.name, code: bhadlaSite!.code },
      knownSiteAssets: bhadlaSite!.assets,
    });

    expect(extracted.assetCode).toBe("INV-01");
    expect(extracted.reportedAlarm).toBe("E04");
    expect(extracted.faultCategory).toBe("EARTH_FAULT");
    expect(extracted.symptoms.length).toBeGreaterThan(0);
    expect(extracted.originalTranscript).toBe(transcript);
  });

  it("Example 1: identifies missing equipment and asks focused equipment question", async () => {
    const bhadlaSite = await prisma.site.findFirst({ where: { code: "SUN-BHA-04" } });
    const transcriptNoAsset =
      "Inverter room mein IGBT temperature alarm aaya hai and cooling blower fan seized lag raha hai.";

    const eval1: ClarificationEvaluation = clarificationService.identifyNextQuestion(
      {
        transcript: transcriptNoAsset,
        originalTranscript: transcriptNoAsset,
        assetCode: null,
        matchedAssetId: null,
        reportedAlarm: null,
        symptoms: ["Thermal overload / High temperature"],
      },
      [],
      bhadlaSite!.name
    );

    expect(eval1.missingFields).toContain("asset");
    expect(eval1.currentQuestion).not.toBeNull();
    expect(eval1.currentQuestion?.field).toBe("asset");
    expect(
      eval1.currentQuestion?.question.toLowerCase().includes("which") ||
        eval1.currentQuestion?.question.toLowerCase().includes("equipment") ||
        eval1.currentQuestion?.question.toLowerCase().includes("asset")
    ).toBe(true);
    expect(eval1.isComplete).toBe(false);
  });

  it("Example 2: identifies repeated tripping without current status and asks for status", async () => {
    const bhadlaSite = await prisma.site.findFirst({ where: { code: "SUN-BHA-04" } });
    const transcriptTrippingNoStatus =
      "INV-01 pehle subah 9 baje trip hua tha, abhi 11:30 baje phir trip ho gaya hai.";

    const eval2 = clarificationService.identifyNextQuestion(
      {
        transcript: transcriptTrippingNoStatus,
        originalTranscript: transcriptTrippingNoStatus,
        assetCode: "INV-01",
        matchedAssetId: "inv-01-id",
        reportedAlarm: null,
        symptoms: ["Equipment trip"],
      },
      [],
      bhadlaSite!.name
    );

    expect(eval2.missingFields).toContain("current_status");
    expect(eval2.currentQuestion?.field).toBe("current_status");
    expect(eval2.currentQuestion?.question.toLowerCase()).toContain("operational status");
    // Asset is already known, so it must not ask for equipment again
    expect(eval2.missingFields).not.toContain("asset");
  });

  it("Example 3: identifies alarm without alarm code and asks for error code", async () => {
    const bhadlaSite = await prisma.site.findFirst({ where: { code: "SUN-BHA-04" } });
    const transcriptAlarmNoCode = "INV-01 inverter screen pe red warning alarm show ho raha hai.";

    const eval3 = clarificationService.identifyNextQuestion(
      {
        transcript: transcriptAlarmNoCode,
        originalTranscript: transcriptAlarmNoCode,
        assetCode: "INV-01",
        matchedAssetId: "inv-01-id",
        reportedAlarm: null, // missing alarm code
        symptoms: ["Warning indicator illuminated"],
      },
      [],
      bhadlaSite!.name
    );

    expect(eval3.missingFields).toContain("alarm_code");
    expect(eval3.currentQuestion?.field).toBe("alarm_code");
    expect(eval3.currentQuestion?.question.toLowerCase()).toContain("alarm");
  });

  it("Example 4: mentions repair attempt without outcome and asks for result", async () => {
    const bhadlaSite = await prisma.site.findFirst({ where: { code: "SUN-BHA-04" } });
    const transcriptRepairNoOutcome =
      "INV-01 offline hai, technician ne breaker reset try kiya aur cooling filter clean kiya.";

    const eval4 = clarificationService.identifyNextQuestion(
      {
        transcript: transcriptRepairNoOutcome,
        originalTranscript: transcriptRepairNoOutcome,
        assetCode: "INV-01",
        matchedAssetId: "inv-01-id",
        reportedAlarm: "E-402",
        symptoms: ["Trip"],
        actionsAlreadyTaken: "Breaker reset attempted",
        currentStatus: "OFFLINE",
      },
      [],
      bhadlaSite!.name
    );

    expect(eval4.missingFields).toContain("repair_result");
    expect(eval4.currentQuestion?.field).toBe("repair_result");
    expect(
      eval4.currentQuestion?.question.toLowerCase().includes("result") ||
        eval4.currentQuestion?.question.toLowerCase().includes("outcome")
    ).toBe(true);
  });

  it("does not repeatedly ask questions whose answers already exist", async () => {
    const bhadlaSite = await prisma.site.findFirst({ where: { code: "SUN-BHA-04" } });
    const completeData = {
      transcript:
        "INV-01 tripped with alarm E04. It is currently running normal. I power cycled and it cleared.",
      originalTranscript:
        "INV-01 tripped with alarm E04. It is currently running normal. I power cycled and it cleared.",
      assetCode: "INV-01",
      matchedAssetId: "inv-01-id",
      reportedAlarm: "E04",
      currentStatus: "ONLINE_NORMAL",
      actionsAlreadyTaken: "Power cycled",
      symptoms: ["Unit back online"],
    };

    const evalComplete = clarificationService.identifyNextQuestion(completeData, [], bhadlaSite!.name);
    // Everything is provided -> No clarification question generated!
    expect(evalComplete.currentQuestion).toBeNull();
    expect(evalComplete.isComplete).toBe(true);
  });

  it("processes clarification response, records history, and preserves original transcript verbatim", async () => {
    const bhadlaSite = await prisma.site.findFirst({
      where: { code: "SUN-BHA-04" },
      include: { assets: true },
    });
    expect(bhadlaSite).not.toBeNull();

    const originalTranscript = "Inverter room me IGBT over-temp alarm aaya hai.";
    const initialExtracted = extractor.extract({
      transcript: originalTranscript,
      site: { id: bhadlaSite!.id, name: bhadlaSite!.name, code: bhadlaSite!.code },
      knownSiteAssets: bhadlaSite!.assets,
    });

    const result = clarificationService.processResponse({
      field: "asset",
      response: "It is INV-01 block 1",
      fromVoice: false,
      currentExtraction: initialExtracted,
      history: [],
      siteContext: {
        id: bhadlaSite!.id,
        name: bhadlaSite!.name,
        siteAssets: bhadlaSite!.assets.map((a) => ({
          ...a,
          siteId: bhadlaSite!.id,
          confidence: 0,
          matchReason: "",
        })),
      },
    });

    expect(result.updatedExtraction.assetCode).toBe("INV-01");
    expect(result.updatedExtraction.matchedAssetId).not.toBeNull();
    // Verbatim preservation of original transcript
    expect(result.updatedExtraction.originalTranscript).toBe(originalTranscript);
    expect(validateTranscriptPreservation(originalTranscript, result.updatedExtraction.originalTranscript).isPreserved).toBe(true);
    // Clarification history recorded
    expect(result.history.length).toBe(1);
    expect(result.history[0]?.response).toBe("It is INV-01 block 1");
    expect(result.history[0]?.fromVoice).toBe(false);
  });
});
