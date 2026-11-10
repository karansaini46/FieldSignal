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
export * from "./components/tts-player";
export {
  GnaniSpeechService,
  getGnaniSpeechService,
  DEFAULT_GNANI_CONFIG,
} from "./gnani-speech-service";
export {
  GnaniTimbreTtsService,
  getGnaniTtsService,
  DEFAULT_GNANI_TTS_CONFIG,
  wrapPcmInWav,
} from "./gnani-tts-service";

