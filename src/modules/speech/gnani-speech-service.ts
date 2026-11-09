import { env } from "@/lib/env";
import {
  GnaniConfig,
  TranscriptionRequest,
  TranscriptionResponse,
  ISpeechService,
  GnaniModelVersion,
} from "./types";
import {
  GnaniError,
  GnaniAuthenticationError,
  GnaniRateLimitError,
  GnaniAudioValidationError,
  GnaniTimeoutError,
  GnaniServiceUnavailableError,
} from "./errors";
import {
  validateAudioPayload,
  getAudioFileExtension,
  DEFAULT_SOLAR_VOCABULARY_BOOST,
} from "./audio-validator";

export const DEFAULT_GNANI_CONFIG: GnaniConfig = {
  apiKey: env.GNANI_AI_API_KEY || process.env.GNANI_AI_API_KEY || "gnani_dev_api_key_placeholder",
  endpoint: env.GNANI_AI_ENDPOINT || process.env.GNANI_AI_ENDPOINT || "https://api.vachana.ai/stt/v3",
  modelVersion: env.GNANI_AI_MODEL || process.env.GNANI_AI_MODEL || "prisma-v3.0",
  languageCode: env.GNANI_AI_LANGUAGE_CODE || process.env.GNANI_AI_LANGUAGE_CODE || "hi-IN,en-IN",
  format: "transcribe",
  timeoutMs: env.GNANI_AI_TIMEOUT_MS || Number(process.env.GNANI_AI_TIMEOUT_MS) || 8000,
  maxRetries: env.GNANI_AI_MAX_RETRIES ?? Number(process.env.GNANI_AI_MAX_RETRIES) ?? 2,
  retryDelayMs: 500,
  vocabularyBoost: DEFAULT_SOLAR_VOCABULARY_BOOST,
  allowMockFallbackInDev: env.GNANI_AI_MOCK_FALLBACK ?? (process.env.GNANI_AI_MOCK_FALLBACK !== "false"),
};

/**
 * Production-ready Gnani AI Speech-to-Text integration client.
 * Connects to the Vachana STT v3 REST API with automatic timeout,
 * exponential backoff retry policy, and model swappability.
 */
export class GnaniSpeechService implements ISpeechService {
  private readonly config: GnaniConfig;

  constructor(config?: Partial<GnaniConfig>) {
    this.config = {
      ...DEFAULT_GNANI_CONFIG,
      ...config,
      vocabularyBoost: [
        ...DEFAULT_SOLAR_VOCABULARY_BOOST,
        ...(config?.vocabularyBoost || []),
      ],
    };
  }

  /**
   * Returns active model version string (e.g. 'prisma-v3.0').
   */
  public getModelVersion(): string {
    return this.config.modelVersion;
  }

  /**
   * Returns a clone of this service with an alternate ASR model version.
   * Enables seamless, zero-downtime version swaps (e.g. prisma-v3.0 -> prisma-v4.0).
   */
  public withModel(modelVersion: GnaniModelVersion): GnaniSpeechService {
    return new GnaniSpeechService({
      ...this.config,
      modelVersion,
    });
  }

