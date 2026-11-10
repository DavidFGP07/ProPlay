import type { HealthResponse } from "@proplay/shared";
import { pingPostgres } from "./prisma";
import { estadoClaveRiot } from "../integrations";
import { env } from "./env";
import { pingRedis } from "./redis";

/**
 * La integración con Riot, sin el motivo: `/health` es público. El detalle
 * (sin clave, clave caducada) va a los registros y a `npm run ingesta:estado`.
 */
async function riotDisponible(): Promise<boolean> {
  try {
    return (await estadoClaveRiot.estado(env.RIOT_API_KEY)) === "ok";
  } catch {
    return false;
  }
}

/**
 * Estado de la API y de sus dependencias. `status` sólo depende de Postgres y
 * Redis: sin Riot la API sigue sirviendo, y la plataforma no debe reiniciarla.
 */
export async function revisarSalud(): Promise<HealthResponse> {
  const [postgres, redis, riot] = await Promise.all([pingPostgres(), pingRedis(), riotDisponible()]);

  return {
    status: postgres && redis ? "ok" : "degraded",
    uptime: Math.round(process.uptime()),
    version: process.env.npm_package_version ?? "0.1.0",
    servicios: {
      postgres: postgres ? "up" : "down",
      redis: redis ? "up" : "down",
      riot: riot ? "ok" : "no disponible",
    },
  };
}
