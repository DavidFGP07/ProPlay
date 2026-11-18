import { z } from "zod";
import {
  LONGITUD_MAXIMA_EXPLICACION_GENERADA,
  MOTIVOS_EXPLICACION_NO_DISPONIBLE,
} from "../constants";
import { candidatoOfertaParamsSchema } from "./matching";

/**
 * Contrato del explicador con modelo de lenguaje (RF-11; tareas 4.1, 4.3 y 4.7).
 *
 * `GET /api/v1/explicaciones/ofertas/:id/candidatos/:jugadorId` redacta en
 * lenguaje natural por qué un candidato del ranking encaja con la oferta, a
 * partir del desglose y la explicación del motor. Sólo complementa: las cifras
 * del desglose son las que deciden el puesto, y el ranking nunca depende de que
 * el explicador esté vivo.
 *
 * Responde siempre 200 cuando el candidato existe y el usuario puede verlo
 * (mismos permisos y mismo 404 que el detalle del candidato). Si no hay texto,
 * `estado` es `NO_DISPONIBLE` con su `motivo` y la vista se queda con la
 * explicación determinista: nunca un error al usuario.
 */

/** Parámetros de ruta: los mismos que el detalle del candidato. */
export const explicacionGeneradaParamsSchema = candidatoOfertaParamsSchema;

/** Versión del prompt con que se generó el texto; sube al cambiarlo. */
const versionPrompt = z.number().int().positive();

const generada = z.object({
  estado: z.literal("GENERADA"),
  texto: z.string().trim().min(1).max(LONGITUD_MAXIMA_EXPLICACION_GENERADA),
  motivo: z.null(),
  /** Modelo que redactó el texto (p. ej. `claude-haiku-5-5`). */
  modelo: z.string().min(1),
  versionPrompt,
  /** El texto salió de la caché: no se volvió a llamar al modelo. */
  deCache: z.boolean(),
});

const noDisponible = z.object({
  estado: z.literal("NO_DISPONIBLE"),
  texto: z.null(),
  motivo: z.enum(MOTIVOS_EXPLICACION_NO_DISPONIBLE),
  /** Modelo configurado; nulo si el explicador está desactivado. */
  modelo: z.string().min(1).nullable(),
  versionPrompt,
  deCache: z.literal(false),
});

export const explicacionGeneradaSchema = z.discriminatedUnion("estado", [generada, noDisponible]);

export type ExplicacionGeneradaParams = z.infer<typeof explicacionGeneradaParamsSchema>;
export type ExplicacionGenerada = z.infer<typeof explicacionGeneradaSchema>;
