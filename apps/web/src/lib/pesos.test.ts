import { describe, expect, it } from 'vitest'
import {
  DIMENSIONES_MATCHING,
  DIMENSIONES_SIN_DATOS_PILOTO,
  PESOS_MATCHING,
  pesosMatchingSchema,
} from '@proplay/shared'
import {
  DIMENSIONES_VISIBLES,
  aFracciones,
  aPorcentajes,
  reajustarPesos,
  redondear,
  type Porcentajes,
} from '@/lib/pesos'

const suma = (p: Porcentajes) => DIMENSIONES_MATCHING.reduce((total, d) => total + p[d], 0)
const ocultasEnCero = (p: Porcentajes) => DIMENSIONES_SIN_DATOS_PILOTO.every((d) => p[d] === 0)
// Reparto de partida con las tres visibles distintas, para que se vea la proporción.
const BASE: Porcentajes = {
  tecnica: 40,
  experiencia: 0,
  habilidadesBlandas: 0,
  geografica: 35,
  disponibilidad: 25,
}

describe('dimensiones visibles (RF-09)', () => {
  it('son las de la ecuación sin las que no tienen datos en el piloto, en su orden', () => {
    expect(DIMENSIONES_VISIBLES).toEqual(
      DIMENSIONES_MATCHING.filter((d) => !(DIMENSIONES_SIN_DATOS_PILOTO as readonly string[]).includes(d)),
    )
    expect(DIMENSIONES_VISIBLES).toEqual(['tecnica', 'geografica', 'disponibilidad'])
  })
})

describe('deslizadores de pesos (RF-09)', () => {
  it('los pesos por defecto del piloto se muestran como 50/25/25', () => {
    expect(redondear(aPorcentajes(PESOS_MATCHING))).toEqual({
      tecnica: 50,
      experiencia: 0,
      habilidadesBlandas: 0,
      geografica: 25,
      disponibilidad: 25,
    })
  })

  it('al subir una dimensión, las otras visibles bajan en proporción y las ocultas siguen en 0', () => {
    const p = redondear(reajustarPesos(BASE, 'tecnica', 70))
    expect(p.tecnica).toBe(70)
    expect(suma(p)).toBe(100)
    // 30 puntos entre 35/25 → 17,5/12,5: el resto mayor desempata por el orden de la ecuación.
    expect(p).toMatchObject({ geografica: 18, disponibilidad: 12 })
    expect(ocultasEnCero(p)).toBe(true)
  })

  it('mover paso a paso (teclado) conserva la proporción entre las demás', () => {
    let p = BASE
    for (let valor = 41; valor <= 52; valor++) p = reajustarPesos(p, 'tecnica', valor)
    // 48 puntos entre 35/25 → 28/20.
    expect(redondear(p)).toMatchObject({ tecnica: 52, geografica: 28, disponibilidad: 20 })
    for (let valor = 51; valor >= 40; valor--) p = reajustarPesos(p, 'tecnica', valor)
    expect(redondear(p)).toEqual(BASE)
  })

  it('al bajar una dimensión a 0, su peso se reparte entre las otras visibles', () => {
    const p = redondear(reajustarPesos(BASE, 'geografica', 0))
    expect(p.geografica).toBe(0)
    expect(suma(p)).toBe(100)
    expect(p.tecnica).toBeGreaterThan(40)
    expect(ocultasEnCero(p)).toBe(true)
  })

  it('con las demás en 0, reparte el resto por igual entre las visibles', () => {
    const todoTecnica = reajustarPesos(BASE, 'tecnica', 100)
    expect(redondear(reajustarPesos(todoTecnica, 'tecnica', 60))).toEqual({
      tecnica: 60,
      experiencia: 0,
      habilidadesBlandas: 0,
      geografica: 20,
      disponibilidad: 20,
    })
  })

  it('acota a 0..100 y el redondeo suma siempre 100 con cualquier secuencia', () => {
    let p = BASE
    const pasos: [keyof Porcentajes, number][] = [
      ['tecnica', 140], ['geografica', -5], ['disponibilidad', 33], ['geografica', 7],
      ['tecnica', 1], ['disponibilidad', 99],
    ]
    for (const [d, v] of pasos) {
      p = reajustarPesos(p, d, v)
      const enteros = redondear(p)
      expect(suma(enteros)).toBe(100)
      expect(ocultasEnCero(enteros)).toBe(true)
      expect(DIMENSIONES_MATCHING.every((dim) => enteros[dim] >= 0 && enteros[dim] <= 100)).toBe(true)
    }
  })

  it('las fracciones resultantes cumplen el contrato (suman 1) con las ocultas en 0', () => {
    const fracciones = aFracciones(reajustarPesos(BASE, 'disponibilidad', 33))
    expect(pesosMatchingSchema.safeParse(fracciones).success).toBe(true)
    expect(fracciones.experiencia).toBe(0)
    expect(fracciones.habilidadesBlandas).toBe(0)
  })

  it('pesos guardados con decimales se muestran en enteros que suman 100', () => {
    const p = aPorcentajes({ tecnica: 0.333, experiencia: 0, habilidadesBlandas: 0, geografica: 0.333, disponibilidad: 0.334 })
    expect(suma(redondear(p))).toBe(100)
  })

  it('una oferta antigua con peso en dimensiones ocultas lo reparte entre las visibles', () => {
    // 0,35/0,15/0,15 de las visibles sobre 0,65 → 54/23/23.
    const p = redondear(
      aPorcentajes({ tecnica: 0.35, experiencia: 0.2, habilidadesBlandas: 0.15, geografica: 0.15, disponibilidad: 0.15 }),
    )
    expect(p).toEqual({ tecnica: 54, experiencia: 0, habilidadesBlandas: 0, geografica: 23, disponibilidad: 23 })
  })
})
