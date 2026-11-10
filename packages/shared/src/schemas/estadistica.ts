import { z } from "zod";
import { PLATAFORMAS, POSICIONES_LOL, RANGOS_LOL } from "../enums";
import { JUEGO_PILOTO, LIGAS_LOL } from "../constants";

export const estadisticaSchema = z.object({
  id: z.string(),
  jugadorId: z.string(),
  juego: z.string(),
  /** Posición más jugada en clasificatoria solo/dúo (PosicionLol en LoL). */
  rol: z.string().nullable(),
  /** Rango solo/dúo en el momento de la captura (`rangoDesdeRiot`). */
  rango: z.enum(RANGOS_LOL).nullable(),
  partidas: z.number().int(),
  victorias: z.number().int(),
  kda: z.number(),
  winRate: z.number().min(0).max(1),
  metricas: z.record(z.unknown()).nullable(),
  fuente: z.enum(PLATAFORMAS),
  capturadaEn: z.coerce.date(),
});

/**
 * Rango detallado de una cola clasificatoria tal como lo da league-v4, con LP,
 * victorias y derrotas, para Mis estadísticas. El rango que se filtra y compara
 * es la columna `rango` (`RangoLol`).
 */
export const rangoColaLolSchema = z.object({
  liga: z.enum(LIGAS_LOL),
  /** I a IV; nulo en Master, Grandmaster y Challenger. */
  division: z.string().nullable(),
  puntosLiga: z.number().int(),
  victorias: z.number().int(),
  derrotas: z.number().int(),
});

/**
 * Forma de `Estadistica.metricas` cuando la fuente es Riot (League of
 * Legends). Todas salen de la API oficial: ninguna la declara el jugador.
 * Las tasas «por minuto» se calculan sobre la duración total jugada.
 */
export const metricasLolSchema = z.object({
  servidor: z.string(),
  nivelInvocador: z.number().int(),
  rangoSoloDuo: rangoColaLolSchema.nullable(),
  rangoFlex: rangoColaLolSchema.nullable(),
  partidasAnalizadas: z.number().int(),
  /** Partidas por cola: 420 Solo/Duo, 440 Flex, 400/430 normales… */
  colas: z.record(z.number().int()),
  promedioKills: z.number(),
  promedioMuertes: z.number(),
  promedioAsistencias: z.number(),
  csPorMinuto: z.number(),
  oroPorMinuto: z.number(),
  danoPorMinuto: z.number(),
  visionPorMinuto: z.number(),
  /** (kills + asistencias) / kills del equipo, en [0, 1]. */
  participacionKills: z.number().min(0).max(1),
  duracionMediaMinutos: z.number(),
  /** Partidas de la cola solo/dúo (420) por posición: de aquí sale `rol`. */
  distribucionRoles: z.record(z.enum(POSICIONES_LOL), z.number().int()),
  campeonesMasJugados: z.array(
    z.object({
      campeon: z.string(),
      partidas: z.number().int(),
      victorias: z.number().int(),
      kda: z.number(),
    }),
  ),
  /** Partida más reciente analizada: si no cambia, la sincronización no guarda otra fila. */
  ultimaPartidaId: z.string().nullable(),
  ultimaPartidaEn: z.coerce.date().nullable(),
});

export const listarEstadisticasQuerySchema = z.object({
  juego: z.string().max(60).optional(),
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional(),
});

export const sincronizarEstadisticasSchema = z.object({
  plataforma: z.enum(PLATAFORMAS).default("RIOT"),
  juego: z.string().min(1).max(60).default(JUEGO_PILOTO),
});

/** Respuesta de `POST /estadisticas/sincronizar`. */
export const sincronizarEstadisticasRespuestaSchema = z.object({
  estadisticas: z.array(estadisticaSchema),
  /** false si Riot no tenía partidas nuevas desde la última sincronización. */
  hayDatosNuevos: z.boolean(),
  sincronizadaEn: z.coerce.date(),
});

/** Variación entre la última captura y la anterior (null si no hay anterior). */
const tendenciaSchema = z.object({
  winRate: z.number().nullable(),
  kda: z.number().nullable(),
  csPorMinuto: z.number().nullable(),
});

/** Respuesta de `GET /estadisticas/jugador/:id/resumen`: lo último por juego. */
export const resumenEstadisticasSchema = z.object({
  jugadorId: z.string(),
  juegos: z.array(
    z.object({
      juego: z.string(),
      fuente: z.enum(PLATAFORMAS),
      actual: estadisticaSchema,
      anterior: estadisticaSchema.nullable(),
      tendencia: tendenciaSchema,
    }),
  ),
});

export type Estadistica = z.infer<typeof estadisticaSchema>;
export type ListarEstadisticasQuery = z.infer<
  typeof listarEstadisticasQuerySchema
>;
export type SincronizarEstadisticasInput = z.infer<typeof sincronizarEstadisticasSchema>;
export type SincronizarEstadisticasRespuesta = z.infer<
  typeof sincronizarEstadisticasRespuestaSchema
>;
export type ResumenEstadisticas = z.infer<typeof resumenEstadisticasSchema>;
export type RangoColaLol = z.infer<typeof rangoColaLolSchema>;
export type MetricasLol = z.infer<typeof metricasLolSchema>;
