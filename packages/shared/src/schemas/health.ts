import { z } from "zod";

export const healthResponseSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  uptime: z.number(),
  version: z.string(),
  servicios: z.object({
    postgres: z.enum(["up", "down"]),
    redis: z.enum(["up", "down"]),
    /**
     * Integración con Riot. Público, así que sólo dice si está disponible; el
     * motivo (sin clave, clave caducada) y la cola van a los registros y a
     * `npm run ingesta:estado -w api` (docs/operacion.md).
     */
    riot: z.enum(["ok", "no disponible"]),
  }),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
