// Worker de ingesta como proceso propio, para cuando la API tenga varias
// instancias y se quiera separar (docs/operacion.md, «Ingesta de Riot»):
//
//   node apps/api/dist/ingesta/main.js     (con INGESTA_ACTIVA=false en la API)
//
// En el piloto no hace falta: el worker corre dentro de la API.
import { logger } from "../config/logger";
import { desconectarPrisma } from "../config/prisma";
import { conectarRedis, desconectarRedis } from "../config/redis";
import { cerrarColaIngesta } from "./cola";
import { arrancarIngesta } from "./ingesta";

async function principal(): Promise<void> {
  await conectarRedis();
  const ingesta = await arrancarIngesta();
  const apagar = async () => {
    await ingesta.detener();
    await Promise.allSettled([cerrarColaIngesta(), desconectarPrisma(), desconectarRedis()]);
    process.exit(0);
  };
  process.on("SIGINT", () => void apagar());
  process.on("SIGTERM", () => void apagar());
}

principal().catch((error: unknown) => {
  logger.fatal({ error }, "No se pudo arrancar el worker de ingesta");
  process.exit(1);
});
