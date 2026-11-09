import { execFile } from "child_process";
import fs from "fs/promises";
import path from "path";
import os from "os";

export interface TranscodeResult {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  wasTranscoded: boolean;
}

/**
 * Ensures audio payload is in a format natively supported by Gnani AI ASR (16kHz 16-bit Mono WAV).
 * If the recording is in WebM (standard for Chrome/Edge/Firefox) or AAC/MP4, it uses ffmpeg
 * to transcode it cleanly into 16kHz PCM WAV.
 */
export async function transcodeToWav(
  inputBuffer: Buffer,
  inputMimeType: string
): Promise<TranscodeResult> {
  const normalizedMime = inputMimeType.toLowerCase().split(";")[0]?.trim() || "";

  // If already a valid PCM WAV with RIFF header, return as-is
  if (
    (normalizedMime === "audio/wav" || normalizedMime === "audio/x-wav") &&
    inputBuffer.length >= 44 &&
    inputBuffer.toString("utf8", 0, 4) === "RIFF"
  ) {
    return {
      buffer: inputBuffer,
      mimeType: "audio/wav",
      fileName: "audio.wav",
      wasTranscoded: false,
    };
  }

  // Determine input extension based on container
  let inputExt = "webm";
  if (normalizedMime.includes("mp4") || normalizedMime.includes("m4a")) {
    inputExt = "m4a";
  } else if (normalizedMime.includes("aac")) {
    inputExt = "aac";
  } else if (normalizedMime.includes("ogg")) {
    inputExt = "ogg";
  } else if (normalizedMime.includes("mp3") || normalizedMime.includes("mpeg")) {
    inputExt = "mp3";
  } else if (normalizedMime.includes("flac")) {
    inputExt = "flac";
  }

  const tempDir = os.tmpdir();
  const id = crypto.randomUUID();
  const tempInputPath = path.join(tempDir, `fs_in_${id}.${inputExt}`);
  const tempOutputPath = path.join(tempDir, `fs_out_${id}.wav`);

  try {
    await fs.writeFile(tempInputPath, inputBuffer);

    await new Promise<void>((resolve, reject) => {
      execFile(
        "ffmpeg",
        [
          "-y",
          "-i",
          tempInputPath,
          "-ar",
          "16000",
          "-ac",
          "1",
          "-c:a",
          "pcm_s16le",
          tempOutputPath,
        ],
        { timeout: 8000 },
        (error, _stdout, stderr) => {
          if (error) {
            reject(new Error(`FFmpeg transcoding failed: ${error.message}. Output: ${stderr}`));
          } else {
            resolve();
          }
        }
      );
    });

    const outputBuffer = await fs.readFile(tempOutputPath);
    return {
      buffer: outputBuffer,
      mimeType: "audio/wav",
      fileName: `recording_${id}.wav`,
      wasTranscoded: true,
    };
  } catch (err) {
    console.warn("FFmpeg transcoding bypassed or failed, using original audio buffer:", err);
    return {
      buffer: inputBuffer,
      mimeType: inputMimeType,
      fileName: `recording_${id}.${inputExt}`,
      wasTranscoded: false,
    };
  } finally {
    await fs.unlink(tempInputPath).catch(() => {});
    await fs.unlink(tempOutputPath).catch(() => {});
  }
}

