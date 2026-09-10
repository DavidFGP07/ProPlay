import type { Server } from "node:http";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { desconectarPrisma, pingPostgres } from "./config/prisma";
import { conectarRedis, desconectarRedis } from "./config/redis";
import { crearApp } from "./app";

/**
 * Arranque y parada ordenada del servidor.
 */
async function arrancar(): Promise<void> {
  const app = crearApp();

  const postgresListo = await pingPostgres();
  if (!postgresListo) {
    logger.warn(
      "Postgres no responde todavía: la API arranca, pero /health informará 'degraded'",
    );
  }

  try {
    await conectarRedis();
  } catch (error) {
    logger.warn({ error }, "No se pudo conectar a Redis al arrancar");
  }

  const servidor: Server = app.listen(env.PORT, () => {
    logger.info(
      `API de ProPlay escuchando en http://localhost:${env.PORT}/api/v1 (${env.NODE_ENV})`,
    );
  });

  registrarApagado(servidor);
}

function registrarApagado(servidor: Server): void {
  let apagando = false;

  const apagar = async (senal: string) => {
    if (apagando) return;
    apagando = true;
    logger.info(`Recibida ${senal}, cerrando el servidor...`);

    servidor.close(async () => {
      try {
        await Promise.allSettled([desconectarPrisma(), desconectarRedis()]);
        logger.info("Conexiones cerradas, adiós");
        process.exit(0);
      } catch (error) {
        logger.error({ error }, "Error cerrando conexiones");
        process.exit(1);
      }
    });

    // Red de seguridad: si algo se queda colgado, salimos igual.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGINT", () => void apagar("SIGINT"));
  process.on("SIGTERM", () => void apagar("SIGTERM"));

  process.on("unhandledRejection", (razon) => {
    logger.error({ razon }, "Promesa rechazada sin manejar");
  });

  process.on("uncaughtException", (error) => {
    logger.fatal({ error }, "Excepción sin capturar, terminando proceso");
    process.exit(1);
  });
}

void arrancar();
