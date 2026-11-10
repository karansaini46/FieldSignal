// ponytail: Zero-dependency structured JSON logger. In production outputs machine-readable JSON lines for Datadog/CloudWatch/Vercel Log Drain; in dev outputs formatted text. Upgrade path: stream to Winston/Pino with OpenTelemetry trace contexts.

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogPayload {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: unknown;
  timestamp: string;
}

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "token",
  "jwt",
  "secret",
  "jwt_secret",
  "authorization",
  "cookie",
  "set-cookie",
  "apikey",
  "api_key",
  "access_key",
]);

/**
 * Recursively redacts sensitive credentials from log contexts.
 */
function sanitize(obj: unknown, depth = 0): unknown {
  if (depth > 4 || obj === null || obj === undefined) return obj;

  if (typeof obj === "string") {
    if (obj.length > 500) return `${obj.slice(0, 100)}... [truncated ${obj.length} chars]`;
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitize(item, depth + 1));
  }

  if (typeof obj === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) {
        sanitized[k] = "[REDACTED]";
      } else {
        sanitized[k] = sanitize(v, depth + 1);
      }
    }
    return sanitized;
  }

  return obj;
}

function writeLog(level: LogLevel, message: string, context?: Record<string, unknown>, error?: unknown): void {
  const isProd = process.env.NODE_ENV === "production";
  const timestamp = new Date().toISOString();

  let formattedError: Record<string, unknown> | undefined;
  if (error instanceof Error) {
    formattedError = {
      name: error.name,
      message: error.message,
      ...(isProd ? {} : { stack: error.stack }),
    };
  } else if (error) {
    formattedError = { raw: String(error) };
  }

  const payload: LogPayload = {
    timestamp,
    level,
    message,
    ...(context ? { context: sanitize(context) as Record<string, unknown> } : {}),
    ...(formattedError ? { error: formattedError } : {}),
  };

  if (isProd) {
    const serialized = JSON.stringify(payload);
    if (level === "error") {
      process.stderr.write(serialized + "\n");
    } else {
      process.stdout.write(serialized + "\n");
    }
  } else {
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    switch (level) {
      case "error":
        console.error(prefix, message, context || "", error || "");
        break;
      case "warn":
        console.warn(prefix, message, context || "");
        break;
      case "info":
        console.info(prefix, message, context || "");
        break;
      case "debug":
        console.debug(prefix, message, context || "");
        break;
    }
  }
}

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => writeLog("debug", msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => writeLog("info", msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => writeLog("warn", msg, ctx),
  error: (msg: string, err?: unknown, ctx?: Record<string, unknown>) => writeLog("error", msg, ctx, err),
};

export default logger;
