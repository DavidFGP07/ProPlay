import { z } from "zod";
import { DEPARTAMENTOS, ESTADOS_OFERTA, POSICIONES_LOL } from "../enums";
import {
  BANDAS_RANGO,
  DIMENSIONES_MATCHING,
  DIMENSIONES_VISIBLES,
  ETAPAS_EMBUDO,
  GRUPOS_TALENTO,
  MACROREGIONES,
  type BandaRango,
  type DimensionMatching,
} from "../constants";
import { idSchema } from "./common";

/**
 * Contrato del módulo de analítica (RF-13): los indicadores de la analítica
 * fusionada con el panel del equipo. Las definiciones de cada métrica (fórmula,
 * filtro y unidad) están en docs/arquitectura.md, «Analítica».
 *
 * Unidades:
 * - Días naturales: diferencia entre fechas del calendario en
 *   `ZONA_HORARIA_PILOTO`, entera (tiempo hasta cubrir, hasta el primer
 *   tryout, días que lleva abierta).
 * - Días transcurridos: tiempo exacto entre dos instantes, en días con
 *   decimales (tiempo en cada etapa del embudo).
 * - Aportes y puntajes: fracciones de 0 a 1, como en el ranking.
 */

const entero = z.number().int().min(0);
const fraccion = z.number().min(0).max(1);

/**
 * Mediana, media y tamaño de muestra de una serie de días. Con `n = 0` la
 * mediana y la media son nulas: no hay datos, que es distinto de «0 días».
 */
export const resumenDiasSchema = z
  .object({
    n: entero,
    mediana: z.number().min(0).nullable(),
    media: z.number().min(0).nullable(),
  })
  .refine((r) => (r.n === 0) === (r.mediana === null && r.media === null), {
    message: "Mediana y media son nulas sólo cuando no hay datos",
  });

// ----------------------------------------------------------------- embudo

/**
 * Una etapa del embudo. `alcanzaron` cuenta las postulaciones que tienen la
 * fecha de la etapa; `conversion`, las que llegaron aquí sobre las que
 * alcanzaron la anterior (nula en la primera o si la anterior no tiene
 * ninguna). `siguen` son las que están ahora en esta etapa sin decisión: bajan
 * la conversión mientras el proceso sigue abierto. Los rechazos se cuentan en
 * la etapa en que estaba la postulación; los automáticos, al cerrar la oferta,
 * van aparte porque no son una decisión del equipo sobre el candidato.
 * `diasEnEtapa` son días transcurridos hasta la etapa siguiente o el rechazo
 * del equipo; las que siguen en la etapa y los rechazos automáticos no cuentan.
 */
export const etapaEmbudoSchema = z.object({
  etapa: z.enum(ETAPAS_EMBUDO),
  alcanzaron: entero,
  conversion: fraccion.nullable(),
  siguen: entero,
  rechazadas: entero,
  rechazadasAlCerrar: entero,
  diasEnEtapa: resumenDiasSchema,
});

export const embudoSchema = z.object({
  /** Postulaciones del embudo: todas las de las ofertas publicadas. */
  postulaciones: entero,
  /** Una por cada etapa de `ETAPAS_EMBUDO`, en ese orden. */
  etapas: z.array(etapaEmbudoSchema).length(ETAPAS_EMBUDO.length),
  /** Postulaciones aceptadas («coincidencias exitosas» del Cuadro II). */
  coincidenciasExitosas: entero,
});

/**
 * Una oferta publicada con sus tiempos, en días naturales:
 * - `diasHastaCubrir`: de `publicadaEn` a la primera `aceptadaEn`, sólo en
 *   ofertas `CUBIERTA` (mide H1). No se usa `cerradaEn` porque el equipo puede
 *   tardar en marcarla como cubierta.
 * - `diasHastaPrimerTryout`: de `publicadaEn` a la primera `entrevistaEn`, en
 *   cualquier oferta publicada que haya llegado a un tryout («encontrar
 *   candidatos» del Cuadro II).
 * - `diasAbierta`: de `publicadaEn` a hoy, sólo en ofertas `ABIERTA`, que aún
 *   no tienen tiempo hasta cubrirla.
 */
