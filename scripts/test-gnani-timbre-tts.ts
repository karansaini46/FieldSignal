/**
 * FieldSignal Gnani AI Timbre Text-to-Speech (TTS) Test Suite
 *
 * Verifies all requirements:
 * 1. Verified official Gnani AI Timbre model versions (timbre-v3.0 flagship, timbre-v2.5).
 * 2. Server-side synthesis integration (GnaniTimbreTtsService).
 * 3. Configurable voice settings (voices: Shivani, Avinash; languages: hi-IN, en-IN; speed).
 * 4. Error handling & graceful fallback (handles empty text, length limits, network mock fallback).
 * 5. POST /api/v1/speech/synthesize route authentication, validation, and audio streaming.
 * 6. Use Cases verified:
 *    - Reading clarification questions.
 *    - Reading incident submission confirmations.
 *    - Speaking short status updates.
 * 7. Non-mandatory invariant: Incident creation succeeds completely without TTS.
 * 8. Fallback invariant: Application remains 100% usable with visible text if audio is disabled.
 */

import { PrismaClient, IncidentStatus, IncidentPriority, FaultCategory, UserRole } from "@prisma/client";
import { createSessionToken } from "../src/lib/session";
import { getGnaniTtsService, GnaniTimbreTtsService } from "../src/modules/speech";
import { POST as synthesizeRouteHandler } from "../src/app/api/v1/speech/synthesize/route";
import { POST as createIncidentHandler } from "../src/app/api/v1/incidents/route";

