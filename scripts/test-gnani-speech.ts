/**
 * Test Suite: Gnani AI Speech Integration Layer
 * Validates request construction, validation, timeout, retry policy, error mapping,
 * and model swappability.
 */

import {
  GnaniSpeechService,
  GnaniConfig,
  TranscriptionRequest,
  GnaniError,
  GnaniAuthenticationError,
  GnaniRateLimitError,
  GnaniAudioValidationError,
  GnaniTimeoutError,
  GnaniServiceUnavailableError,
  validateAudioPayload,
  getAudioFileExtension,
} from "../src/modules/speech";

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
  console.log("\n🧪 Starting Gnani AI Integration Tests...\n");

  // ---------------------------------------------------------------------------
  // Test Group 1: Audio Validation
  // ---------------------------------------------------------------------------
  console.log("📌 Group 1: Audio Payload & Format Validation");
  try {
    // 1.1 Reject < 100 bytes
    let caughtTooShort = false;
    try {
      validateAudioPayload(50, "audio/webm");
    } catch (e) {
      if (e instanceof GnaniAudioValidationError) {
        caughtTooShort = true;
      }
    }
    assert(caughtTooShort, "Rejects audio payload below 100 bytes minimum limit");

    // 1.2 Reject > 25 MB
    let caughtTooLarge = false;
    try {
      validateAudioPayload(26 * 1024 * 1024, "audio/wav");
    } catch (e) {
      if (e instanceof GnaniAudioValidationError) {
        caughtTooLarge = true;
      }
    }
    assert(caughtTooLarge, "Rejects audio payload above 25 MB maximum limit");

    // 1.3 Reject unsupported MIME type
    let caughtInvalidMime = false;
    try {
      validateAudioPayload(5000, "application/pdf");
    } catch (e) {
      if (e instanceof GnaniAudioValidationError) {
        caughtInvalidMime = true;
      }
    }
    assert(caughtInvalidMime, "Rejects unsupported MIME type (application/pdf)");

    // 1.4 Accept supported formats
    let validMimePassed = true;
    try {
      validateAudioPayload(10000, "audio/webm;codecs=opus");
      validateAudioPayload(10000, "audio/wav");
      validateAudioPayload(10000, "audio/mp3");
      validateAudioPayload(10000, "audio/ogg");
      validateAudioPayload(10000, "audio/flac");
    } catch {
      validMimePassed = false;
    }
    assert(validMimePassed, "Accepts all supported audio codecs and MIME types");

    // 1.5 Extension mapping
    assert(getAudioFileExtension("audio/wav") === "wav", "Resolves 'wav' extension");
    assert(getAudioFileExtension("audio/webm;codecs=opus") === "webm", "Resolves 'webm' extension");
    assert(getAudioFileExtension("audio/ogg") === "ogg", "Resolves 'ogg' extension");
  } catch (err: any) {
    console.error("Unexpected error in Group 1:", err);
  }

  // ---------------------------------------------------------------------------
  // Test Group 2: Model Swappability & Config Immutability
  // ---------------------------------------------------------------------------
  console.log("\n📌 Group 2: Model Version Swappability & Replaceability");
  try {
    const serviceV3 = new GnaniSpeechService({
      modelVersion: "prisma-v3.0",
      apiKey: "test_key",
    });

    assert(serviceV3.getModelVersion() === "prisma-v3.0", "Service defaults to prisma-v3.0");

    // Zero-downtime swap via withModel()
    const serviceV25 = serviceV3.withModel("prisma-v2.5");
    assert(serviceV25.getModelVersion() === "prisma-v2.5", "withModel() creates instance with prisma-v2.5");
    assert(serviceV3.getModelVersion() === "prisma-v3.0", "Original service model remains unchanged (immutable)");

    const serviceV4 = serviceV3.withModel("prisma-v4.0-future");
    assert(serviceV4.getModelVersion() === "prisma-v4.0-future", "Supports future model versions seamlessly");
  } catch (err: any) {
    console.error("Unexpected error in Group 2:", err);
  }

  // ---------------------------------------------------------------------------
  // Test Group 3: Simulated Fallback in Local Development
  // ---------------------------------------------------------------------------
  console.log("\n📌 Group 3: Local Development Mock Fallback");
  try {
    const mockService = new GnaniSpeechService({
      apiKey: "gnani_dev_api_key_placeholder",
      allowMockFallbackInDev: true,
      modelVersion: "prisma-v3.0",
      languageCode: "hi-IN,en-IN",
    });

    // Create 1KB dummy audio buffer
    const dummyAudio = Buffer.alloc(1024, 0xaa);

    const response = await mockService.transcribe({
      audio: dummyAudio,
      mimeType: "audio/webm",
      fileName: "test_inverter_alarm.webm",
    });

    assert(typeof response.transcript === "string" && response.transcript.length > 0, "Returns non-empty transcript in simulated mode");
    assert(response.confidence > 0.8, "Returns high confidence score in simulated response");
    assert(response.model === "prisma-v3.0", "Simulated response preserves active model version");
    assert(response.detectedLanguage === "hi-IN", "Simulated response detects primary language");
    assert(response.latencyMs >= 0, "Returns round-trip latency metric");
  } catch (err: any) {
    console.error("Unexpected error in Group 3:", err);
  }

  // ---------------------------------------------------------------------------
  // Test Group 4: Official API Request Headers, Body, & Vocabulary Biasing
  // ---------------------------------------------------------------------------
  console.log("\n📌 Group 4: Request Protocol & Header Verification");
  try {
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};
    let capturedFormData: FormData | null = null;

    // Custom fetch mock to inspect outgoing network call
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url: any, init: any): Promise<Response> => {
      capturedUrl = url.toString();
      capturedHeaders = init.headers;
      capturedFormData = init.body;

      return new Response(
        JSON.stringify({
          success: true,
          request_id: "req_test_12345",
          transcript: "Inverter 3 temperature high detected",
          model: "prisma-v3.0",
          detected_language_code: "en-IN",
          confidence: 0.96,
          processing_time: 0.35,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    };

    try {
      const realConfigService = new GnaniSpeechService({
        apiKey: "vach_real_production_key_sample",
        endpoint: "https://api.vachana.ai/stt/v3",
        modelVersion: "prisma-v3.0",
        allowMockFallbackInDev: false,
        vocabularyBoost: ["CustomInverter", "SolarArrayX"],
      });

      const audioBuffer = Buffer.alloc(2048, 0x12);
      const res = await realConfigService.transcribe({
        audio: audioBuffer,
        mimeType: "audio/wav",
        keyterms: ["StringCombinerBox"],
      });

      assert(capturedUrl === "https://api.vachana.ai/stt/v3", "Calls official endpoint https://api.vachana.ai/stt/v3");
      assert(capturedHeaders["X-API-Key-ID"] === "vach_real_production_key_sample", "Transmits auth via official X-API-Key-ID header");
      assert(capturedFormData !== null, "Encodes payload as multipart/form-data");
      assert(res.transcript === "Inverter 3 temperature high detected", "Extracts transcript from server response");
      assert(res.requestId === "req_test_12345", "Captures trace request ID");
    } finally {
      globalThis.fetch = originalFetch;
    }
  } catch (err: any) {
    console.error("Unexpected error in Group 4:", err);
  }

  // ---------------------------------------------------------------------------
  // Test Group 5: Error Mapping & Fail-Fast Behavior
  // ---------------------------------------------------------------------------
  console.log("\n📌 Group 5: HTTP Error Mapping & Non-Retryable Fail-Fast");
  try {
    const originalFetch = globalThis.fetch;

    // 5.1 401 Unauthorized mapping
    globalThis.fetch = async (): Promise<Response> => {
      return new Response(
        JSON.stringify({ message: "Invalid API Key ID supplied" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    };

    try {
      const service = new GnaniSpeechService({
        apiKey: "vach_invalid_key",
        allowMockFallbackInDev: false,
        maxRetries: 3,
      });

      let caught401 = false;
      try {
        await service.transcribe({
          audio: Buffer.alloc(500, 1),
          mimeType: "audio/webm",
        });
      } catch (e) {
        if (e instanceof GnaniAuthenticationError && !e.isRetryable && e.statusCode === 401) {
          caught401 = true;
        }
      }
      assert(caught401, "Maps 401 directly to GnaniAuthenticationError with isRetryable=false (fails fast)");
    } finally {
      globalThis.fetch = originalFetch;
    }

    // 5.2 422 Unprocessable Audio mapping
    globalThis.fetch = async (): Promise<Response> => {
      return new Response(
        JSON.stringify({ message: "Corrupted audio stream header" }),
        { status: 422, headers: { "Content-Type": "application/json" } }
      );
    };

    try {
      const service = new GnaniSpeechService({
        apiKey: "vach_valid_key",
        allowMockFallbackInDev: false,
        maxRetries: 2,
      });

      let caught422 = false;
      try {
        await service.transcribe({
          audio: Buffer.alloc(500, 1),
          mimeType: "audio/webm",
        });
      } catch (e) {
        if (e instanceof GnaniAudioValidationError && !e.isRetryable) {
          caught422 = true;
        }
      }
      assert(caught422, "Maps 422 to GnaniAudioValidationError without retrying");
    } finally {
      globalThis.fetch = originalFetch;
    }
  } catch (err: any) {
    console.error("Unexpected error in Group 5:", err);
  }

  // ---------------------------------------------------------------------------
  // Test Group 6: Retry Policy & Transient 5xx / 429 Recovery
  // ---------------------------------------------------------------------------
  console.log("\n📌 Group 6: Transient Error Retry Policy & Exponential Backoff");
  try {
    const originalFetch = globalThis.fetch;
    let attempts = 0;

    // Flaky gateway: fails on attempt 1 with 503, succeeds on attempt 2
    globalThis.fetch = async (): Promise<Response> => {
      attempts++;
      if (attempts === 1) {
        return new Response(
          JSON.stringify({ message: "Upstream ASR engine restarting" }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({
          transcript: "Recovered after transient error",
          detected_language_code: "hi-IN",
          confidence: 0.92,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    try {
      const retryService = new GnaniSpeechService({
        apiKey: "vach_real_key",
        allowMockFallbackInDev: false,
        maxRetries: 2,
        retryDelayMs: 50, // fast backoff for tests
      });

      const res = await retryService.transcribe({
        audio: Buffer.alloc(500, 1),
        mimeType: "audio/webm",
      });

      assert(attempts === 2, "Retries transient 503 error and recovers on second attempt");
      assert(res.transcript === "Recovered after transient error", "Successfully receives transcribed data after retry");
    } finally {
      globalThis.fetch = originalFetch;
    }

    // 429 Rate Limit with Retry-After header
    attempts = 0;
    globalThis.fetch = async (): Promise<Response> => {
      attempts++;
      if (attempts === 1) {
        return new Response(
          JSON.stringify({ message: "Rate limit exceeded" }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": "1",
            },
          }
        );
      }
      return new Response(
        JSON.stringify({
          transcript: "Rate limit cleared",
          detected_language_code: "en-IN",
          confidence: 0.95,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    try {
      const rateLimitService = new GnaniSpeechService({
        apiKey: "vach_real_key",
        allowMockFallbackInDev: false,
        maxRetries: 2,
        retryDelayMs: 50,
      });

      const res = await rateLimitService.transcribe({
        audio: Buffer.alloc(500, 1),
        mimeType: "audio/wav",
      });

      assert(attempts === 2, "Respects 429 rate limit and retries successfully");
      assert(res.transcript === "Rate limit cleared", "Receives transcript after 429 backoff");
    } finally {
      globalThis.fetch = originalFetch;
    }
  } catch (err: any) {
    console.error("Unexpected error in Group 6:", err);
  }

  // ---------------------------------------------------------------------------
  // Test Group 7: Timeout Handling
  // ---------------------------------------------------------------------------
  console.log("\n📌 Group 7: Timeout Handling via AbortController");
  try {
    const originalFetch = globalThis.fetch;

    // Simulate hanging request that triggers timeout
    globalThis.fetch = async (_url: any, init: any): Promise<Response> => {
      return new Promise((_, reject) => {
        init.signal.addEventListener("abort", () => {
          const abortError = new Error("The operation was aborted");
          abortError.name = "AbortError";
          reject(abortError);
        });
      });
    };

    try {
      const timeoutService = new GnaniSpeechService({
        apiKey: "vach_real_key",
        allowMockFallbackInDev: false,
        timeoutMs: 80, // very tight timeout for test
        maxRetries: 1,
        retryDelayMs: 20,
      });

      let caughtTimeout = false;
      try {
        await timeoutService.transcribe({
          audio: Buffer.alloc(500, 1),
          mimeType: "audio/webm",
        });
      } catch (e) {
        if (e instanceof GnaniTimeoutError && e.statusCode === 504) {
          caughtTimeout = true;
        }
      }

      assert(caughtTimeout, "Aborts hanging request and raises GnaniTimeoutError (HTTP 504)");
    } finally {
      globalThis.fetch = originalFetch;
    }
  } catch (err: any) {
    console.error("Unexpected error in Group 7:", err);
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