  /**
   * Transcribes an audio sample to text using the Gnani AI ASR REST gateway.
   */
  public async transcribe(request: TranscriptionRequest): Promise<TranscriptionResponse> {
    const startTime = Date.now();

    // 1. Audio size and MIME type validation
    const audioBytes =
      request.audio instanceof Blob
        ? request.audio.size
        : request.audio.byteLength;

    validateAudioPayload(audioBytes, request.mimeType);

    // 2. Check if local development mock fallback is active
    const isPlaceholderKey =
      !this.config.apiKey ||
      this.config.apiKey.includes("placeholder") ||
      this.config.apiKey === "test-key";

    if (this.config.allowMockFallbackInDev && isPlaceholderKey) {
      return this.generateSimulatedResponse(request, startTime);
    }

    // 3. Prepare FormData payload adhering to official Gnani REST API
    const extension = getAudioFileExtension(request.mimeType);
    const fileName = request.fileName || `field_recording.${extension}`;
    const selectedModel = request.model || this.config.modelVersion;
    const selectedLanguage = request.languageCode || this.config.languageCode;
    const selectedFormat = request.format || this.config.format;

    // Convert Buffer / Uint8Array to Blob for FormData
    let audioBlob: Blob;
    if (request.audio instanceof Blob) {
      audioBlob = request.audio;
    } else {
      const buffer = request.audio;
      audioBlob = new Blob([buffer as any], { type: request.mimeType });
    }

    const formData = new FormData();
    formData.append("audio_file", audioBlob, fileName);
    formData.append("language_code", selectedLanguage);
    formData.append("model", selectedModel);
    formData.append("format", selectedFormat);

    // Domain vocabulary boost
    const keyterms = [
      ...(this.config.vocabularyBoost || []),
      ...(request.keyterms || []),
    ];
    if (keyterms.length > 0) {
      formData.append("keyterms", keyterms.join(","));
    }

    // 4. Execute HTTP request with retry policy & timeout
    return this.executeWithRetry(formData, selectedModel, startTime);
  }

  /**
   * Executes HTTP POST against Gnani gateway with timeout and exponential backoff retry policy.
   */
  private async executeWithRetry(
    formData: FormData,
    model: string,
    startTime: number
  ): Promise<TranscriptionResponse> {
    let lastError: Error | null = null;
    const maxAttempts = 1 + Math.max(0, this.config.maxRetries);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => {
        controller.abort();
      }, this.config.timeoutMs);