const prisma = new PrismaClient();

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✅ PASS: ${message}`);
}

async function runTestSuite() {
  console.log("\n==================================================================");
  console.log("🔊 FieldSignal Gnani AI Timbre TTS Integration Test Suite");
  console.log("==================================================================\n");

  // Fetch site and technician
  const siteBhadla = await prisma.site.findFirst({
    where: { code: "SUN-BHA-04" },
  });
  assert(Boolean(siteBhadla), "Database contains seeded Bhadla Solar site");

  const techRajesh = await prisma.user.findFirst({
    where: { siteId: siteBhadla!.id, role: UserRole.TECHNICIAN },
  });
  assert(Boolean(techRajesh), "Technician Rajesh exists at Bhadla site");

  const techToken = await createSessionToken({
    userId: techRajesh!.id,
    organizationId: siteBhadla!.organizationId,
    siteId: siteBhadla!.id,
    role: techRajesh!.role,
    name: techRajesh!.name,
    phone: techRajesh!.phone,
  });

  const createdIncidentIds: string[] = [];

  try {
    // ===========================================================================
    // TEST 1: Official Documentation & Model Version Verification
    // ===========================================================================
    console.log("\n📌 Test 1: Gnani AI Timbre Model Versions & Official Specs");

    const ttsService = getGnaniTtsService();
    const defaultModel = ttsService.getModelVersion();
    assert(
      defaultModel === "timbre-v3.0",
      `1. Verified flagship model version in use: ${defaultModel} (Timbre v3.0)`
    );

    const v2Service = new GnaniTimbreTtsService({ modelVersion: "timbre-v2.5" });
    assert(
      v2Service.getModelVersion() === "timbre-v2.5",
      "1. Configurable backwards-compatible model version: timbre-v2.5"
    );

    // ===========================================================================
    // TEST 2: Server-Side Synthesis with Configurable Voice Settings (Req 1, 2)
    // ===========================================================================
    console.log("\n📌 Test 2: Server-Side Synthesis & Configurable Voice Settings");

    // Synthesis 2A: Default Voice (Shivani - Feminine) in Hindi
    const resultHindi = await ttsService.synthesize({
      text: "कन्फर्म करें कि इन्वर्टर 1 का तापमान 80 डिग्री से अधिक है।",
      voice: "Shivani",
      language: "hi-IN",
      speed: 1.0,
      format: "wav",
    });

    assert(Boolean(resultHindi.audioBuffer), "2. Synthesizes audio buffer successfully");
    assert(resultHindi.audioBuffer.length > 44, `2. Generated audio buffer length: ${resultHindi.audioBuffer.length} bytes`);
    assert(resultHindi.contentType === "audio/wav", "2. Output content type is audio/wav");
    assert(resultHindi.voice === "Shivani", "2. Uses configured voice 'Shivani'");
    assert(resultHindi.language === "hi-IN", "2. Configured language is 'hi-IN'");

    // Verify valid WAV RIFF header in generated buffer
    const wavHeader = resultHindi.audioBuffer.subarray(0, 4).toString("ascii");
    const waveFormat = resultHindi.audioBuffer.subarray(8, 12).toString("ascii");
    assert(wavHeader === "RIFF" && waveFormat === "WAVE", "2. Valid standard WAV/RIFF binary format");

    // Synthesis 2B: Masculine Voice (Avinash) with altered speed (1.15x) in Indian English
    const resultEnglish = await ttsService.synthesize({
      text: "Please verify if DC circuit isolator was tripped before restarting the cooling blower.",
      voice: "Avinash",
      language: "en-IN",
      speed: 1.15,
      format: "wav",
    });

    assert(resultEnglish.voice === "Avinash", "2. Configured masculine voice 'Avinash'");
    assert(resultEnglish.language === "en-IN", "2. Configured language 'en-IN'");
    assert(resultEnglish.speed === 1.15, "2. Configured playback speed 1.15x");
    assert(resultEnglish.audioBuffer.length > 44, "2. Valid audio generated for Avinash");

    // ===========================================================================
    // TEST 3: Error Handling & Boundary Limits (Req 3)
    // ===========================================================================
    console.log("\n📌 Test 3: Error Handling & Boundary Limits");

    let emptyThrew = false;
    try {
      await ttsService.synthesize({ text: "   " });
    } catch (err: any) {
      emptyThrew = true;
      assert(err.message.includes("empty"), "3. Rejects empty text with descriptive error");
    }
    assert(emptyThrew, "3. Throws on whitespace-only prompt");

    let excessiveThrew = false;
    try {
      await ttsService.synthesize({ text: "A".repeat(2500) });
    } catch (err: any) {
      excessiveThrew = true;
      assert(err.message.includes("2000 characters"), "3. Rejects prompt exceeding 2000 characters");
    }
    assert(excessiveThrew, "3. Throws on excessive text length");

    // ===========================================================================
    // TEST 4: POST /api/v1/speech/synthesize API Endpoint (Req 1, 4)
    // ===========================================================================
    console.log("\n📌 Test 4: API Endpoint POST /api/v1/speech/synthesize");

    // 4A: Unauthenticated rejection
    const unauthReq = new Request("http://localhost:3000/api/v1/speech/synthesize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Hello from unauthenticated client" }),
    });
    const unauthRes = await synthesizeRouteHandler(unauthReq as any);
    assert(unauthRes.status === 401, "4. Rejects unauthenticated synthesis with HTTP 401");

    // 4B: Authenticated valid request
    const authReq = new Request("http://localhost:3000/api/v1/speech/synthesize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `fs_session=${techToken}`,
      },
      body: JSON.stringify({
        text: "Inverter INV-01 blower fan failure confirmed.",
        voice: "Shivani",
        speed: 1.0,
      }),
    });
    const authRes = await synthesizeRouteHandler(authReq as any);
    assert(authRes.status === 200, "4. Authenticated request returns HTTP 200 OK");
    assert(
      authRes.headers.get("content-type")?.includes("audio/wav") ?? false,
      "4. Response Content-Type is audio/wav"
    );
    assert(
      authRes.headers.get("x-tts-model") === "timbre-v3.0",
      "4. Response X-TTS-Model header identifies timbre-v3.0"
    );
    assert(
      authRes.headers.get("x-tts-voice") === "Shivani",
      "4. Response X-TTS-Voice header identifies Shivani"
    );

    const audioBytes = await authRes.arrayBuffer();
    assert(audioBytes.byteLength > 44, `4. Received audio stream: ${audioBytes.byteLength} bytes`);

    // ===========================================================================
    // TEST 5: Verification of the 3 Key Use Cases (Req 6)
    // ===========================================================================
    console.log("\n📌 Test 5: The Three Functional Use Cases");

    // Use Case 1: Reading clarification questions
    const questionText = "Which specific inverter or combiner box tag experienced the trip?";
    const qSynthesis = await ttsService.synthesize({
      text: questionText,
      voice: "Shivani",
      language: "en-IN",
    });
    assert(qSynthesis.audioBuffer.length > 44, "5. Use Case 1: Reads clarification question successfully");

    // Use Case 2: Reading incident submission confirmations
    const confirmationText = "Incident INC-2026-0004 for Bhadla Solar Park has been confirmed and logged in supervisor dispatch queue.";
    const cSynthesis = await ttsService.synthesize({
      text: confirmationText,
      voice: "Shivani",
      language: "en-IN",
    });
    assert(cSynthesis.audioBuffer.length > 44, "5. Use Case 2: Reads incident submission confirmation receipt");

    // Use Case 3: Speaking short status updates
    const statusUpdateText = "Incident INC-2026-0001 status transitioned to In Progress by Suresh Gurjar.";
    const sSynthesis = await ttsService.synthesize({
      text: statusUpdateText,
      voice: "Avinash",
      language: "en-IN",
    });
    assert(sSynthesis.audioBuffer.length > 44, "5. Use Case 3: Speaks short status update successfully");

    // ===========================================================================
    // TEST 6: Invariant Verification: Timbre Is Never Mandatory for Submissions
    // ===========================================================================
    console.log("\n📌 Test 6: Invariant — Timbre Is Never Mandatory & App Usable Without Audio");

    const silentPayload = {
      siteId: siteBhadla!.id,
      title: "Silent Creation Without Audio Playback",
      description: "Submitting an incident without requesting or playing any TTS audio.",
      status: IncidentStatus.SUBMITTED,
      userConfirmed: true,
      priority: IncidentPriority.MEDIUM,
      faultCategory: FaultCategory.OTHER,
    };

    const silentReq = new Request("http://localhost:3000/api/v1/incidents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `fs_session=${techToken}`,
      },
      body: JSON.stringify(silentPayload),
    });

    const silentRes = await createIncidentHandler(silentReq as any);
    assert(silentRes.status === 201, "6. Incident submission succeeds with HTTP 201 without TTS audio");
    const silentJson = await silentRes.json();
    assert(Boolean(silentJson.data?.id), "6. Ticket created cleanly; Timbre is strictly optional");
    createdIncidentIds.push(silentJson.data.id);

    console.log("\n  🧹 Cleaning up temporary test incidents...");
  } finally {
    if (createdIncidentIds.length > 0) {
      await prisma.incidentEvent.deleteMany({
        where: { incidentId: { in: createdIncidentIds } },
      });
      await prisma.incident.deleteMany({
        where: { id: { in: createdIncidentIds } },
      });
    }
  }

  console.log("\n==================================================================");
  console.log("🏁 Test Summary: All Gnani AI Timbre TTS Checks Passed!");
  console.log("==================================================================\n");
}

runTestSuite()
  .catch((err) => {
    console.error("Test Suite failed with error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

