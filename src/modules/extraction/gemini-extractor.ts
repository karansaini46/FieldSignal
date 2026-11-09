import { env } from "@/lib/env";
import { ExtractionInput, ExtractedIncident } from "./types";
import { EXTRACTION_SYSTEM_PROMPT, buildExtractionUserPrompt } from "./prompt";

export class GeminiExtractionEngine {
  private readonly apiKey: string;
  private readonly modelName: string;
  private readonly timeoutMs: number;

  constructor(apiKey?: string, modelName?: string, timeoutMs = 10000) {
    this.apiKey = apiKey || env.AI_API_KEY || process.env.AI_API_KEY || "";
    this.modelName = modelName || env.AI_MODEL_NAME || process.env.AI_MODEL_NAME || "gemini-1.5-flash";
    this.timeoutMs = timeoutMs;
  }

  public async extract(input: ExtractionInput): Promise<any> {
    if (!this.apiKey || this.apiKey.includes("placeholder")) {
      throw new Error("No live Gemini AI API key configured; using deterministic engine");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;
    const userPrompt = buildExtractionUserPrompt(input);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: EXTRACTION_SYSTEM_PROMPT }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: userPrompt }],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            response_mime_type: "application/json",
          },
        }),
      });

      clearTimeout(timer);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        throw new Error("Gemini returned empty candidate text");
      }

      return JSON.parse(rawText);
    } catch (err: any) {
      clearTimeout(timer);
      if (err.name === "AbortError") {
        throw new Error(`Gemini extraction timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    }
  }
}

