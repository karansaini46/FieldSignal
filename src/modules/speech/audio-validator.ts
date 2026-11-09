import { GnaniAudioValidationError } from "./errors";

export const SUPPORTED_AUDIO_MIME_TYPES = [
  "audio/webm",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/mp3",
  "audio/mpeg",
  "audio/ogg",
  "audio/flac",
  "audio/aac",
  "audio/m4a",
  "audio/mp4",
] as const;

export const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB
export const MIN_AUDIO_BYTES = 100; // 100 Bytes

/**
 * Validates audio payload size and MIME type before sending to Gnani AI gateway.
 */
export function validateAudioPayload(audioLengthBytes: number, mimeType: string): void {
  if (audioLengthBytes < MIN_AUDIO_BYTES) {
    throw new GnaniAudioValidationError(
      `Audio payload is too short or empty (${audioLengthBytes} bytes). Please record a longer voice note.`
    );
  }

  if (audioLengthBytes > MAX_AUDIO_BYTES) {
    throw new GnaniAudioValidationError(
      `Audio payload (${(audioLengthBytes / 1024 / 1024).toFixed(1)}MB) exceeds maximum limit of 25MB.`
    );
  }

  const normalizedMime = mimeType.toLowerCase().split(";")[0]?.trim() || "";
  const isSupported = SUPPORTED_AUDIO_MIME_TYPES.some((t) => t === normalizedMime);

  if (!isSupported) {
    throw new GnaniAudioValidationError(
      `Unsupported audio format '${mimeType}'. Supported formats: WebM, WAV, MP3, OGG, FLAC, AAC, M4A.`
    );
  }
}

export function getAudioFileExtension(mimeType: string): string {
  const normalized = mimeType.toLowerCase().split(";")[0]?.trim() || "";
  switch (normalized) {
    case "audio/wav":
    case "audio/x-wav":
    case "audio/wave":
      return "wav";
    case "audio/mp3":
    case "audio/mpeg":
      return "mp3";
    case "audio/ogg":
      return "ogg";
    case "audio/flac":
      return "flac";
    case "audio/aac":
      return "aac";
    case "audio/mp4":
      return "mp4";
    case "audio/m4a":
      return "m4a";
    case "audio/webm":
    default:
      return "webm";
  }
}

/**
 * Domain-specific solar terminology boosted in Gnani ASR acoustic biasing
 */
export const DEFAULT_SOLAR_VOCABULARY_BOOST: string[] = [
  "Inverter",
  "Central Inverter",
  "String Inverter",
  "SCB",
  "SMB",
  "Combiner Box",
  "String Combiner Box",
  "Transformer",
  "Substation",
  "IGBT",
  "Blower",
  "Heatsink",
  "Tracker",
  "Slew Drive",
  "Inclinometer",
  "Pyranometer",
  "Megger",
  "Insulation Resistance",
  "VOC",
  "ISC",
  "Earth fault",
  "Ground fault",
  "DC Disconnect",
  "Isolator",
  "HT Panel",
  "Vacuum Circuit Breaker",
  "VCB",
  "Over-Temperature",
  "Fuse blown",
  "Bhadla",
  "Pavagada",
];

