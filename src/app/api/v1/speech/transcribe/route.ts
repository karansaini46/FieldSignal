import { NextRequest } from "next/server";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { requireAuth } from "@/lib/auth-guard";
import { BadRequestError, handleApiError } from "@/lib/errors";
import { apiSuccess } from "@/lib/api-response";
import { getGnaniSpeechService } from "@/modules/speech";
import { validateAudioPayload, getAudioFileExtension } from "@/modules/speech/audio-validator";
import { transcodeToWav } from "@/modules/speech/audio-transcoder";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user via session or Bearer token
    const session = await requireAuth(request);

    // 2. Parse FormData
    const formData = await request.formData();
    const audioFile = (formData.get("audio_file") || formData.get("audio")) as File | null;
    const siteIdParam = (formData.get("siteId") as string) || null;
    const requestedLanguage = (formData.get("language_code") as string) || undefined;

    if (!audioFile) {
      throw new BadRequestError("Missing required 'audio_file' in form payload");
    }

    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = audioFile.type || "audio/webm";

    // 3. Validate format & size server-side
    validateAudioPayload(buffer.byteLength, mimeType);

    // 4. Duplicate submission check: hash audio payload to prevent accidental double-submit
    const audioHash = crypto.createHash("sha256").update(buffer).digest("hex");
    const fifteenSecondsAgo = new Date(Date.now() - 15000);

    const recentDuplicate = await db.audioRecording.findFirst({
      where: {
        userId: session.userId,
        createdAt: { gte: fifteenSecondsAgo },
        fileSizeBytes: buffer.byteLength,
      },
      orderBy: { createdAt: "desc" },
    });

    if (
      recentDuplicate &&
      (recentDuplicate.metadata as any)?.audioHash === audioHash
    ) {
      return apiSuccess({
        recordingId: recentDuplicate.id,
        transcript: recentDuplicate.originalTranscript,
        isEmptyTranscript: !recentDuplicate.originalTranscript.trim(),
        detectedLanguage: recentDuplicate.language || "hi-IN",
        confidence: recentDuplicate.confidence || 0,
        processingTimeSeconds: recentDuplicate.durationSeconds,
        latencyMs: recentDuplicate.processingLatencyMs || 0,
        model: (recentDuplicate.metadata as any)?.model || env.GNANI_AI_MODEL,
        fileSizeBytes: recentDuplicate.fileSizeBytes,
        mimeType: recentDuplicate.mimeType,
        isDuplicate: true,
      });
    }

    // 5. Resolve Site ID for multi-tenant tenant isolation
    let siteId = siteIdParam || session.siteId;
    if (!siteId) {
      const defaultSite = await db.site.findFirst({
        where: { organizationId: session.organizationId },
        select: { id: true },
      });
      siteId = defaultSite?.id || null;
    }

    if (!siteId) {
      throw new BadRequestError("No valid site associated with user organization");
    }

    // 6. Transcode to optimal 16kHz mono WAV for Gnani AI if needed
    const { buffer: readyBuffer, mimeType: readyMime, fileName: readyFileName } =
      await transcodeToWav(buffer, mimeType);

    // 7. Store audio file safely on disk
    const storageDir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), env.AUDIO_STORAGE_DIR);
    await fs.mkdir(storageDir, { recursive: true });

    const ext = getAudioFileExtension(readyMime);
    const recordingId = crypto.randomUUID();
    const diskFileName = `${recordingId}.${ext}`;
    const filePath = path.join(/*turbopackIgnore: true*/ storageDir, diskFileName);
    await fs.writeFile(filePath, readyBuffer);

    // 8. Transcribe via server-side GnaniSpeechService
    const speechService = getGnaniSpeechService();
    const transcription = await speechService.transcribe({
      audio: readyBuffer,
      mimeType: readyMime,
      fileName: readyFileName,
      languageCode: requestedLanguage,
    });

    // 9. Persist AudioRecording record in database (preserving original transcript immutably)
    const audioRecording = await db.audioRecording.create({
      data: {
        id: recordingId,
        userId: session.userId,
        siteId,
        filePath: path.relative(process.cwd(), filePath),
        mimeType: readyMime,
        fileSizeBytes: readyBuffer.byteLength,
        durationSeconds: transcription.processingTimeSeconds || 0,
        originalTranscript: transcription.transcript,
        language: transcription.detectedLanguage,
        confidence: transcription.confidence,
        processingLatencyMs: transcription.latencyMs,
        metadata: {
          model: transcription.model,
          requestId: transcription.requestId,
          audioHash,
          originalMimeType: mimeType,
          originalSizeBytes: buffer.byteLength,
        },
      },
    });

    const isEmptyTranscript = !transcription.transcript.trim();

    return apiSuccess({
      recordingId: audioRecording.id,
      transcript: transcription.transcript,
      isEmptyTranscript,
      detectedLanguage: transcription.detectedLanguage,
      confidence: transcription.confidence,
      processingTimeSeconds: transcription.processingTimeSeconds,
      latencyMs: transcription.latencyMs,
      model: transcription.model,
      fileSizeBytes: readyBuffer.byteLength,
      mimeType: readyMime,
    });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
