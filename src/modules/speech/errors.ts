import { AppError } from "@/lib/errors";

export class GnaniError extends AppError {
  public readonly isRetryable: boolean;
  public readonly rawResponse?: unknown;

  constructor(
    message: string,
    statusCode = 502,
    code:
      | "BAD_REQUEST"
      | "UNAUTHORIZED"
      | "FORBIDDEN"
      | "RATE_LIMIT_EXCEEDED"
      | "SPEECH_PROCESSING_ERROR"
      | "INTERNAL_SERVER_ERROR" = "SPEECH_PROCESSING_ERROR",
    isRetryable = false,
    rawResponse?: unknown
  ) {
    super(message, statusCode, code, rawResponse);
    this.name = "GnaniError";
    this.isRetryable = isRetryable;
    this.rawResponse = rawResponse;
  }
}

export class GnaniAuthenticationError extends GnaniError {
  constructor(message = "Invalid or missing Gnani AI API key (X-API-Key-ID)", rawResponse?: unknown) {
    super(message, 401, "UNAUTHORIZED", false, rawResponse);
    this.name = "GnaniAuthenticationError";
  }
}

export class GnaniRateLimitError extends GnaniError {
  public readonly retryAfterSeconds?: number;

  constructor(
    message = "Gnani AI ASR rate limit reached. Please retry after a brief delay.",
    retryAfterSeconds?: number,
    rawResponse?: unknown
  ) {
    super(message, 429, "RATE_LIMIT_EXCEEDED", true, rawResponse);
    this.name = "GnaniRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class GnaniAudioValidationError extends GnaniError {
  constructor(message: string, rawResponse?: unknown) {
    super(message, 422, "BAD_REQUEST", false, rawResponse);
    this.name = "GnaniAudioValidationError";
  }
}

export class GnaniTimeoutError extends GnaniError {
  constructor(timeoutMs: number) {
    super(
      `Gnani AI ASR request timed out after ${timeoutMs}ms. Check network connectivity or audio length.`,
      504,
      "SPEECH_PROCESSING_ERROR",
      true
    );
    this.name = "GnaniTimeoutError";
  }
}

export class GnaniServiceUnavailableError extends GnaniError {
  constructor(
    message = "Gnani AI ASR service is temporarily unavailable or returned a 5xx gateway error.",
    statusCode = 503,
    rawResponse?: unknown
  ) {
    super(message, statusCode, "SPEECH_PROCESSING_ERROR", true, rawResponse);
    this.name = "GnaniServiceUnavailableError";
  }
}

