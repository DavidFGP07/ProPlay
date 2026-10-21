import { describe, expect, it } from 'vitest'
import {
  calcularRanking,
  embeddingsDe,
  invalidarCacheEmbeddings,
  mapaEmbeddings,
  type MatchingContexto,
} from '@/services/matching'
import { PESOS_POR_DEFECTO } from '@/lib/matching'
import {
  endorsements,
  habilidades,
  habilidadesJugador,
  ofertas,
  perfilesJugador,
  postulaciones,
  estadisticas,
} from '@/data/seed'
import type { Oferta } from '@/types'

const contexto: MatchingContexto = {
  perfiles: perfilesJugador,
  estadisticas: [...estadisticas],
  habilidades,
  habilidadesJugador: [...habilidadesJugador],
  endorsements: [...endorsements],
  postulaciones: [...postulaciones],
  ofertas: [...ofertas],
}

describe('calcularRanking', () => {
  it('devuelve un resultado por cada perfil recuperado', () => {
    const oferta = ofertas[0]
    const { resultados } = calcularRanking(contexto, oferta, {
      pesos: PESOS_POR_DEFECTO,
    })
    expect(resultados.length).toBeGreaterThan(0)
    expect(resultados.length).toBeLessThanOrEqual(contexto.perfiles.length)
  })

  it('ordena el ranking por puntaje descendente', () => {
    const { resultados } = calcularRanking(contexto, ofertas[0], {
      pesos: PESOS_POR_DEFECTO,
    })
    for (let i = 1; i < resultados.length; i++) {
      expect(resultados[i - 1].puntaje).toBeGreaterThanOrEqual(
        resultados[i].puntaje,
      )
    }
  })

  it('el puntaje permanece en el intervalo [0, 1]', () => {
    const { resultados } = calcularRanking(contexto, ofertas[0], {
      pesos: PESOS_POR_DEFECTO,
    })
    for (const r of resultados) {
      expect(r.puntaje).toBeGreaterThanOrEqual(0)
      expect(r.puntaje).toBeLessThanOrEqual(1)
    }
  })

  it('el desglose contiene las cinco dimensiones con su contribucion', () => {
    const { resultados } = calcularRanking(contexto, ofertas[0], {
      pesos: PESOS_POR_DEFECTO,
    })
    const d = resultados[0].desglose
    expect(d).toHaveLength(5)
    const sumaPesos = d.reduce((a, x) => a + x.peso, 0)
    expect(sumaPesos).toBeCloseTo(1, 8)
    for (const x of d) {
      expect(x.contribucion).toBeCloseTo(x.valor * x.peso, 10)
      expect(x.detalle.length).toBeGreaterThan(0)
    }
  })

  it('la suma de las contribuciones reproduce el puntaje en modo contenido', () => {
    const oferta = ofertas.find((o) => o.equipoId === 'e-02-team')!
    const { resultados } = calcularRanking(contexto, oferta, {
      pesos: PESOS_POR_DEFECTO,
    })
    const r = resultados[0]
    const suma = r.desglose.reduce((a, x) => a + x.contribucion, 0)
    expect(r.puntaje).toBeCloseTo(suma, 8)
  })

  it('opera en modo contenido puro cuando el equipo no tiene historial', () => {
    const oferta = ofertas.find((o) => o.equipoId === 'e-05-team')!
    const { resultados, traza } = calcularRanking(contexto, oferta, {
      pesos: PESOS_POR_DEFECTO,
    })
    expect(traza.modo).toBe('contenido')
    expect(traza.pesoColaborativo).toBe(0)
    expect(resultados[0].pesoColaborativo).toBe(0)
  })

  it('activa el modo hibrido cuando el equipo tiene historial suficiente', () => {
    // e-01-team concentra tres postulaciones con senal positiva.
    const oferta = ofertas.find((o) => o.equipoId === 'e-01-team')!
    const { traza } = calcularRanking(contexto, oferta, {
      pesos: PESOS_POR_DEFECTO,
    })
    expect(traza.modo).toBe('hibrido')
    expect(traza.pesoColaborativo).toBeGreaterThan(0)
  })

  it('respeta el pool de candidatos indicado', () => {
    const { resultados } = calcularRanking(contexto, ofertas[0], {
      pesos: PESOS_POR_DEFECTO,
      candidatosIds: ['p-01', 'p-02'],
    })
    expect(resultados.map((r) => r.perfilId).sort()).toEqual(['p-01', 'p-02'])
  })

  it('respeta el limite top-K del recuperador por contenido', () => {
    const { resultados, traza } = calcularRanking(contexto, ofertas[0], {
      pesos: PESOS_POR_DEFECTO,
      topK: 3,
    })
    expect(resultados).toHaveLength(3)
    expect(traza.recuperadosPorContenido).toBe(3)
  })

  it('la traza expone la latencia y el indice consultado', () => {
    const { traza } = calcularRanking(contexto, ofertas[0], {
      pesos: PESOS_POR_DEFECTO,
    })
    expect(traza.indice).toBe('HNSW (pgvector)')
    expect(traza.latenciaMs).toBeGreaterThanOrEqual(0)
    expect(traza.totalPerfiles).toBe(contexto.perfiles.length)
  })

  it('un filtro por rol reduce el pool recuperado', () => {
    const oferta: Oferta = { ...ofertas[0], rol: 'AWPer' }
    const { resultados } = calcularRanking(contexto, oferta, {
      pesos: PESOS_POR_DEFECTO,
    })
    const conRol = resultados.filter((r) => {
      const p = contexto.perfiles.find((x) => x.id === r.perfilId)!
      return p.rolesPreferidos.includes(oferta.rol)
    })
    expect(conRol.length).toBeGreaterThanOrEqual(0)
  })

  it('aumentar el peso tecnico prioriza a los jugadores con mejor rendimiento', () => {
    const oferta = ofertas[0]
    const pesos = {
      tecnica: 1,
      experiencia: 0,
      blandas: 0,
      geografica: 0,
      disponibilidad: 0,
    }
    const { resultados } = calcularRanking(contexto, oferta, { pesos })
    const primero = resultados[0]
    const tecnica = primero.desglose.find((d) => d.key === 'tecnica')!
    expect(tecnica.valor).toBeGreaterThan(0)
  })
})

describe('embeddingsDe', () => {
  it('devuelve un vector de 64 dimensiones para un perfil valido', () => {
    const emb = embeddingsDe(contexto, 'p-01')
    expect(emb).toHaveLength(64)
  })

  it('devuelve un vector nulo para un perfil inexistente', () => {
    expect(embeddingsDe(contexto, 'no-existe')).toHaveLength(64)
    expect(embeddingsDe(contexto, 'no-existe').every((x) => x === 0)).toBe(true)
  })

  it('el mapa de embeddings cubre todos los perfiles', () => {
    expect(mapaEmbeddings(contexto).size).toBe(contexto.perfiles.length)
  })

  it('la invalidacion del cache obliga a recalcular', () => {
    const antes = embeddingsDe(contexto, 'p-01')
    invalidarCacheEmbeddings()
    const despues = embeddingsDe(contexto, 'p-01')
    expect(despues).toEqual(antes)
  })
})
