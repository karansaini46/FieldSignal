/**
 * Speech Module Exports
 * Dedicated integration layer for Gnani AI / Vachana Speech-to-Text (ASR) service.
 */

export * from "./types";
export * from "./errors";
export * from "./audio-validator";
export * from "./hooks/use-audio-recorder";
export * from "./components/audio-visualizer";
export * from "./components/audio-recorder";
export {
  GnaniSpeechService,
  getGnaniSpeechService,
  DEFAULT_GNANI_CONFIG,
} from "./gnani-speech-service";

