import { describe, expect, it } from 'vitest'
import { PESOS_MATCHING, type CandidatoRanking, type PesosMatching } from '@proplay/shared'
import { calcularAportes } from '@/lib/aportes'

/**
 * RF-09 · Aportes de cada dimensión al puntaje: lo que pinta la barra del
 * ranking. La suma de los puntos tiene que ser siempre el total mostrado.
 */

type Entrada = Pick<CandidatoRanking, 'puntaje' | 'desglose' | 'explicacion'>

function candidato(
  desglose: CandidatoRanking['desglose'],
  pesos: PesosMatching = { ...PESOS_MATCHING },
): Entrada {
  const puntaje = (Object.keys(pesos) as (keyof PesosMatching)[]).reduce(
    (suma, d) => suma + pesos[d] * desglose[d],
    0,
  )
  return {
    puntaje,
    desglose,
    explicacion: { pesos, dimensiones: {} as CandidatoRanking['explicacion']['dimensiones'] },
  }
}

const suma = (puntos: number[]) => puntos.reduce((a, b) => a + b, 0)

/** Generador determinista (mulberry32). */
function aleatorio(semilla: number) {
  let a = semilla >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('calcularAportes', () => {
  it('cada aporte es peso × valor y sólo salen las dimensiones visibles', () => {
    const { aportes, total } = calcularAportes(
      candidato({ tecnica: 0.8, experiencia: 0, habilidadesBlandas: 0, geografica: 1, disponibilidad: 0.5 }),
    )
    expect(aportes.map((a) => a.clave)).toEqual(['tecnica', 'geografica', 'disponibilidad'])
    expect(aportes.map((a) => a.puntos)).toEqual([40, 25, 13])
    // 0,5·0,8 + 0,25·1 + 0,25·0,5 = 0,775 → 78 %: el medio punto va a quien más resto tenía.
    expect(total).toBe(78)
    expect(suma(aportes.map((a) => a.puntos))).toBe(total)
    expect(aportes[0]).toMatchObject({ valor: 0.8, peso: 0.5 })
    expect(aportes[0]!.aporte).toBeCloseTo(0.4, 10)
  })

  it('los puntos suman exactamente el total mostrado en 2.000 casos aleatorios', () => {
    const r = aleatorio(20261110)
    for (let i = 0; i < 2000; i++) {
      // Pesos enteros que suman 100 entre las tres dimensiones visibles.
      const a = Math.floor(r() * 101)
      const b = Math.floor(r() * (101 - a))
      const pesos: PesosMatching = {
        tecnica: a / 100,
        experiencia: 0,
        habilidadesBlandas: 0,
        geografica: b / 100,
        disponibilidad: (100 - a - b) / 100,
      }
      const entrada = candidato(
        { tecnica: r(), experiencia: 0, habilidadesBlandas: 0, geografica: r(), disponibilidad: r() },
        pesos,
      )
      const { aportes, total } = calcularAportes(entrada)
      expect(total).toBe(Math.round(entrada.puntaje * 100))
      expect(suma(aportes.map((x) => x.puntos))).toBe(total)
      for (const x of aportes) {
        expect(x.puntos).toBeGreaterThanOrEqual(0)
        // Ningún aporte se aleja más de un punto de su valor exacto.
        expect(Math.abs(x.puntos - x.aporte * 100)).toBeLessThan(1)
      }
    }
  })

  it('valores exactos no pierden un punto por la coma flotante', () => {
    // 0,6 × 0,7 = 0,42 se guarda como 0,41999…: tiene que seguir siendo 42.
    const { aportes, total } = calcularAportes(
      candidato(
        { tecnica: 0.7, experiencia: 0, habilidadesBlandas: 0, geografica: 0, disponibilidad: 0.75 },
        { tecnica: 0.6, experiencia: 0, habilidadesBlandas: 0, geografica: 0, disponibilidad: 0.4 },
      ),
    )
    expect(aportes.map((a) => a.puntos)).toEqual([42, 0, 30])
    expect(total).toBe(72)
  })

  it('un candidato con todo en 0 no reparte nada', () => {
    const { aportes, total } = calcularAportes(
      candidato({ tecnica: 0, experiencia: 0, habilidadesBlandas: 0, geografica: 0, disponibilidad: 0 }),
    )
    expect(total).toBe(0)
    expect(aportes.every((a) => a.puntos === 0)).toBe(true)
  })

  it('con peso en una dimensión oculta que puntúa, el resto va en «otras» y la suma se mantiene', () => {
    const pesos: PesosMatching = {
      tecnica: 0.4,
      experiencia: 0,
      habilidadesBlandas: 0.2,
      geografica: 0.2,
      disponibilidad: 0.2,
    }
    const { aportes, total } = calcularAportes(
      candidato({ tecnica: 0.5, experiencia: 0, habilidadesBlandas: 1, geografica: 1, disponibilidad: 1 }, pesos),
    )
    expect(aportes.map((a) => a.clave)).toEqual(['tecnica', 'geografica', 'disponibilidad', 'otras'])
    expect(aportes.map((a) => a.puntos)).toEqual([20, 20, 20, 20])
    expect(aportes[3]).toMatchObject({ valor: null, peso: null })
    expect(total).toBe(80)
  })

  it('usa los pesos que aplicó el motor (los de la explicación)', () => {
    const entrada = candidato(
      { tecnica: 1, experiencia: 0, habilidadesBlandas: 0, geografica: 0, disponibilidad: 0 },
      { tecnica: 1, experiencia: 0, habilidadesBlandas: 0, geografica: 0, disponibilidad: 0 },
    )
    expect(calcularAportes(entrada).aportes.map((a) => a.puntos)).toEqual([100, 0, 0])
  })
})
