import { PrismaClient } from "@prisma/client";
import { env } from "./env";
import { logger } from "./logger";

/**
 * Cliente Prisma único. Se guarda en globalThis para que `tsx watch` no abra
 * una conexión nueva en cada recarga durante el desarrollo.
 */
const globalParaPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalParaPrisma.prisma ??
  new PrismaClient({
    log: env.esDesarrollo
      ? [{ emit: "event", level: "query" }, "warn", "error"]
      : ["warn", "error"],
  });

if (env.esDesarrollo) {
  globalParaPrisma.prisma = prisma;
}

/** Comprueba que Postgres responde. Lo usa GET /health. */
export async function pingPostgres(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error({ error }, "Postgres no responde");
    return false;
  }
}

export async function desconectarPrisma(): Promise<void> {
  await prisma.$disconnect();
}
