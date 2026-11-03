/**
 * Speech Recognition module contracts (Gnani AI ASR integration).
 */

export interface SpeechRecognitionOptions {
  languageCode: "hi-IN" | "en-IN" | "hinglish";
  audioFormat: "webm" | "wav" | "ogg";
  sampleRate?: number;
}

export interface SpeechRecognitionResult {
  transcript: string;
  detectedLanguage: string;
  confidence: number;
  durationSeconds: number;
  latencyMs: number;
}

export interface ISpeechService {
  transcribeAudio(
    audioBuffer: Buffer,
    options?: Partial<SpeechRecognitionOptions>
  ): Promise<SpeechRecognitionResult>;
}
