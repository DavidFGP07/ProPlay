import { describe, expect, it } from 'vitest'
import { DIMENSIONES_MATCHING, PESOS_MATCHING, pesosMatchingSchema } from '@proplay/shared'
import {
  aFracciones,
  aPorcentajes,
  reajustarPesos,
  redondear,
  type Porcentajes,
} from '@/lib/pesos'

const suma = (p: Porcentajes) => DIMENSIONES_MATCHING.reduce((total, d) => total + p[d], 0)
// Las pruebas del reparto usan pesos con las cinco dimensiones activas, para
// que se vea la proporción; las de los valores por defecto, PESOS_MATCHING.
const POR_DEFECTO: Porcentajes = {
  tecnica: 35,
  experiencia: 20,
  habilidadesBlandas: 15,
  geografica: 15,
  disponibilidad: 15,
}

describe('deslizadores de pesos (RF-09)', () => {
  it('los pesos por defecto del piloto se muestran como 50/0/0/25/25', () => {
    expect(redondear(aPorcentajes(PESOS_MATCHING))).toEqual({
      tecnica: 50,
      experiencia: 0,
      habilidadesBlandas: 0,
      geografica: 25,
      disponibilidad: 25,
    })
  })

  it('al subir una dimensión, las demás bajan en proporción y la suma sigue en 100', () => {
    const p = redondear(reajustarPesos(POR_DEFECTO, 'tecnica', 61))
    expect(p.tecnica).toBe(61)
    expect(suma(p)).toBe(100)
    // 39 puntos entre 20/15/15/15 → 12/9/9/9 en proporción.
    expect(p).toMatchObject({ experiencia: 12, habilidadesBlandas: 9, geografica: 9, disponibilidad: 9 })
  })

  it('mover paso a paso (teclado) conserva la proporción entre las demás', () => {
    let p = POR_DEFECTO
    for (let valor = 36; valor <= 40; valor++) p = reajustarPesos(p, 'tecnica', valor)
    // 60 puntos entre 20/15/15/15 → 18,46/13,85…: la experiencia no se erosiona.
    expect(redondear(p)).toEqual({
      tecnica: 40,
      experiencia: 18,
      habilidadesBlandas: 14,
      geografica: 14,
      disponibilidad: 14,
    })
    // Y volver atrás deja los valores de partida.
    for (let valor = 39; valor >= 35; valor--) p = reajustarPesos(p, 'tecnica', valor)
    expect(redondear(p)).toEqual(redondear(POR_DEFECTO))
  })

  it('al bajar una dimensión a 0, su peso se reparte entre las demás', () => {
    const p = redondear(reajustarPesos(POR_DEFECTO, 'geografica', 0))
    expect(p.geografica).toBe(0)
    expect(suma(p)).toBe(100)
    expect(p.tecnica).toBeGreaterThan(35)
  })

  it('con las demás en 0, reparte el resto por igual', () => {
    const todoTecnica = reajustarPesos(POR_DEFECTO, 'tecnica', 100)
    expect(redondear(reajustarPesos(todoTecnica, 'tecnica', 60))).toEqual({
      tecnica: 60,
      experiencia: 10,
      habilidadesBlandas: 10,
      geografica: 10,
      disponibilidad: 10,
    })
  })

  it('acota a 0..100 y el redondeo suma siempre 100 con cualquier secuencia', () => {
    let p = POR_DEFECTO
    const pasos: [keyof Porcentajes, number][] = [
      ['tecnica', 140], ['experiencia', -5], ['disponibilidad', 33], ['geografica', 7],
      ['habilidadesBlandas', 51], ['tecnica', 1], ['experiencia', 99],
    ]
    for (const [d, v] of pasos) {
      p = reajustarPesos(p, d, v)
      const enteros = redondear(p)
      expect(suma(enteros)).toBe(100)
      expect(DIMENSIONES_MATCHING.every((dim) => enteros[dim] >= 0 && enteros[dim] <= 100)).toBe(true)
    }
  })

  it('las fracciones resultantes cumplen el contrato (suman 1)', () => {
    const p = reajustarPesos(POR_DEFECTO, 'habilidadesBlandas', 33)
    expect(pesosMatchingSchema.safeParse(aFracciones(p)).success).toBe(true)
  })

  it('pesos guardados con decimales se muestran en enteros que suman 100', () => {
    const p = aPorcentajes({ tecnica: 0.333, experiencia: 0.333, habilidadesBlandas: 0.334, geografica: 0, disponibilidad: 0 })
    expect(suma(redondear(p))).toBe(100)
  })
})
