import { z } from "zod";
import { ROLES } from "../enums";

export const cambiarRolSchema = z.object({
  usuarioId: z.string().min(1),
  rol: z.enum(ROLES),
});

export const suspenderUsuarioSchema = z.object({
  usuarioId: z.string().min(1),
  motivo: z.string().min(5).max(500),
});

export const metricasAdminSchema = z.object({
  usuarios: z.number().int(),
  jugadores: z.number().int(),
  equipos: z.number().int(),
  ofertasAbiertas: z.number().int(),
  postulaciones: z.number().int(),
});

export type CambiarRolInput = z.infer<typeof cambiarRolSchema>;
export type MetricasAdmin = z.infer<typeof metricasAdminSchema>;
