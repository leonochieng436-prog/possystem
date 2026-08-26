import { PrismaClient } from "@prisma/client";

// Standard Next.js singleton pattern to avoid exhausting DB connections
// during dev-mode hot reload.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function databaseUrlWithConnectionTimeout() {
  const configuredUrl = process.env.DATABASE_URL;
  if (!configuredUrl) return undefined;

  const url = new URL(configuredUrl);
  if (!url.searchParams.has("connect_timeout")) {
    url.searchParams.set("connect_timeout", "15");
  }
  return url.toString();
}

function isTransientConnectionError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };
  return (
    candidate.code === "P1001" ||
    candidate.code === "P1017" ||
    candidate.message?.includes("Error in PostgreSQL connection") === true
  );
}

function pause(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function createPrismaClient() {
  const client = new PrismaClient({
    datasourceUrl: databaseUrlWithConnectionTimeout(),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

  return client.$extends({
    name: "transient-connection-retry",
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          for (let attempt = 0; ; attempt += 1) {
            try {
              return await query(args);
            } catch (error) {
              if (!isTransientConnectionError(error) || attempt >= 2) throw error;
              await pause(250 * (attempt + 1));
            }
          }
        },
      }
    },
  }) as unknown as PrismaClient;
}

export const rawPrisma =
  globalForPrisma.prisma ??
  createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = rawPrisma;
}