export const ofertaAnaliticaSchema = z.object({
  id: idSchema,
  titulo: z.string(),
  rol: z.enum(POSICIONES_LOL),
  estado: z.enum(ESTADOS_OFERTA).exclude(["BORRADOR"]),
  publicadaEn: z.coerce.date(),
  cerradaEn: z.coerce.date().nullable(),
  postulaciones: entero,
  diasHastaCubrir: entero.nullable(),
  diasHastaPrimerTryout: entero.nullable(),
  diasAbierta: entero.nullable(),
});

/** RF-13 · Embudo de una oferta del equipo: `GET /analitica/ofertas/:id/embudo`. */
export const embudoOfertaSchema = z.object({
  oferta: ofertaAnaliticaSchema,
  embudo: embudoSchema,
  /** Momento del cálculo: `diasAbierta` depende de él. */
  calculadoEn: z.coerce.date(),
});

/**
 * RF-13 · Embudo agregado de todas las ofertas publicadas del equipo, con los
 * tiempos que miden H1: `GET /analitica/embudo`.
 */
export const embudoEquipoSchema = z.object({
  embudo: embudoSchema,
  /** Sobre las ofertas `CUBIERTA` con una postulación aceptada. */
  diasHastaCubrir: resumenDiasSchema,
  /** Sobre las ofertas publicadas que llegaron a un tryout. */
  diasHastaPrimerTryout: resumenDiasSchema,
  cobertura: z.object({
    abiertas: entero,
    cubiertas: entero,
    cerradasSinCubrir: entero,
    /** cubiertas / (cubiertas + cerradasSinCubrir); nula si ninguna ha terminado. */
    tasa: fraccion.nullable(),
  }),
  /** Ofertas publicadas, de la más reciente a la más antigua. */
  ofertas: z.array(ofertaAnaliticaSchema),
  calculadoEn: z.coerce.date(),
});

// ----------------------------------------------------- dimensión decisiva

const dimensionVisible = z
  .enum(DIMENSIONES_MATCHING as [DimensionMatching, ...DimensionMatching[]])
  .refine((d) => DIMENSIONES_VISIBLES.includes(d), {
    message: "Sólo dimensiones visibles (DIMENSIONES_VISIBLES)",
  });

/**
 * Ventaja de una dimensión: aporte medio (wₖ·dₖ) de los primeros menos el del
 * resto. Puede ser negativa: la dimensión juega en contra de los primeros.
 * `otras` agrupa las dimensiones sin datos del piloto, sólo si alguna tiene
 * peso, para que las ventajas sumen la diferencia de puntaje medio.
 */
export const ventajaDimensionSchema = z.object({
  dimension: z.union([dimensionVisible, z.literal("otras")]),
  peso: fraccion,
  aporteMedioTop: fraccion,
  aporteMedioResto: fraccion,
  ventaja: z.number().min(-1).max(1),
});

/**
 * RF-13 · Qué dimensión decide el ranking de una oferta:
 * `GET /analitica/ofertas/:id/dimension-decisiva`. Compara los
 * `TOP_DIMENSION_DECISIVA` primeros del ranking vigente con el resto; con menos
 * de `MIN_CANDIDATOS_DIMENSION_DECISIVA` candidatos, `suficiente` es falso y no
 * hay cálculo. `decisiva` es la dimensión visible de mayor ventaja positiva.
 */
export const dimensionDecisivaSchema = z
  .object({
    ofertaId: idSchema,
    candidatos: entero,
    top: entero,
    suficiente: z.boolean(),
    puntajeMedioTop: fraccion.nullable(),
    puntajeMedioResto: fraccion.nullable(),
    /** puntajeMedioTop − puntajeMedioResto; es la suma de las ventajas. */
    ventajaTotal: z.number().min(0).max(1).nullable(),
    /** Ordenadas de mayor a menor ventaja; vacía si no es suficiente. */
    dimensiones: z.array(ventajaDimensionSchema),
    decisiva: dimensionVisible.nullable(),
    /** Cálculo del ranking del que sale. */
    calculadoEn: z.coerce.date(),
    versionFormulas: z.number().int().positive(),
  })
  .refine((d) => d.suficiente || (d.dimensiones.length === 0 && d.decisiva === null), {
    message: "Sin candidatos suficientes no hay ventajas ni dimensión decisiva",
  });

