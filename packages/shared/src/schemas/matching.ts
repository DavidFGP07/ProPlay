import { z } from "zod";
import {
  ESTADOS_OFERTA,
  ESTADOS_POSTULACION,
  MODALIDADES,
  POSICIONES_LOL,
  RANGOS_LOL,
} from "../enums";
import {
  CERCANIAS_GEOGRAFICAS,
  METRICAS_TECNICA_LOL,
  MODOS_MATCHING,
  MOTIVOS_DIMENSION,
} from "../constants";
import { paginacionQuerySchema, paginadoSchema } from "./common";
import { pesosMatchingSchema } from "./oferta";
import { jugadorEncontradoSchema } from "./scouting";

/**
 * Contrato del módulo de matching (RF-09).
 *
 * El puntaje de compatibilidad es la ecuación (1) de la Sección VIII:
 * S(j, o) = Σ wₖ·dₖ(j, o), con los pesos de la oferta. El desglose da los cinco
 * dₖ; el peso y la contribución de cada dimensión (wₖ·dₖ) los compone el
 * cliente con los pesos de la oferta, que van en la respuesta.
 */

const valorDimension = z.number().min(0).max(1);

export const desgloseMatchingSchema = z.object({
  tecnica: valorDimension,
  experiencia: valorDimension,
  habilidadesBlandas: valorDimension,
  geografica: valorDimension,
  disponibilidad: valorDimension,
});

// ----------------------------------------------------------- explicación

/**
 * Lo común a las cinco dimensiones. `faltanDatos` es verdadero cuando el
 * motivo está en `MOTIVOS_FALTAN_DATOS`: la dimensión se puntuó con 0 o con
 * el neutro (`VALOR_NEUTRO_DIMENSION`) y la interfaz lo marca en el desglose.
 * `motivo` es nulo cuando la dimensión salió del cálculo normal.
 */
const baseExplicacion = {
  faltanDatos: z.boolean(),
  motivo: z.enum(MOTIVOS_DIMENSION).nullable(),
};

/** Técnica: posición, rango y rendimiento de la última captura verificada. */
export const explicacionTecnicaSchema = z.object({
  ...baseExplicacion,
  posicionPedida: z.enum(POSICIONES_LOL),
  /** Posición más jugada en solo/dúo; nula sin captura verificada. */
  posicionPrincipal: z.enum(POSICIONES_LOL).nullable(),
  /** Fracción de las partidas de solo/dúo jugadas en la posición pedida. */
  fraccionEnPosicion: valorDimension.nullable(),
  rango: z.enum(RANGOS_LOL).nullable(),
  rangoMinimo: z.enum(RANGOS_LOL).nullable(),
  partidasAnalizadas: z.number().int().min(0).nullable(),
  /** Fecha de la captura de la que salen los datos. */
  datosDel: z.coerce.date().nullable(),
  /** Las tres partes de la técnica, cada una en [0, 1]; nulas sin captura. */
  componentes: z
    .object({
      posicion: valorDimension,
      rango: valorDimension,
      rendimiento: valorDimension,
    })
    .nullable(),
  /** Métricas que contaron para la posición pedida: valor bruto y normalizado. */
  metricas: z.array(
    z.object({
      metrica: z.enum(METRICAS_TECNICA_LOL),
      valor: z.number(),
      normalizado: valorDimension,
    }),
  ),
});

/** Experiencia: sin modelo de trayectoria en el piloto, sólo el motivo. */
export const explicacionExperienciaSchema = z.object(baseExplicacion);

/** Habilidades blandas: endorsements de equipos a las habilidades `BLANDA`. */
export const explicacionHabilidadesBlandasSchema = z.object({
  ...baseExplicacion,
  endorsementsDeEquipos: z.number().int().min(0),
});

/** Geográfica: modalidad de la oferta, cercanía y relocalización. */
export const explicacionGeograficaSchema = z.object({
  ...baseExplicacion,
  modalidad: z.enum(MODALIDADES),
  /** Nula si la oferta es remota o el jugador no tiene ubicación. */
  cercania: z.enum(CERCANIAS_GEOGRAFICAS).nullable(),
  /** La disposición a relocalizarse subió el puntaje de la cercanía. */
  relocalizacionAplicada: z.boolean(),
});

/** Disponibilidad: horas del jugador frente a las que pide la oferta. */
export const explicacionDisponibilidadSchema = z.object({
  ...baseExplicacion,
  horasJugador: z.number().int().min(0).nullable(),
  horasOferta: z.number().int().min(0).nullable(),
});

