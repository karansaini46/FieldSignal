import { PrismaClient } from "@prisma/client";
import { env } from "@/lib/env";

/**
 * Prisma Client Singleton for Next.js App Router.
 * Prevents multiple instances in development during hot-reloads.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

export default db;
