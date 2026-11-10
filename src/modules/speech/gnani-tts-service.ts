/**
 * Gnani AI Timbre Text-to-Speech (TTS) Service
 *
 * Implements server-side synthesis using Gnani AI Timbre neural voice models (Timbre v3.0).
 * Supports multilingual Indian languages & Indian English (hi-IN, en-IN, hi-en, etc.),
 * configurable voices (Shivani, Avinash, etc.), inline audio tags, and seamless fallback.
 */

import { env } from "@/lib/env";
import {
  GnaniTtsConfig,
  GnaniTtsModelVersion,
  GnaniTtsVoice,
  GnaniTtsLanguage,
  SynthesizeSpeechRequest,
  SynthesizeSpeechResult,
  ITtsService,
} from "./types";
import {
  GnaniError,
  GnaniAuthenticationError,
  GnaniRateLimitError,
  GnaniTimeoutError,
  GnaniServiceUnavailableError,
} from "./errors";

export const DEFAULT_GNANI_TTS_CONFIG: GnaniTtsConfig = {
  apiKey: env.GNANI_AI_API_KEY,
  endpoint: env.GNANI_TTS_ENDPOINT,
  modelVersion: (env.GNANI_TTS_MODEL as GnaniTtsModelVersion) || "timbre-v3.0",
  defaultVoice: (env.GNANI_TTS_VOICE as GnaniTtsVoice) || "Shivani",
  defaultLanguage: (env.GNANI_TTS_LANGUAGE as GnaniTtsLanguage) || "hi-IN",
  defaultSpeed: env.GNANI_TTS_SPEED || 1.0,
  timeoutMs: 8000,
  maxRetries: 2,
  allowMockFallbackInDev: env.GNANI_AI_MOCK_FALLBACK,
};

// ponytail: Native 16-bit PCM WAV synthesizer for dev/offline fallback; upgrade path: upstream cloud cache / CDN bucket for high-traffic pre-rendered audio.
export function wrapPcmInWav(pcmBuffer: Buffer, sampleRate = 16000, numChannels = 1, bitsPerSample = 16): Buffer {
  if (pcmBuffer.length >= 4 && pcmBuffer.subarray(0, 4).toString("ascii") === "RIFF") {
    return pcmBuffer; // Already has standard WAV header
  }

  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);

  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  header.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  header.writeUInt16LE(bitsPerSample, 34);

  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

function createMockWavBuffer(text: string, speed = 1.0): Buffer {
  const sampleRate = 16000;
  // Estimate duration: ~15 characters per second at 1.0x speed, min 1s, max 8s
  const estimatedSeconds = Math.max(1, Math.min(8, (text.length / 15) / speed));
  const numSamples = Math.floor(sampleRate * estimatedSeconds);
  const dataSize = numSamples * 2; // 16-bit mono = 2 bytes per sample
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF Chunk Descriptor
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);

  // "fmt " Sub-chunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(1, 22);  // NumChannels (1 = Mono)
  buffer.writeUInt32LE(sampleRate, 24); // SampleRate
  buffer.writeUInt32LE(sampleRate * 2, 28); // ByteRate
  buffer.writeUInt16LE(2, 32);  // BlockAlign
  buffer.writeUInt16LE(16, 34); // BitsPerSample

  // "data" Sub-chunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Generate gentle synthetic audio pulse (melodic 440Hz tone modulated for natural sensation)
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Harmonic envelope fading gently in and out
    const envelope = Math.min(1, Math.min(t * 10, (estimatedSeconds - t) * 5));
    const sample = Math.sin(2 * Math.PI * 440 * t) * 0.15 * envelope * 32767;
    buffer.writeInt16LE(Math.floor(sample), 44 + i * 2);
  }

  return buffer;
}

export class GnaniTimbreTtsService implements ITtsService {
  private readonly config: GnaniTtsConfig;

  constructor(config?: Partial<GnaniTtsConfig>) {
    this.config = {
      ...DEFAULT_GNANI_TTS_CONFIG,
      ...config,
    };
  }

  public getModelVersion(): string {
    return this.config.modelVersion;
  }

