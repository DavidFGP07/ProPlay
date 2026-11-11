import type { CandidatoRanking, DimensionMatching } from '@proplay/shared'
import { DIMENSIONES_VISIBLES } from '@/lib/pesos'

/**
 * RF-09 · De dónde sale el puntaje de un candidato: el aporte de cada
 * dimensión es su peso por su valor (wₖ·dₖ), y la suma de los aportes es el
 * puntaje (ecuación (1)). Aquí se pasan a puntos porcentuales enteros que
 * suman exactamente el puntaje que se muestra.
 */

/** Las dimensiones visibles o el resto que aportan las ocultas (`otras`). */
export type ClaveAporte = DimensionMatching | 'otras'

export interface Aporte {
  clave: ClaveAporte
  /** Valor de la dimensión, dₖ, entre 0 y 1. Nulo en `otras`. */
  valor: number | null
  /** Peso aplicado por el motor, wₖ, entre 0 y 1. Nulo en `otras`. */
  peso: number | null
  /** Aporte exacto al puntaje, wₖ·dₖ, entre 0 y 1. */
  aporte: number
  /** Aporte en puntos porcentuales enteros: los de todos suman `total`. */
  puntos: number
}

export interface DesgloseAportes {
  aportes: Aporte[]
  /** Puntaje en puntos porcentuales enteros: lo que se muestra como «72 %». */
  total: number
}

/** Margen por debajo del cual el resto de las dimensiones ocultas es ruido de coma flotante. */
const RESTO_DESPRECIABLE = 1e-9

/** Fracción (0..1) a porcentaje entero. */
export function aPorcentaje(fraccion: number): number {
  return Math.round(fraccion * 100)
}

/**
 * Aportes de las dimensiones visibles con los pesos que aplicó el motor
 * (`explicacion.pesos`, no los de la oferta de ahora: un ranking ya calculado
 * se explica con lo que se usó). Si la oferta tiene peso en una dimensión
 * oculta que puntúa, lo que aporta va en `otras`, para que la suma siga siendo
 * el puntaje.
 *
 * Los puntos se reparten por el método del resto mayor, como los pesos de la
 * oferta (`lib/pesos.ts`): se trunca cada aporte y los puntos que faltan hasta
 * el total redondeado van a los que más perdieron al truncar; a igualdad, en
 * el orden de la ecuación.
 */
export function calcularAportes(
  candidato: Pick<CandidatoRanking, 'puntaje' | 'desglose' | 'explicacion'>,
): DesgloseAportes {
  const { puntaje, desglose, explicacion } = candidato
  const visibles = DIMENSIONES_VISIBLES.map((clave) => ({
    clave: clave as ClaveAporte,
    valor: desglose[clave] as number | null,
    peso: explicacion.pesos[clave] as number | null,
    aporte: explicacion.pesos[clave] * desglose[clave],
  }))
  const resto = puntaje - visibles.reduce((suma, a) => suma + a.aporte, 0)
  const partes =
    resto > RESTO_DESPRECIABLE
      ? [...visibles, { clave: 'otras' as ClaveAporte, valor: null, peso: null, aporte: resto }]
      : visibles

  const total = aPorcentaje(puntaje)
  const exactos = partes.map((p) => p.aporte * 100)
  const puntos = exactos.map((x) => Math.floor(x + RESTO_DESPRECIABLE))
  let faltan = total - puntos.reduce((a, b) => a + b, 0)
  const orden = exactos
    .map((exacto, i) => ({ i, resto: exacto - puntos[i]! }))
    .sort((a, b) => b.resto - a.resto || a.i - b.i)
  for (const { i } of orden) {
    if (faltan <= 0) break
    puntos[i]! += 1
    faltan -= 1
  }
  // Si el redondeo del total quedó por debajo de la suma truncada (sólo por
  // ruido de coma flotante), se quita el punto a quien menos resto tenía.
  for (const { i } of [...orden].reverse()) {
    if (faltan >= 0) break
    if (puntos[i]! === 0) continue
    puntos[i]! -= 1
    faltan += 1
  }

  return { aportes: partes.map((p, i) => ({ ...p, puntos: puntos[i]! })), total }
}
