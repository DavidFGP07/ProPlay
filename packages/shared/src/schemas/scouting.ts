import { z } from "zod";
import { NIVEL_HABILIDAD_MAX, NIVEL_HABILIDAD_MIN } from "../constants";

export const busquedaJugadoresSchema = z.object({
  juego: z.string().max(60).optional(),
  rol: z.string().max(60).optional(),
  region: z.string().max(60).optional(),
  kdaMinimo: z.coerce.number().min(0).max(20).optional(),
  winRateMinimo: z.coerce.number().min(0).max(1).optional(),
  nivelMinimo: z.coerce
    .number()
    .int()
    .min(NIVEL_HABILIDAD_MIN)
    .max(NIVEL_HABILIDAD_MAX)
    .optional(),
  dispuestoRelocalizar: z.coerce.boolean().optional(),
});

export const guardarBusquedaSchema = z.object({
  nombre: z.string().min(1).max(80),
  filtros: busquedaJugadoresSchema,
});

export type BusquedaJugadores = z.infer<typeof busquedaJugadoresSchema>;