  /**
   * Synthesizes text into spoken audio using Gnani AI Timbre v3.0.
   * If offline, in test mode, or API unavailable, gracefully returns simulated synthetic audio.
   */
  public async synthesize(request: SynthesizeSpeechRequest): Promise<SynthesizeSpeechResult> {
    const startTime = Date.now();
    const cleanText = request.text.trim();

    if (!cleanText) {
      throw new GnaniError("Cannot synthesize empty text prompt", 400);
    }

    if (cleanText.length > 2000) {
      throw new GnaniError("Text exceeds maximum synthesis length of 2000 characters", 400);
    }

    const voice = request.voice || this.config.defaultVoice;
    const model = request.model || this.config.modelVersion;
    const language = request.language || this.config.defaultLanguage;
    const speed = request.speed ?? this.config.defaultSpeed;
    const format = request.format || "wav";

    // If mock fallback enabled and API key is unconfigured or a placeholder
    const isPlaceholderKey =
      !this.config.apiKey ||
      this.config.apiKey.includes("placeholder") ||
      this.config.apiKey.startsWith("mock_");

    if (isPlaceholderKey && this.config.allowMockFallbackInDev) {
      const mockWav = createMockWavBuffer(cleanText, speed);
      return {
        audioBuffer: mockWav,
        contentType: "audio/wav",
        voice,
        model,
        language,
        speed,
        isMock: true,
        latencyMs: Date.now() - startTime,
      };
    }

    // Prepare JSON payload adhering to Gnani AI Timbre v3.0 REST specification
    const payload = {
      text: cleanText,
      model,
      voice,
      language,
      speed,
      audio_format: format,
      sampling_rate: 16000,
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

        const response = await fetch(this.config.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key-ID": this.config.apiKey,
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const status = response.status;
          let errorBody: any = null;
          try {
            errorBody = await response.json();
          } catch {
            // Non-JSON error body
          }

          if (status === 401 || status === 403) {
            throw new GnaniAuthenticationError("Gnani AI Timbre authentication failed", errorBody);
          }
          if (status === 429) {
            throw new GnaniRateLimitError("Gnani AI Timbre rate limit exceeded", 5, errorBody);
          }
          throw new GnaniServiceUnavailableError(`Gnani AI Timbre HTTP error ${status}`, status, errorBody);
        }

        const contentType = response.headers.get("content-type") || "";

        // Case A: Binary Audio Stream (audio/wav, audio/mpeg, application/octet-stream)
        if (contentType.includes("audio") || contentType.includes("octet-stream")) {
          const arrayBuffer = await response.arrayBuffer();
          const rawBuf = Buffer.from(arrayBuffer);
          const audioBuffer = format === "wav" ? wrapPcmInWav(rawBuf) : rawBuf;
          return {
            audioBuffer,
            contentType: contentType.includes("mpeg") ? "audio/mpeg" : "audio/wav",
            voice,
            model,
            language,
            speed,
            isMock: false,
            latencyMs: Date.now() - startTime,
          };
        }

        // Case B: JSON envelope with base64 audio payload
        const jsonBody = await response.json();
        const base64Data =
          jsonBody.audio_content ||
          jsonBody.audio_base64 ||
          jsonBody.data?.audio ||
          jsonBody.audio;

        if (base64Data && typeof base64Data === "string") {
          const rawBuf = Buffer.from(base64Data, "base64");
          const audioBuffer = format === "wav" ? wrapPcmInWav(rawBuf) : rawBuf;
          return {
            audioBuffer,
            contentType: format === "mp3" ? "audio/mpeg" : "audio/wav",
            voice,
            model,
            language,
            speed,
            isMock: false,
            latencyMs: Date.now() - startTime,
          };
        }

        throw new GnaniError("Gnani Timbre response did not contain audio payload", 502);
      } catch (err: unknown) {
        lastError = err as Error;

        if (err instanceof GnaniAuthenticationError) {
          break; // Do not retry authentication failures
        }

        if (attempt < this.config.maxRetries) {
          // Exponential backoff delay
          await new Promise((r) => setTimeout(r, 300 * Math.pow(2, attempt)));
        }
      }
    }

    // Graceful fallback to synthetic mock audio if network / external service fails and mock fallback is allowed
    if (this.config.allowMockFallbackInDev) {
      console.warn(
        `[GnaniTimbreTtsService] External TTS call failed (${lastError?.message}), serving graceful mock audio fallback.`
      );
      const mockWav = createMockWavBuffer(cleanText, speed);
      return {
        audioBuffer: mockWav,
        contentType: "audio/wav",
        voice,
        model,
        language,
        speed,
        isMock: true,
        latencyMs: Date.now() - startTime,
      };
    }

    throw lastError || new GnaniServiceUnavailableError("Failed to synthesize speech via Gnani Timbre");
  }
}

// Singleton accessor
let defaultTtsServiceInstance: GnaniTimbreTtsService | null = null;

export function getGnaniTtsService(config?: Partial<GnaniTtsConfig>): GnaniTimbreTtsService {
  if (config) {
    return new GnaniTimbreTtsService(config);
  }
  if (!defaultTtsServiceInstance) {
    defaultTtsServiceInstance = new GnaniTimbreTtsService();
  }
  return defaultTtsServiceInstance;
}
