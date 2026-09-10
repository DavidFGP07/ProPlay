import Redis from "ioredis";
import { env } from "./env";
import { logger } from "./logger";

/**
 * Cliente de Redis. `lazyConnect` evita abrir la conexión al importar el
 * módulo: así las pruebas de integración pueden cargar la app sin Redis, y el
 * servidor conecta explícitamente al arrancar (src/server.ts).
 */
export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 2,
  enableOfflineQueue: false,
  retryStrategy: (intentos) => Math.min(intentos * 200, 3000),
});

redis.on("error", (error: Error) => {
  logger.warn({ error: error.message }, "Error de conexión con Redis");
});

redis.on("connect", () => {
  logger.info("Conectado a Redis");
});

export async function conectarRedis(): Promise<void> {
  if (redis.status === "ready" || redis.status === "connecting") return;
  await redis.connect();
}

/** Comprueba que Redis responde. Lo usa GET /health. */
export async function pingRedis(): Promise<boolean> {
  try {
    if (redis.status !== "ready") {
      await redis.connect();
    }
    const respuesta = await redis.ping();
    return respuesta === "PONG";
  } catch {
    return false;
  }
}

export async function desconectarRedis(): Promise<void> {
  if (redis.status === "end") return;
  await redis.quit();
}