/**
 * Por qué cada dimensión vale lo que vale, con las cifras que usó el motor.
 * Se guarda con el `Matching` junto a los pesos aplicados, para que un ranking
 * ya calculado se pueda explicar aunque la oferta cambie después. Son datos,
 * no texto: el cliente los traduce y el explicador del S4 los usa de base.
 */
export const explicacionMatchingSchema = z.object({
  pesos: pesosMatchingSchema,
  dimensiones: z.object({
    tecnica: explicacionTecnicaSchema,
    experiencia: explicacionExperienciaSchema,
    habilidadesBlandas: explicacionHabilidadesBlandasSchema,
    geografica: explicacionGeograficaSchema,
    disponibilidad: explicacionDisponibilidadSchema,
  }),
});

// ----------------------------------------------------------- ranking

/** Query de `GET /matching/ofertas/:id/ranking`. */
export const rankingOfertaQuerySchema = paginacionQuerySchema;

/**
 * Un candidato del ranking. `jugador` es la misma lista blanca que el
 * buscador de talento (`jugadorEncontradoSchema`): el ranking lo ven los
 * mismos roles. `verificacion: null` es la marca «Sin cuenta verificada».
 */
export const candidatoRankingSchema = z.object({
  /** Puesto en el ranking, desde 1. */
  puesto: z.number().int().positive(),
  jugador: jugadorEncontradoSchema,
  puntaje: valorDimension,
  desglose: desgloseMatchingSchema,
  explicacion: explicacionMatchingSchema,
  /** Similitud coseno con el vector de requisitos de la oferta (recuperador). */
  similitud: z.number().min(-1).max(1).nullable(),
  /** Postulación del jugador a esta oferta, si se postuló. */
  postulacion: z
    .object({
      id: z.string(),
      estado: z.enum(ESTADOS_POSTULACION),
    })
    .nullable(),
});

/**
 * Ranking de candidatos de una oferta: una página de candidatos ordenados por
 * puntaje (a igualdad, por técnica y por id del jugador) y los datos de la
 * oferta y del cálculo.
 */
export const rankingOfertaSchema = paginadoSchema(candidatoRankingSchema).extend({
  oferta: z.object({
    id: z.string(),
    titulo: z.string(),
    estado: z.enum(ESTADOS_OFERTA),
    rol: z.enum(POSICIONES_LOL),
    pesos: pesosMatchingSchema,
  }),
  calculadoEn: z.coerce.date(),
  versionFormulas: z.number().int().positive(),
  modo: z.enum(MODOS_MATCHING),
  /** Peso del componente colaborativo: 0 en arranque en frío. */
  pesoColaborativo: valorDimension,
});

// ----------------------------------------------------------- andamiaje

/** Fila de `Matching`. */
export const matchingSchema = z.object({
  id: z.string(),
  ofertaId: z.string(),
  jugadorId: z.string(),
  puntaje: valorDimension,
  desglose: desgloseMatchingSchema,
  calculadoEn: z.coerce.date(),
});

/**
 * Cuerpo de `POST /matching/calcular` del andamiaje. Lo sustituye
 * `POST /matching/ofertas/:id/recalcular` (la oferta va en la ruta) en el PR
 * del motor, que lo retira.
 */
export const calcularMatchingSchema = z.object({
  ofertaId: z.string().min(1),
  limite: z.number().int().positive().max(100).default(20),
});

export type DesgloseMatching = z.infer<typeof desgloseMatchingSchema>;
export type ExplicacionMatching = z.infer<typeof explicacionMatchingSchema>;
export type ExplicacionTecnica = z.infer<typeof explicacionTecnicaSchema>;
export type ExplicacionGeografica = z.infer<typeof explicacionGeograficaSchema>;
export type ExplicacionDisponibilidad = z.infer<typeof explicacionDisponibilidadSchema>;
export type ExplicacionHabilidadesBlandas = z.infer<typeof explicacionHabilidadesBlandasSchema>;
export type ExplicacionExperiencia = z.infer<typeof explicacionExperienciaSchema>;
export type RankingOfertaQuery = z.infer<typeof rankingOfertaQuerySchema>;
export type CandidatoRanking = z.infer<typeof candidatoRankingSchema>;
export type RankingOferta = z.infer<typeof rankingOfertaSchema>;
export type Matching = z.infer<typeof matchingSchema>;
export type CalcularMatchingInput = z.infer<typeof calcularMatchingSchema>;
