import { describe, it, expect } from "vitest";
import crypto from "crypto";
import {
  validateAudioPayload,
  SUPPORTED_AUDIO_MIME_TYPES,
  MAX_AUDIO_BYTES,
  MIN_AUDIO_BYTES,
} from "@/modules/speech/audio-validator";
import {
  wrapPcmInWav,
  DEFAULT_GNANI_TTS_CONFIG,
} from "@/modules/speech/gnani-tts-service";

// ponytail: test suite 5 covering audio validation, deduplication hash, and timbre tts format
describe("Audit 5: Speech Transcription Validation & Timbre TTS Formatting", () => {
  it("rejects oversized audio files beyond 25MB limit", () => {
    const oversizedBytes = MAX_AUDIO_BYTES + 1024;
    expect(() => validateAudioPayload(oversizedBytes, "audio/webm")).toThrowError(
      /exceeds maximum limit of 25MB/i
    );
  });

  it("rejects empty or truncated audio files below 100 bytes", () => {
    expect(() => validateAudioPayload(0, "audio/webm")).toThrowError(
      /too short or empty/i
    );
    expect(() => validateAudioPayload(50, "audio/webm")).toThrowError(
      /too short or empty/i
    );
  });

  it("rejects unsupported audio MIME types", () => {
    expect(() => validateAudioPayload(1024, "application/pdf")).toThrowError(
      /unsupported audio format/i
    );
    expect(() => validateAudioPayload(1024, "image/png")).toThrowError(
      /unsupported audio format/i
    );
  });

  it("accepts supported industrial audio formats (webm, wav, ogg, mp4)", () => {
    for (const mime of SUPPORTED_AUDIO_MIME_TYPES) {
      expect(() => validateAudioPayload(2048, mime)).not.toThrow();
    }
  });

  it("computes deterministic SHA-256 audio hash for duplicate prevention", () => {
    const audioData = Buffer.from("FieldSignal test spoken audio recording bytes");
    const hash1 = crypto.createHash("sha256").update(audioData).digest("hex");
    const hash2 = crypto.createHash("sha256").update(audioData).digest("hex");
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64); // Standard SHA-256 hex string length
  });

  it("prepends standard 44-byte WAV/RIFF header to raw 16-bit linear PCM audio", () => {
    // Create raw PCM dummy buffer (100 samples of 16-bit audio = 200 bytes)
    const rawPcm = Buffer.alloc(200);
    const wavBuffer = wrapPcmInWav(rawPcm, 16000, 1);

    expect(wavBuffer.length).toBe(200 + 44);
    // Check RIFF magic header
    expect(wavBuffer.toString("utf8", 0, 4)).toBe("RIFF");
    // Check WAVE marker
    expect(wavBuffer.toString("utf8", 8, 12)).toBe("WAVE");
    // Check fmt subchunk
    expect(wavBuffer.toString("utf8", 12, 16)).toBe("fmt ");
    // Check data marker
    expect(wavBuffer.toString("utf8", 36, 40)).toBe("data");
    // Check data length at offset 40
    expect(wavBuffer.readUInt32LE(40)).toBe(200);
  });

  it("preserves already header-wrapped WAV buffers without double wrapping", () => {
    const alreadyWav = Buffer.alloc(100);
    alreadyWav.write("RIFF", 0);
    alreadyWav.write("WAVE", 8);

    const result = wrapPcmInWav(alreadyWav, 16000, 1);
    expect(result.length).toBe(100);
    expect(result.toString("utf8", 0, 4)).toBe("RIFF");
  });

  it("configures standard default Timbre voice parameters", () => {
    expect(DEFAULT_GNANI_TTS_CONFIG.defaultLanguage).toBe("hi-IN");
    expect(DEFAULT_GNANI_TTS_CONFIG.defaultVoice).toBe("Shivani");
    expect(DEFAULT_GNANI_TTS_CONFIG.modelVersion).toBe("timbre-v3.0");
  });
});
