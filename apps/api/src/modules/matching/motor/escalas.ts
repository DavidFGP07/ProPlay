import {
  POSICIONES_LOL,
  RANGOS_LOL,
  type MetricaTecnicaLol,
  type PosicionLol,
  type RangoLol,
} from "@proplay/shared";

/**
 * RF-09 · Escalas fijas de la dimensión técnica y sus subpesos.
 *
 * Cada métrica se normaliza a [0, 1] contra una escala fija `[suelo, techo]`
 * por posición, no contra percentiles del grupo del piloto: así el puntaje de
 * un jugador no cambia cuando otro sincroniza, se puede explicar y reproducir,
 * y es una métrica estandarizada (H2). La fuente o el razonamiento de cada
 * escala está en docs/arquitectura.md, «Escalas fijas de la técnica». Cambiar
 * una escala, una métrica de una posición o un subpeso exige subir
 * `VERSION_FORMULAS_MATCHING`.
 */

export interface Escala {
  suelo: number;
  techo: number;
}

/** Peso de cada parte de la técnica: d_tec = posición·0,25 + rango·0,35 + rendimiento·0,40. */
export const SUBPESOS_TECNICA = {
  posicion: 0.25,
  rango: 0.35,
  rendimiento: 0.4,
} as const;

/** Escala de cada métrica si la posición no tiene una propia. */
export const ESCALAS_POR_DEFECTO: Record<MetricaTecnicaLol, Escala> = {
  winRate: { suelo: 0.4, techo: 0.6 },
  kda: { suelo: 1, techo: 5 },
  csPorMinuto: { suelo: 4, techo: 9 },
  oroPorMinuto: { suelo: 300, techo: 500 },
  danoPorMinuto: { suelo: 300, techo: 900 },
  visionPorMinuto: { suelo: 0.5, techo: 2.5 },
  participacionKills: { suelo: 0.35, techo: 0.7 },
};

/** Escalas propias de una posición, donde su papel cambia el rango esperado. */
export const ESCALAS_POR_POSICION: Partial<
  Record<PosicionLol, Partial<Record<MetricaTecnicaLol, Escala>>>
> = {
  TOP: {
    danoPorMinuto: { suelo: 250, techo: 750 },
  },
  JUNGLA: {
    csPorMinuto: { suelo: 4, techo: 7 },
    visionPorMinuto: { suelo: 0.7, techo: 2.5 },
    participacionKills: { suelo: 0.45, techo: 0.8 },
  },
  SOPORTE: {
    kda: { suelo: 1.5, techo: 6 },
    visionPorMinuto: { suelo: 1, techo: 3.5 },
    participacionKills: { suelo: 0.45, techo: 0.8 },
  },
};

/**
 * Métricas que cuentan en el rendimiento de cada posición, con el mismo peso
 * entre ellas. El win rate y el KDA cuentan siempre; el resto, según el papel
 * de la posición (el soporte no farmea por diseño, el tirador vive del oro).
 */
export const METRICAS_POR_POSICION: Record<PosicionLol, readonly MetricaTecnicaLol[]> = {
  TOP: ["winRate", "kda", "csPorMinuto", "danoPorMinuto", "visionPorMinuto"],
  JUNGLA: ["winRate", "kda", "csPorMinuto", "participacionKills", "visionPorMinuto"],
  MID: ["winRate", "kda", "csPorMinuto", "danoPorMinuto", "participacionKills"],
  ADC: ["winRate", "kda", "csPorMinuto", "danoPorMinuto", "oroPorMinuto"],
  SOPORTE: ["winRate", "kda", "visionPorMinuto", "participacionKills"],
};

/**
 * El win rate de pocas partidas se encoge hacia el 50 %, como si se sumaran
 * `PARTIDAS_PREVIAS_WIN_RATE` partidas al 50 %: con 5 partidas al 80 % queda en
 * 60 %; con 20 al 60 %, en 56,7 %.
 */
export const PARTIDAS_PREVIAS_WIN_RATE = 10;

/** El rango llega a 0 cuando el jugador está esta cantidad de divisiones por debajo del mínimo (una liga). */
export const DIVISIONES_HASTA_CERO = 4;

/** Partidas de la temporada con las que el volumen del vector satura en 1. */
export const PARTIDAS_VOLUMEN_MAXIMO = 300;

export function escalaDe(metrica: MetricaTecnicaLol, posicion: PosicionLol | null): Escala {
  return (posicion && ESCALAS_POR_POSICION[posicion]?.[metrica]) || ESCALAS_POR_DEFECTO[metrica];
}

export function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function normalizar(valor: number, escala: Escala): number {
  return clamp01((valor - escala.suelo) / (escala.techo - escala.suelo));
}

/** Win rate encogido hacia el 50 % según el número de partidas. */
export function winRateAjustado(winRate: number, partidas: number): number {
  const n = Math.max(0, partidas);
  return (winRate * n + 0.5 * PARTIDAS_PREVIAS_WIN_RATE) / (n + PARTIDAS_PREVIAS_WIN_RATE);
}

/** Posición del rango en el catálogo ordenado: 0 (Hierro IV) a 30 (Retador). */
export function indiceRango(rango: RangoLol): number {
  return RANGOS_LOL.indexOf(rango);
}

export const INDICE_RANGO_MAXIMO = RANGOS_LOL.length - 1;

/**
 * Liga del rango, de 0 (Hierro) a 9 (Retador): siete ligas de cuatro
 * divisiones (Hierro a Diamante) y tres sin división.
 */
export const LIGAS_DEL_CATALOGO = 10;
export function indiceLiga(rango: RangoLol): number {
  const i = indiceRango(rango);
  return i < 28 ? Math.floor(i / 4) : 7 + (i - 28);
}

export const INDICE_POSICION: Record<PosicionLol, number> = Object.fromEntries(
  POSICIONES_LOL.map((p, i) => [p, i]),
) as Record<PosicionLol, number>;
