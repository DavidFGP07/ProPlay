import { z } from "zod";
import { PLATAFORMAS } from "../enums";

export const estadisticaSchema = z.object({
  id: z.string(),
  jugadorId: z.string(),
  juego: z.string(),
  rol: z.string().nullable(),
  partidas: z.number().int(),
  victorias: z.number().int(),
  kda: z.number(),
  winRate: z.number().min(0).max(1),
  metricas: z.record(z.unknown()).nullable(),
  fuente: z.enum(PLATAFORMAS),
  capturadaEn: z.coerce.date(),
});

export const listarEstadisticasQuerySchema = z.object({
  juego: z.string().max(60).optional(),
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional(),
});

export const sincronizarEstadisticasSchema = z.object({
  plataforma: z.enum(PLATAFORMAS),
  juego: z.string().min(1).max(60),
});

export type Estadistica = z.infer<typeof estadisticaSchema>;
export type ListarEstadisticasQuery = z.infer<
  typeof listarEstadisticasQuerySchema
>;