// ------------------------------------------------------- mapa del talento

/**
 * Celda del mapa: número de jugadores, o `null` si se oculta por privacidad
 * (menos de `UMBRAL_PRIVACIDAD_ANALITICA`, o supresión secundaria).
 */
export const celdaTalentoSchema = entero.nullable();

/** Una fila de la comparación Caribe frente al resto, por posición y por banda de rango. */
export const grupoTalentoSchema = z.object({
  grupo: z.enum(GRUPOS_TALENTO),
  total: celdaTalentoSchema,
  /** Posición más jugada en la última captura verificada. */
  porPosicion: z.object(
    Object.fromEntries(POSICIONES_LOL.map((p) => [p, celdaTalentoSchema])) as Record<
      (typeof POSICIONES_LOL)[number],
      typeof celdaTalentoSchema
    >,
  ),
  /** `SIN_RANGO`: verificados sin rango en solo/dúo. */
  porBanda: z.object(
    Object.fromEntries([...BANDAS_RANGO, "SIN_RANGO"].map((b) => [b, celdaTalentoSchema])) as Record<
      BandaRango | "SIN_RANGO",
      typeof celdaTalentoSchema
    >,
  ),
});

/**
 * Una macrorregión con sus departamentos. Sólo conteos, sin cruzar con
 * posición ni rango; los departamentos con menos del umbral se agrupan en
 * `OTROS`.
 */
export const macrorregionTalentoSchema = z.object({
  macrorregion: z.enum(MACROREGIONES),
  total: celdaTalentoSchema,
  departamentos: z.array(
    z.object({
      departamento: z.union([z.enum(DEPARTAMENTOS), z.literal("OTROS")]),
      jugadores: celdaTalentoSchema,
    }),
  ),
});

/**
 * RF-13 · Mapa del talento verificado: `GET /analitica/talento`. Cuenta los
 * jugadores con cuenta de Riot verificada (y su última captura), por
 * macrorregión y departamento, y compara el Caribe con el resto de Colombia.
 */
export const talentoVerificadoSchema = z.object({
  jugadoresRegistrados: entero,
  verificados: entero,
  /** verificados / jugadoresRegistrados (H2, Cuadro II); nula sin jugadores. */
  proporcionVerificados: fraccion.nullable(),
  /** El umbral con que se ocultaron las celdas. */
  umbral: z.number().int().positive(),
  /** CARIBE y RESTO_COLOMBIA, en ese orden. */
  grupos: z.array(grupoTalentoSchema).length(GRUPOS_TALENTO.length),
  macrorregiones: z.array(macrorregionTalentoSchema),
  fueraDeColombia: celdaTalentoSchema,
  sinUbicacion: celdaTalentoSchema,
  calculadoEn: z.coerce.date(),
});

export const ofertaAnaliticaParamsSchema = z.object({ id: idSchema });

export type ResumenDiasRespuesta = z.infer<typeof resumenDiasSchema>;
export type EtapaEmbudoRespuesta = z.infer<typeof etapaEmbudoSchema>;
export type Embudo = z.infer<typeof embudoSchema>;
export type OfertaAnalitica = z.infer<typeof ofertaAnaliticaSchema>;
export type EmbudoOferta = z.infer<typeof embudoOfertaSchema>;
export type EmbudoEquipo = z.infer<typeof embudoEquipoSchema>;
export type VentajaDimension = z.infer<typeof ventajaDimensionSchema>;
export type DimensionDecisiva = z.infer<typeof dimensionDecisivaSchema>;
export type CeldaTalento = z.infer<typeof celdaTalentoSchema>;
export type GrupoTalentoRespuesta = z.infer<typeof grupoTalentoSchema>;
export type MacrorregionTalento = z.infer<typeof macrorregionTalentoSchema>;
export type TalentoVerificado = z.infer<typeof talentoVerificadoSchema>;