      try {
        const response = await fetch(this.config.endpoint, {
          method: "POST",
          headers: {
            "X-API-Key-ID": this.config.apiKey,
          },
          body: formData,
          signal: controller.signal,
        });

        clearTimeout(timeoutHandle);

        const latencyMs = Date.now() - startTime;

        // Process HTTP response
        if (!response.ok) {
          const errorBody = await this.safeParseJson(response);
          const error = this.mapHttpStatusToError(response.status, errorBody, response.headers);

          if (error.isRetryable && attempt < maxAttempts) {
            lastError = error;
            await this.delayBackoff(attempt, response.headers);
            continue;
          }

          throw error;
        }

        const data = await response.json();
        const rawTranscript = typeof data.transcript === "string" ? data.transcript : (data.text || "");
        const transcript = rawTranscript.trim();

        return {
          transcript,
          detectedLanguage:
            data.detected_language_code ||
            data.language ||
            (this.config.languageCode ? this.config.languageCode.split(",")[0] : "hi-IN") ||
            "hi-IN",
          confidence:
            typeof data.confidence === "number"
              ? data.confidence
              : transcript.length > 0
              ? 0.92
              : 0.0,
          processingTimeSeconds:
            typeof data.processing_time === "number"
              ? data.processing_time
              : typeof data.end_to_end_latency === "number"
              ? data.end_to_end_latency
              : latencyMs / 1000,
          latencyMs,
          model,
          requestId: data.request_id || response.headers.get("x-request-id") || undefined,
          raw: data,
        };
      } catch (err: unknown) {
        clearTimeout(timeoutHandle);

        if (err instanceof GnaniError && !err.isRetryable) {
          throw err;
        }

        // Abort error translates to timeout error
        if (err instanceof Error && err.name === "AbortError") {
          const timeoutErr = new GnaniTimeoutError(this.config.timeoutMs);
          if (attempt < maxAttempts) {
            lastError = timeoutErr;
            await this.delayBackoff(attempt);
            continue;
          }
          throw timeoutErr;
        }

        // Network / Socket errors
        const isNetworkErr =
          err instanceof TypeError ||
          (err instanceof Error && err.message.toLowerCase().includes("fetch failed"));

        if (isNetworkErr) {
          const netErr = new GnaniServiceUnavailableError(
            `Network failure communicating with Gnani AI: ${(err as Error).message}`,
            503
          );
          if (attempt < maxAttempts) {
            lastError = netErr;
            await this.delayBackoff(attempt);
            continue;
          }
          throw netErr;
        }

        if (err instanceof GnaniError) {
          lastError = err;
          if (err.isRetryable && attempt < maxAttempts) {
            await this.delayBackoff(attempt);
            continue;
          }
        }

        throw err;
      }
    }

    throw lastError || new GnaniServiceUnavailableError("Failed to transcribe after retries.");
  }

  /**
   * Maps official Gnani HTTP status codes to strongly-typed GnaniError instances.
   */
  private mapHttpStatusToError(
    statusCode: number,
    body: any,
    headers: Headers
  ): GnaniError {
    const message =
      body?.message || body?.error?.message || body?.detail || `Gnani AI HTTP ${statusCode} error`;

    switch (statusCode) {
      case 401:
        return new GnaniAuthenticationError(message, body);
      case 402:
        return new GnaniError(
          `Gnani AI account credit balance exhausted: ${message}`,
          402,
          "FORBIDDEN",
          false,
          body
        );
      case 403:
        return new GnaniError(
          `Gnani AI API key lacks permission scope for STT: ${message}`,
          403,
          "FORBIDDEN",
          false,
          body
        );
      case 429: {
        const retryAfterHeader = headers.get("retry-after");
        const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 2;
        return new GnaniRateLimitError(message, retryAfter, body);
      }
      case 400:
      case 413:
      case 422:
        return new GnaniAudioValidationError(message, body);
      case 504:
        return new GnaniTimeoutError(this.config.timeoutMs);
      case 500:
      case 502:
      case 503:
      default:
        return new GnaniServiceUnavailableError(message, statusCode, body);
    }
  }

  /**
   * Exponential backoff with random jitter.
   */
  private async delayBackoff(attempt: number, headers?: Headers): Promise<void> {
    const retryAfter = headers?.get("retry-after");
    let delayMs = this.config.retryDelayMs * Math.pow(2, attempt - 1);

    if (retryAfter) {
      const parsedSeconds = parseInt(retryAfter, 10);
      if (!isNaN(parsedSeconds) && parsedSeconds > 0) {
        delayMs = parsedSeconds * 1000;
      }
    }

    // Add 10-50ms random jitter to avoid thundering herd
    const jitter = Math.floor(Math.random() * 50);
    await new Promise((resolve) => setTimeout(resolve, delayMs + jitter));
  }

  private async safeParseJson(response: Response): Promise<any> {
    try {
      return await response.json();
    } catch {
      return { raw: await response.text().catch(() => "") };
    }
  }

  /**
   * Generates a realistic simulated transcription for local development and testing
   * when no live Gnani AI API key is provisioned.
   */
  private generateSimulatedResponse(
    request: TranscriptionRequest,
    startTime: number
  ): TranscriptionResponse {
    const latencyMs = Math.min(Date.now() - startTime + 80, 250);

    return {
      transcript:
        "Bhadla Block A Central Inverter 1 mein IGBT over-temperature alarm trip hua hai. Cooling blower fan seized lag raha hai.",
      detectedLanguage: request.languageCode?.split(",")[0] || "hi-IN",
      confidence: 0.94,
      processingTimeSeconds: 0.42,
      latencyMs,
      model: request.model || this.config.modelVersion,
      requestId: `sim-${crypto.randomUUID()}`,
      raw: { simulated: true },
    };
  }
}

/**
 * Default singleton instance factory.
 */
let defaultServiceInstance: GnaniSpeechService | null = null;

export function getGnaniSpeechService(config?: Partial<GnaniConfig>): GnaniSpeechService {
  if (config) {
    return new GnaniSpeechService(config);
  }
  if (!defaultServiceInstance) {
    defaultServiceInstance = new GnaniSpeechService();
  }
  return defaultServiceInstance;
}
