import {
  DIMENSIONES_MATCHING,
  DIMENSIONES_SIN_DATOS_PILOTO,
  type DimensionMatching,
  type PesosMatching,
} from '@proplay/shared'

/**
 * Pesos de la oferta en porcentajes (0..100) que suman 100. El estado de los
 * deslizadores guarda los valores exactos, con decimales, para que mover una
 * dimensión muchas veces seguidas (paso a paso con el teclado) conserve la
 * proporción entre las demás. Se redondean a enteros sólo para mostrarlos y
 * enviarlos (`redondear`), sin perder ni sobrar un punto.
 *
 * Las dimensiones sin datos en el piloto (`DIMENSIONES_SIN_DATOS_PILOTO`) no
 * se muestran y valen siempre 0: el 100 % se reparte entre las visibles.
 */
export type Porcentajes = Record<DimensionMatching, number>

const TOTAL = 100

const SIN_DATOS: readonly DimensionMatching[] = DIMENSIONES_SIN_DATOS_PILOTO

/**
 * Dimensiones que ve el usuario, en el orden de la ecuación (1). Las vistas
 * (deslizadores, pesos de la oferta, desglose del ranking) iteran sobre esta
 * lista, nunca sobre una fija.
 */
export const DIMENSIONES_VISIBLES: readonly DimensionMatching[] = DIMENSIONES_MATCHING.filter(
  (d) => !SIN_DATOS.includes(d),
)

/** Reparte `total` en proporción a `bases`; si todas son 0, por igual. */
function proporcional(bases: number[], total: number): number[] {
  const suma = bases.reduce((a, b) => a + b, 0)
  return bases.map((base) => (suma > 0 ? (base / suma) * total : total / bases.length))
}

/** Completa con 0 las dimensiones ocultas. */
function conOcultasEnCero(visibles: Partial<Porcentajes>): Porcentajes {
  return Object.fromEntries(
    DIMENSIONES_MATCHING.map((d) => [d, DIMENSIONES_VISIBLES.includes(d) ? (visibles[d] ?? 0) : 0]),
  ) as Porcentajes
}

/**
 * Enteros que suman exactamente 100 entre las dimensiones visibles (método del
 * resto mayor): los que más pierden al truncar reciben primero el punto que
 * falta; a igualdad, en el orden de la ecuación, para que el resultado sea
 * estable. Las ocultas quedan en 0.
 */
export function redondear(pesos: Porcentajes): Porcentajes {
  const exactos = proporcional(DIMENSIONES_VISIBLES.map((d) => pesos[d]), TOTAL)
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
  return conOcultasEnCero(Object.fromEntries(DIMENSIONES_VISIBLES.map((d, i) => [d, enteros[i]!])))
}

/**
 * Fija una dimensión visible en `valor` (entero entre 0 y 100) y reparte el
 * resto entre las demás visibles en proporción exacta a sus pesos actuales.
 */
export function reajustarPesos(
  actuales: Porcentajes,
  dimension: DimensionMatching,
  valor: number,
): Porcentajes {
  const fijo = Math.min(TOTAL, Math.max(0, Math.round(valor)))
  const otras = DIMENSIONES_VISIBLES.filter((d) => d !== dimension)
  const repartidos = proporcional(otras.map((d) => actuales[d]), TOTAL - fijo)
  return conOcultasEnCero({
    ...Object.fromEntries(otras.map((d, i) => [d, repartidos[i]!])),
    [dimension]: fijo,
  })
}

/**
 * Pesos del contrato (fracciones) a porcentajes de las dimensiones visibles.
 * Una oferta guardada con peso en una dimensión oculta (anterior a los pesos
 * del piloto) se reparte en proporción entre las visibles: así los
 * deslizadores suman 100 % y, al guardar, la oferta queda con las ocultas en 0.
 */
export function aPorcentajes(pesos: PesosMatching): Porcentajes {
  const exactos = proporcional(DIMENSIONES_VISIBLES.map((d) => pesos[d]), TOTAL)
  return conOcultasEnCero(Object.fromEntries(DIMENSIONES_VISIBLES.map((d, i) => [d, exactos[i]!])))
}

/** Porcentajes a las fracciones que valida `pesosMatchingSchema`, ya redondeados. */
export function aFracciones(porcentajes: Porcentajes): PesosMatching {
  const enteros = redondear(porcentajes)
  return Object.fromEntries(
    DIMENSIONES_MATCHING.map((d) => [d, enteros[d] / TOTAL]),
  ) as PesosMatching
}
