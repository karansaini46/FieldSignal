import fs from "fs/promises";
import path from "path";
import os from "os";
import { env } from "@/lib/env";

// ponytail: Ephemeral /tmp storage fallback for serverless container runtimes (e.g. Vercel). Ceiling: Audio files persist during container lifetime; upgrade path: attach S3/GCS bucket or set BLOB_READ_WRITE_TOKEN for immutable multi-region object storage.

/**
 * Resolves the writable audio storage directory.
 * On serverless platforms like Vercel where process.cwd() is read-only,
 * automatically redirects to os.tmpdir() to prevent EROFS errors.
 */
export function getAudioStorageDirectory(): string {
  // If explicitly in Vercel or AWS Lambda serverless runtime
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), "fieldsignal-audio");
  }

  // If path is absolute or configured
  if (path.isAbsolute(env.AUDIO_STORAGE_DIR)) {
    return env.AUDIO_STORAGE_DIR;
  }

  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), env.AUDIO_STORAGE_DIR);
}

/**
 * Saves raw audio buffer to the resolved storage location.
 */
export async function saveAudioFile(
  buffer: Buffer,
  mimeType: string,
  recordingId: string
): Promise<{ absolutePath: string; relativePath: string; diskFileName: string }> {
  const storageDir = getAudioStorageDirectory();
  await fs.mkdir(storageDir, { recursive: true });

  const ext = mimeType.includes("wav")
    ? "wav"
    : mimeType.includes("ogg")
    ? "ogg"
    : mimeType.includes("mp4") || mimeType.includes("m4a")
    ? "m4a"
    : mimeType.includes("webm")
    ? "webm"
    : "wav";

  const diskFileName = `${recordingId}.${ext}`;
  const absolutePath = path.join(/*turbopackIgnore: true*/ storageDir, diskFileName);

  await fs.writeFile(absolutePath, buffer);

  // Store relative path if inside cwd, or absolute /tmp path if serverless
  const relativePath = absolutePath.startsWith(process.cwd())
    ? path.relative(process.cwd(), absolutePath)
    : absolutePath;

  return { absolutePath, relativePath, diskFileName };
}

/**
 * Reads audio file buffer from disk/storage path.
 * Returns null if file not found or inaccessible.
 */
export async function readAudioFile(filePath: string): Promise<Buffer | null> {
  try {
    const resolvedPath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(/*turbopackIgnore: true*/ process.cwd(), filePath);
    return await fs.readFile(resolvedPath);
  } catch {
    return null;
  }
}
