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

let conexionEnCurso: Promise<void> | null = null;

/**
 * Conecta si hace falta. Llamadas simultáneas comparten la misma conexión en
 * curso: `connect()` dos veces seguidas lanzaría un error.
 */
export async function conectarRedis(): Promise<void> {
  if (redis.status === "ready") return;
  if (redis.status === "wait" || redis.status === "end") {
    conexionEnCurso ??= redis.connect().finally(() => {
      conexionEnCurso = null;
    });
  }
  if (conexionEnCurso) await conexionEnCurso;
}

/**
 * Cliente listo para usar. Con `enableOfflineQueue: false` un comando antes
 * de conectar falla en vez de esperar, así que quien guarda datos en Redis
 * (los desafíos de Riot) pasa por aquí. En las pruebas de integración la app
 * se crea sin arrancar el servidor y la conexión se abre al primer uso.
 */
export async function clienteRedis(): Promise<Redis> {
  await conectarRedis();
  return redis;
}

/** Comprueba que Redis responde. Lo usa GET /health. */
export async function pingRedis(): Promise<boolean> {
  try {
    await conectarRedis();
    const respuesta = await redis.ping();
    return respuesta === "PONG";
  } catch {
    return false;
  }
}

export async function desconectarRedis(): Promise<void> {
  if (redis.status === "end" || redis.status === "wait") return;
  await redis.quit();
}
