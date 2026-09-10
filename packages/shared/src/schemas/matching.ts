import { z } from "zod";

/**
 * Contrato del módulo de matching.
 * El desglose expone las cinco dimensiones del algoritmo; sus pesos están en
 * `@proplay/shared/constants` (PESOS_MATCHING).
 */
export const desgloseMatchingSchema = z.object({
  tecnica: z.number().min(0).max(1),
  experiencia: z.number().min(0).max(1),
  habilidadesBlandas: z.number().min(0).max(1),
  geografica: z.number().min(0).max(1),
  disponibilidad: z.number().min(0).max(1),
});

export const matchingSchema = z.object({
  id: z.string(),
  ofertaId: z.string(),
  jugadorId: z.string(),
  puntaje: z.number().min(0).max(1),
  desglose: desgloseMatchingSchema,
  calculadoEn: z.coerce.date(),
});

export const calcularMatchingSchema = z.object({
  ofertaId: z.string().min(1),
  limite: z.number().int().positive().max(100).default(20),
});

export type DesgloseMatching = z.infer<typeof desgloseMatchingSchema>;
export type Matching = z.infer<typeof matchingSchema>;
export type CalcularMatchingInput = z.infer<typeof calcularMatchingSchema>;
