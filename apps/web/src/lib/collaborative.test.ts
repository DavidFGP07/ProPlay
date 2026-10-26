import { describe, expect, it } from 'vitest'
import {
  MINIMO_INTERACCIONES,
  construirInteracciones,
  hayHistorialSuficiente,
  interaccionesDeEquipo,
  puntajeColaborativo,
} from '@/lib/collaborative'
import type { Postulacion } from '@/mocks/modelos'

const postulacion = (
  id: string,
  ofertaId: string,
  perfilId: string,
  estado: Postulacion['estado'],
): Postulacion => ({
  id,
  ofertaId,
  perfilId,
  estado,
  mensaje: '',
  fecha: '2026-10-01',
})

const postulaciones = [
  postulacion('po-1', 'o-01', 'p-01', 'ACEPTADA'),
  postulacion('po-2', 'o-01', 'p-02', 'ENTREVISTA'),
  postulacion('po-3', 'o-02', 'p-03', 'EN_REVISION'),
  postulacion('po-4', 'o-02', 'p-04', 'RECHAZADA'),
]

const equipos: Record<string, string> = {
  'o-01': 'e-01-team',
  'o-02': 'e-02-team',
}

describe('construirInteracciones', () => {
  it('resuelve el equipo a partir del identificador de la oferta', () => {
    const inter = construirInteracciones(postulaciones, (id) => equipos[id])
    expect(inter.every((i) => i.equipoId !== 'desconocido:o-01')).toBe(true)
    expect(inter.find((i) => i.perfilId === 'p-01')?.equipoId).toBe('e-01-team')
  })

  it('descarta las postulaciones con senal negativa (rechazadas)', () => {
    const inter = construirInteracciones(postulaciones, (id) => equipos[id])
    expect(inter.some((i) => i.perfilId === 'p-04')).toBe(false)
  })

  it('pondera mas fuerte una postulacion aceptada que una enviada', () => {
    const inter = construirInteracciones(postulaciones, (id) => equipos[id])
    const aceptada = inter.find((i) => i.perfilId === 'p-01')!
    const revision = inter.find((i) => i.perfilId === 'p-03')!
    expect(aceptada.peso).toBeGreaterThan(revision.peso)
  })

  it('descarta las interacciones cuya oferta no se puede resolver', () => {
    const inter = construirInteracciones(postulaciones, () => undefined)
    expect(inter).toHaveLength(0)
  })
})

describe('interaccionesDeEquipo', () => {
  it('filtra por equipo', () => {
    const inter = construirInteracciones(postulaciones, (id) => equipos[id])
    const propias = interaccionesDeEquipo(inter, 'e-01-team')
    expect(propias).toHaveLength(2)
    expect(propias.every((i) => i.equipoId === 'e-01-team')).toBe(true)
  })
})

describe('hayHistorialSuficiente', () => {
  it('es falso mientras el historial no alcanza el minimo (arranque en frio)', () => {
    const inter = construirInteracciones(postulaciones, (id) => equipos[id])
    expect(hayHistorialSuficiente(inter, 'e-02-team')).toBe(false)
    expect(MINIMO_INTERACCIONES).toBe(3)
  })

  it('es verdadero con historial suficiente', () => {
    const inter = construirInteracciones(
      [
        postulacion('a', 'o-01', 'p-01', 'ACEPTADA'),
        postulacion('b', 'o-01', 'p-02', 'ACEPTADA'),
        postulacion('c', 'o-01', 'p-03', 'ACEPTADA'),
      ],
      (id) => equipos[id],
    )
    expect(hayHistorialSuficiente(inter, 'e-01-team')).toBe(true)
  })
})

describe('puntajeColaborativo', () => {
  const embeddings = new Map<string, number[]>([
    ['p-01', [1, 0, 0]],
    ['p-02', [0.9, 0.1, 0]],
    ['p-03', [0, 1, 0]],
  ])

  it('devuelve un mapa vacio en el arranque en frio', () => {
    const inter = construirInteracciones(postulaciones, (id) => equipos[id])
    const r = puntajeColaborativo('e-02-team', embeddings, inter)
    expect(r.size).toBe(0)
  })

  it(' puntua a los candidatos cuando hay historial suficiente', () => {
    const inter = construirInteracciones(
      [
        postulacion('a', 'o-01', 'p-01', 'ACEPTADA'),
        postulacion('b', 'o-01', 'p-02', 'ACEPTADA'),
        postulacion('c', 'o-01', 'p-03', 'ACEPTADA'),
      ],
      (id) => equipos[id],
    )
    const r = puntajeColaborativo('e-01-team', embeddings, inter)
    expect(r.size).toBeGreaterThan(0)
    for (const [, valor] of r) {
      expect(valor).toBeGreaterThanOrEqual(0)
      expect(valor).toBeLessThanOrEqual(1)
    }
  })

  it('devuelve un mapa vacio si no hay embeddings del equipo', () => {
    const inter = construirInteracciones(
      [
        postulacion('a', 'o-01', 'p-01', 'ACEPTADA'),
        postulacion('b', 'o-01', 'p-02', 'ACEPTADA'),
        postulacion('c', 'o-01', 'p-03', 'ACEPTADA'),
      ],
      (id) => equipos[id],
    )
    const r = puntajeColaborativo('e-01-team', new Map(), inter)
    expect(r.size).toBe(0)
  })
})
