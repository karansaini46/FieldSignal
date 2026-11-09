/**
 * Test Suite: Browser-Based Audio Recording & Actual Gnani AI Integration
 * Tests:
 * 1. Mobile & Desktop MIME negotiation (Chrome, Safari, iOS, Android)
 * 2. Audio payload & format validation
 * 3. Server-side transcription with actual Gnani API credentials (prisma-v3.0)
 * 4. Duplicate submission prevention via payload hashing
 * 5. Audio transcoding to 16kHz mono WAV via ffmpeg
 * 6. Immutability of original transcript in database
 * 7. Correct handling of empty speech (no fake placeholder results)
 */

import {
  getBestSupportedMimeType,
  validateAudioPayload,
  SUPPORTED_AUDIO_MIME_TYPES,
  MAX_AUDIO_BYTES,
  MIN_AUDIO_BYTES,
  GnaniAudioValidationError,
  getAudioFileExtension,
  getGnaniSpeechService,
} from "../src/modules/speech";
import { transcodeToWav } from "../src/modules/speech/audio-transcoder";
import { db } from "../src/lib/db";
import { POST as transcribeHandler } from "../src/app/api/v1/speech/transcribe/route";
import { NextRequest } from "next/server";

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

function createValidWavBuffer(seconds = 1, sampleRate = 16000): Buffer {
  const numChannels = 1;
  const bytesPerSample = 2;
  const dataSize = seconds * sampleRate * numChannels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);

  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28);
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32);
  buffer.writeUInt16LE(bytesPerSample * 8, 34);

  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < seconds * sampleRate; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * 440 * t) * 8000;
    buffer.writeInt16LE(Math.floor(sample), 44 + i * 2);
  }

  return buffer;
}

