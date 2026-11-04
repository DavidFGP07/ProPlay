import { DIMENSIONES_MATCHING, type DimensionMatching, type PesosMatching } from '@proplay/shared'

/**
 * Pesos de la oferta en porcentajes (0..100) que suman 100. El estado de los
 * deslizadores guarda los valores exactos, con decimales, para que mover una
 * dimensión muchas veces seguidas (paso a paso con el teclado) conserve la
 * proporción entre las demás. Se redondean a enteros sólo para mostrarlos y
 * enviarlos (`redondear`), sin perder ni sobrar un punto.
 */
export type Porcentajes = Record<DimensionMatching, number>

const TOTAL = 100

/** Reparte `total` en proporción a `bases`; si todas son 0, por igual. */
function proporcional(bases: number[], total: number): number[] {
  const suma = bases.reduce((a, b) => a + b, 0)
  return bases.map((base) => (suma > 0 ? (base / suma) * total : total / bases.length))
}

/**
 * Enteros que suman exactamente 100 (método del resto mayor): los que más
 * pierden al truncar reciben primero el punto que falta; a igualdad, en el
 * orden de la ecuación, para que el resultado sea estable.
 */
export function redondear(pesos: Porcentajes): Porcentajes {
  const exactos = proporcional(DIMENSIONES_MATCHING.map((d) => pesos[d]), TOTAL)
  const enteros = exactos.map(Math.floor)
  let faltan = TOTAL - enteros.reduce((a, b) => a + b, 0)
  const orden = exactos
    .map((exacto, i) => ({ i, resto: exacto - enteros[i]! }))
    .sort((a, b) => b.resto - a.resto || a.i - b.i)
  for (const { i } of orden) {
    if (faltan === 0) break
    enteros[i]! += 1
    faltan -= 1
  }
  return Object.fromEntries(DIMENSIONES_MATCHING.map((d, i) => [d, enteros[i]!])) as Porcentajes
}

/**
 * Fija una dimensión en `valor` (entero entre 0 y 100) y reparte el resto
 * entre las demás en proporción exacta a sus pesos actuales.
 */
export function reajustarPesos(
  actuales: Porcentajes,
  dimension: DimensionMatching,
  valor: number,
): Porcentajes {
  const fijo = Math.min(TOTAL, Math.max(0, Math.round(valor)))
  const otras = DIMENSIONES_MATCHING.filter((d) => d !== dimension)
  const repartidos = proporcional(otras.map((d) => actuales[d]), TOTAL - fijo)
  return {
    ...actuales,
    ...Object.fromEntries(otras.map((d, i) => [d, repartidos[i]!])),
    [dimension]: fijo,
  }
}

/** Pesos del contrato (fracciones) a porcentajes. */
export function aPorcentajes(pesos: PesosMatching): Porcentajes {
  return Object.fromEntries(DIMENSIONES_MATCHING.map((d) => [d, pesos[d] * TOTAL])) as Porcentajes
}

/** Porcentajes a las fracciones que valida `pesosMatchingSchema`, ya redondeados. */
export function aFracciones(porcentajes: Porcentajes): PesosMatching {
  const enteros = redondear(porcentajes)
  return Object.fromEntries(
    DIMENSIONES_MATCHING.map((d) => [d, enteros[d] / TOTAL]),
  ) as PesosMatching
}
