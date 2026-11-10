import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-guard";
import { handleApiError, ValidationError } from "@/lib/errors";
import { getGnaniTtsService } from "@/modules/speech";

const synthesizeSchema = z.object({
  text: z
    .string()
    .min(1, "Text prompt cannot be empty")
    .max(2000, "Text prompt cannot exceed 2000 characters"),
  voice: z.string().max(50).optional(),
  language: z.string().max(20).optional(),
  model: z.string().max(50).optional(),
  speed: z.number().min(0.5).max(2.0).optional().default(1.0),
  format: z.enum(["wav", "mp3"]).optional().default("wav"),
});

/**
 * POST /api/v1/speech/synthesize
 * Synthesizes text into spoken natural voice audio using Gnani AI Timbre v3.0.
 * Returns raw audio/wav binary with metadata headers.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Enforce authentication
    await requireAuth(req);

    // 2. Validate request body
    const body = await req.json();
    const data = synthesizeSchema.parse(body);

    // 3. Synthesize speech via server-side GnaniTimbreTtsService
    const ttsService = getGnaniTtsService();
    const result = await ttsService.synthesize({
      text: data.text,
      voice: data.voice,
      language: data.language,
      model: data.model,
      speed: data.speed,
      format: data.format,
    });

    // 4. Return audio binary stream with content headers
    return new NextResponse(new Uint8Array(result.audioBuffer), {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Length": result.audioBuffer.length.toString(),
        "Cache-Control": "public, max-age=3600, immutable",
        "X-TTS-Model": result.model,
        "X-TTS-Voice": result.voice,
        "X-TTS-Language": result.language,
        "X-TTS-Mock": result.isMock ? "true" : "false",
        "X-TTS-Latency-Ms": result.latencyMs.toString(),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