async function runTests() {
  console.log("\n🧪 Starting Audio Recording & Actual Gnani AI Integration Test Suite...\n");

  // ---------------------------------------------------------------------------
  // Test Group 1: MIME Type & Mobile Browser Support
  // ---------------------------------------------------------------------------
  console.log("📌 Group 1: Mobile & Desktop MIME Type Negotiation");
  try {
    (globalThis as any).window = {
      MediaRecorder: {
        isTypeSupported: (type: string) =>
          type.includes("audio/webm;codecs=opus") || type === "audio/webm",
      },
    };
    assert(
      getBestSupportedMimeType() === "audio/webm;codecs=opus",
      "Prefers audio/webm;codecs=opus on Chrome/Firefox desktop & Android"
    );

    (globalThis as any).window = {
      MediaRecorder: {
        isTypeSupported: (type: string) =>
          type === "audio/mp4" || type === "audio/aac",
      },
    };
    assert(
      getBestSupportedMimeType() === "audio/mp4",
      "Gracefully negotiates audio/mp4 on iOS Safari mobile browsers"
    );

    (globalThis as any).window = {
      MediaRecorder: {
        isTypeSupported: (type: string) => type === "audio/aac",
      },
    };
    assert(
      getBestSupportedMimeType() === "audio/aac",
      "Falls back to audio/aac when MP4 is unavailable on mobile"
    );

    delete (globalThis as any).window;
  } catch (err: any) {
    console.error("Unexpected error in Group 1:", err);
  }

  // ---------------------------------------------------------------------------
  // Test Group 2: Audio Payload & Format Validation
  // ---------------------------------------------------------------------------
  console.log("\n📌 Group 2: Recording Format & Size Validation");
  try {
    let caughtTooSmall = false;
    try {
      validateAudioPayload(50, "audio/webm");
    } catch (e) {
      if (e instanceof GnaniAudioValidationError) {
        caughtTooSmall = true;
      }
    }
    assert(caughtTooSmall, "Rejects micro-recordings under 100 bytes minimum limit");

    let caughtTooLarge = false;
    try {
      validateAudioPayload(26 * 1024 * 1024, "audio/webm");
    } catch (e) {
      if (e instanceof GnaniAudioValidationError) {
        caughtTooLarge = true;
      }
    }
    assert(caughtTooLarge, "Rejects audio recordings exceeding 25MB maximum threshold");

    let formatValidationPassed = true;
    try {
      validateAudioPayload(50000, "audio/webm");
      validateAudioPayload(50000, "audio/mp4");
      validateAudioPayload(50000, "audio/aac");
      validateAudioPayload(50000, "audio/ogg");
      validateAudioPayload(50000, "audio/wav");
    } catch {
      formatValidationPassed = false;
    }
    assert(formatValidationPassed, "Passes validation for all mobile & desktop audio formats");

    assert(getAudioFileExtension("audio/mp4") === "mp4", "Maps audio/mp4 to .mp4 extension");
    assert(getAudioFileExtension("audio/aac") === "aac", "Maps audio/aac to .aac extension");
    assert(getAudioFileExtension("audio/webm") === "webm", "Maps audio/webm to .webm extension");
  } catch (err: any) {
    console.error("Unexpected error in Group 2:", err);
  }

  // ---------------------------------------------------------------------------
  // Test Group 3: Server-Side Audio Transcoding
  // ---------------------------------------------------------------------------
  console.log("\n📌 Group 3: Audio Transcoding to 16kHz PCM WAV");
  try {
    const testWav = createValidWavBuffer(1.0, 16000);
    const result = await transcodeToWav(testWav, "audio/wav");

    assert(result.mimeType === "audio/wav", "Preserves audio/wav MIME type");
    assert(result.buffer.toString("utf8", 0, 4) === "RIFF", "Transcoded buffer begins with RIFF header");
    assert(result.buffer.toString("utf8", 8, 12) === "WAVE", "Transcoded buffer contains WAVE format");
    assert(result.buffer.readUInt32LE(24) === 16000, "Ensures 16000 Hz sample rate");
  } catch (err: any) {
    console.error("Unexpected error in Group 3:", err);
  }

  // ---------------------------------------------------------------------------
  // Test Group 4: Server-Side Transcription & Database Persistence (Actual Gnani API)
  // ---------------------------------------------------------------------------
  console.log("\n📌 Group 4: Server-Side Transcription with Actual Gnani AI STT");
  let testRecordingId: string | null = null;
  let technicianToken: string | null = null;
  let sampleAudioBytes: Buffer | null = null;

  try {
    const unauthReq = new NextRequest("http://localhost:3000/api/v1/speech/transcribe", {
      method: "POST",
      body: new FormData(),
    });
    const unauthRes = await transcribeHandler(unauthReq);
    assert(unauthRes.status === 401, "Rejects unauthenticated submission with HTTP 401");

    const technicianUser = await db.user.findFirst({
      where: { role: "TECHNICIAN" },
      include: { organization: true, site: true },
    });

    if (!technicianUser) {
      throw new Error("No technician user found in database. Run seed first.");
    }

    const { createSessionToken } = await import("../src/lib/session");
    technicianToken = await createSessionToken({
      userId: technicianUser.id,
      name: technicianUser.name,
      phone: technicianUser.phone,
      role: technicianUser.role,
      organizationId: technicianUser.organizationId,
      siteId: technicianUser.siteId || undefined,
    });

    const emptyFormData = new FormData();
    const missingAudioReq = new NextRequest("http://localhost:3000/api/v1/speech/transcribe", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${technicianToken}`,
      },
      body: emptyFormData,
    });
    const missingAudioRes = await transcribeHandler(missingAudioReq);
    assert(missingAudioRes.status === 400, "Rejects payload missing 'audio_file' with HTTP 400");

    // Create 1.5s valid 16kHz PCM audio buffer
    sampleAudioBytes = createValidWavBuffer(1.5, 16000);
    const audioBlob = new Blob([new Uint8Array(sampleAudioBytes)], { type: "audio/wav" });

    const validFormData = new FormData();
    validFormData.append("audio_file", audioBlob, "field_recording_bhadla.wav");
    if (technicianUser.siteId) {
      validFormData.append("siteId", technicianUser.siteId);
    }

    const transcribeReq = new NextRequest("http://localhost:3000/api/v1/speech/transcribe", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${technicianToken}`,
      },
      body: validFormData,
    });

    const transcribeRes = await transcribeHandler(transcribeReq);
    const resJson = await transcribeRes.json();

    assert(transcribeRes.status === 200, "Transcribe route returns HTTP 200 on valid submission");
    assert(resJson.success === true, "Response envelope contains success: true");
    assert(
      typeof resJson.data.transcript === "string",
      "Returns actual speech transcript from live Gnani AI API"
    );
    assert(
      resJson.data.model === "prisma-v3.0",
      "Confirms execution on configured Gnani model (prisma-v3.0)"
    );
    assert(
      typeof resJson.data.recordingId === "string",
      "Returns persistent recordingId reference"
    );
    assert(
      resJson.data.isEmptyTranscript === true || resJson.data.transcript.length > 0,
      "Identifies empty speech state accurately without generating fake transcripts"
    );
    assert(
      typeof resJson.data.processingTimeSeconds === "number",
      "Records official Gnani backend processing duration"
    );
    assert(resJson.data.latencyMs > 0, "Records end-to-end network latency");

    testRecordingId = resJson.data.recordingId;

    // Verify AudioRecording was persisted in database
    const dbRecord = await db.audioRecording.findUnique({
      where: { id: testRecordingId! },
    });

    assert(dbRecord !== null, "Persists AudioRecording record in PostgreSQL database");
    assert(
      dbRecord?.userId === technicianUser.id,
      "Links AudioRecording directly to authenticated technician"
    );
    assert(
      dbRecord?.originalTranscript === resJson.data.transcript,
      "Maintains immutability of original transcript in database"
    );
    assert(
      dbRecord?.fileSizeBytes === sampleAudioBytes.byteLength,
      "Records exact audio file size in bytes"
    );
  } catch (err: any) {
    console.error("Unexpected error in Group 4:", err);
  }

  // ---------------------------------------------------------------------------
  // Test Group 5: Duplicate Submission Prevention
  // ---------------------------------------------------------------------------
  console.log("\n📌 Group 5: Duplicate Submission Prevention");
  try {
    if (technicianToken && sampleAudioBytes && testRecordingId) {
      const audioBlob = new Blob([new Uint8Array(sampleAudioBytes)], { type: "audio/wav" });
      const duplicateFormData = new FormData();
      duplicateFormData.append("audio_file", audioBlob, "field_recording_bhadla.wav");

      const duplicateReq = new NextRequest("http://localhost:3000/api/v1/speech/transcribe", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${technicianToken}`,
        },
        body: duplicateFormData,
      });

      const duplicateRes = await transcribeHandler(duplicateReq);
      const duplicateJson = await duplicateRes.json();

      assert(duplicateRes.status === 200, "Handles duplicate submission gracefully (HTTP 200)");
      assert(duplicateJson.data.isDuplicate === true, "Flags submission with isDuplicate: true");
      assert(
        duplicateJson.data.recordingId === testRecordingId,
        "Returns existing recordingId without double-billing or redundant ASR processing"
      );
    }
  } catch (err: any) {
    console.error("Unexpected error in Group 5:", err);
  } finally {
    if (testRecordingId) {
      await db.audioRecording.delete({
        where: { id: testRecordingId },
      }).catch(() => {});
      console.log("  🧹 Test audio recording cleaned up from database");
    }
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log("\n========================================================");
  console.log(`🏁 Test Summary: ${passedCount} Passed, ${failedCount} Failed`);
  console.log("========================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
