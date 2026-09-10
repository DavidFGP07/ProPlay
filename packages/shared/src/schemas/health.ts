import { z } from "zod";

export const healthResponseSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  uptime: z.number(),
  version: z.string(),
  servicios: z.object({
    postgres: z.enum(["up", "down"]),
    redis: z.enum(["up", "down"]),
  }),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
