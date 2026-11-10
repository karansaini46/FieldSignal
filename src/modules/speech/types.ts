/**
 * Gnani AI Speech-to-Text (ASR) Interface Contracts
 * Grounded in official Gnani.ai / Vachana ASR REST API specifications (v3).
 */

export type GnaniModelVersion = "prisma-v3.0" | "prisma-v2.5" | string;

export type GnaniOutputFormat = "transcribe" | "verbatim";

export interface GnaniConfig {
  /** Server-side API Key passed in the `X-API-Key-ID` header */
  apiKey: string;
  /** STT REST Endpoint (Default: https://api.vachana.ai/stt/v3) */
  endpoint: string;
  /** ASR Model Version (Default: prisma-v3.0) */
  modelVersion: GnaniModelVersion;
  /** Primary or fallback language codes (e.g. 'hi-IN', 'en-IN', 'indic-auto', 'hi-IN,en-IN') */
  languageCode: string;
  /** Output formatting: 'transcribe' (Inverse Text Normalization for numbers/units) or 'verbatim' */
  format: GnaniOutputFormat;
  /** Request timeout in milliseconds (Default: 8000ms) */
  timeoutMs: number;
  /** Maximum retry attempts for transient server/network errors (Default: 2) */
  maxRetries: number;
  /** Base backoff delay in milliseconds between retries (Default: 500ms) */
  retryDelayMs: number;
  /** Domain vocabulary terms injected into the acoustic biasing engine */
  vocabularyBoost?: string[];
  /** Allow simulated mock transcription during local development if API key is a placeholder */
  allowMockFallbackInDev?: boolean;
}

export interface TranscriptionRequest {
  /** Raw audio file bytes (Buffer, Uint8Array, or Blob) */
  audio: Buffer | Uint8Array | Blob;
  /** MIME type of the uploaded audio (e.g. 'audio/webm', 'audio/wav', 'audio/ogg', 'audio/mp4') */
  mimeType: string;
  /** Filename with extension (e.g. 'recording.webm') */
  fileName?: string;
  /** Override language code for this specific audio sample (e.g. 'hi-IN', 'en-IN') */
  languageCode?: string;
  /** Override ASR model version (e.g. 'prisma-v3.0') */
  model?: GnaniModelVersion;
  /** Override output formatting ('transcribe' | 'verbatim') */
  format?: GnaniOutputFormat;
  /** Optional custom vocabulary boost keywords */
  keyterms?: string[];
}

export interface TranscriptionResponse {
  /** Transcribed text output */
  transcript: string;
  /** Detected or processed language code (e.g. 'hi-IN', 'en-IN') */
  detectedLanguage: string;
  /** Model confidence score between 0.0 and 1.0 */
  confidence: number;
  /** Time spent by Gnani backend processing the audio (in seconds) */
  processingTimeSeconds?: number;
  /** Total client round-trip latency in milliseconds */
  latencyMs: number;
  /** ASR model that performed the transcription */
  model: string;
  /** Unique request trace ID returned by Gnani gateway */
  requestId?: string;
  /** Raw API response payload preserved for auditing */
  raw?: unknown;
}

export interface ISpeechService {
  /** Transcribes an audio sample using the configured ASR engine */
  transcribe(request: TranscriptionRequest): Promise<TranscriptionResponse>;
  /** Returns current model version in use */
  getModelVersion(): string;
  /** Returns a new service instance with an alternate model version (for zero-downtime version swaps) */
  withModel(modelVersion: GnaniModelVersion): ISpeechService;
}

/**
 * Gnani AI Text-to-Speech (TTS - Timbre) Interface Contracts
 * Grounded in official Gnani.ai / Vachana Timbre API specifications.
 */

export type GnaniTtsModelVersion = "timbre-v3.0" | "timbre-v2.5" | string;
export type GnaniTtsVoice =
  | "Shivani"
  | "Lakshmi"
  | "Kalpana"
  | "Chetana"
  | "Vasudha"
  | "Riyaa"
  | "Tarika"
  | "Avinash"
  | "Shubham"
  | "Prakash"
  | "Devansh"
  | "Yashraj"
  | string;

export type GnaniTtsLanguage =
  | "hi-IN"
  | "en-IN"
  | "hi-en"
  | "ta-IN"
  | "te-IN"
  | "kn-IN"
  | "mr-IN"
  | "bn-IN"
  | "gu-IN"
  | "pa-IN"
  | "ml-IN"
  | string;

export type GnaniTtsAudioFormat = "wav" | "mp3";

export interface GnaniTtsConfig {
  apiKey: string;
  endpoint: string;
  modelVersion: GnaniTtsModelVersion;
  defaultVoice: GnaniTtsVoice;
  defaultLanguage: GnaniTtsLanguage;
  defaultSpeed: number;
  timeoutMs: number;
  maxRetries: number;
  allowMockFallbackInDev: boolean;
}

export interface SynthesizeSpeechRequest {
  text: string;
  voice?: GnaniTtsVoice;
  language?: GnaniTtsLanguage;
  model?: GnaniTtsModelVersion;
  speed?: number;
  format?: GnaniTtsAudioFormat;
}

export interface SynthesizeSpeechResult {
  audioBuffer: Buffer;
  contentType: string;
  voice: string;
  model: string;
  language: string;
  speed: number;
  isMock: boolean;
  latencyMs: number;
}

export interface ITtsService {
  synthesize(request: SynthesizeSpeechRequest): Promise<SynthesizeSpeechResult>;
  getModelVersion(): string;
}

