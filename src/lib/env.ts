import { z } from "zod";

/**
 * Environment variable schema validation using Zod.
 * Ensures runtime safety and crashes early with actionable error messages
 * if critical environment variables are missing or misconfigured.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  APP_URL: z.string().url().default("http://localhost:3000"),

  // Database (PostgreSQL)
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required for PostgreSQL connection")
    .default("postgresql://postgres:postgres@localhost:5432/fieldsignal?schema=public"),

  // Authentication & Security
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters long for security")
    .default("fieldsignal-super-secret-jwt-key-min-32-chars-long"),
  JWT_EXPIRES_IN: z.string().default("7d"),

  // Gnani AI Speech-to-Text (Vachana REST API v3)
  GNANI_AI_API_KEY: z.string().default("gnani_dev_api_key_placeholder"),
  GNANI_AI_ACCESS_KEY: z.string().default("gnani_dev_access_key_placeholder"),
  GNANI_AI_ENDPOINT: z.string().url().default("https://api.vachana.ai/stt/v3"),
  GNANI_AI_MODEL: z.string().default("prisma-v3.0"),
  GNANI_AI_LANGUAGE_CODE: z.string().default("hi-IN,en-IN"),
  GNANI_AI_TIMEOUT_MS: z.coerce.number().default(8000),
  GNANI_AI_MAX_RETRIES: z.coerce.number().default(2),
  GNANI_AI_MOCK_FALLBACK: z
    .string()
    .optional()
    .transform((val) => val !== "false")
    .pipe(z.boolean())
    .default(true),

  // AI Extraction Layer
  AI_PROVIDER: z.enum(["gemini", "openai"]).default("gemini"),
  AI_API_KEY: z.string().default("ai_service_api_key_placeholder"),
  AI_MODEL_NAME: z.string().default("gemini-1.5-flash"),

  // Local Storage
  AUDIO_STORAGE_DIR: z.string().default("./uploads/audio"),
  MAX_AUDIO_FILE_SIZE_MB: z.coerce.number().default(10),
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("❌ Invalid environment variables configuration:");
    console.error(JSON.stringify(result.error.flatten().fieldErrors, null, 2));
    throw new Error("Invalid environment variables. Check .env file against .env.example.");
  }

  return result.data;
}

export const env = parseEnv();
