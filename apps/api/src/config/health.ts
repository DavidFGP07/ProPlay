import type { HealthResponse } from "@proplay/shared";
import { pingPostgres } from "./prisma";
import { pingRedis } from "./redis";

/** Estado de la API y de sus dependencias (Postgres y Redis). */
export async function revisarSalud(): Promise<HealthResponse> {
  const [postgres, redis] = await Promise.all([pingPostgres(), pingRedis()]);

  return {
    status: postgres && redis ? "ok" : "degraded",
    uptime: Math.round(process.uptime()),
    version: process.env.npm_package_version ?? "0.1.0",
    servicios: {
      postgres: postgres ? "up" : "down",
      redis: redis ? "up" : "down",
    },
  };
}
