import { describe, expect, it } from 'vitest'
import {
  DIMENSION_EMBEDDING,
  buscarPorSimilitud,
  l2Normalizar,
  similitudCoseno,
  vectorizarOferta,
  vectorizarPerfil,
} from '@/lib/vector'
import type { Oferta, PerfilJugador } from '@/types'

const perfil: PerfilJugador = {
  id: 'p-01',
  usuarioId: 'u-1',
  nombre: 'Daniel Ocoro',
  handle: 'DanyOcro',
  foto: '',
  region: 'Barranquilla',
  esCaribe: true,
  biografia: '',
  horasDisponibles: 32,
  dispuestoARelocalizarse: true,
  rolesPreferidos: ['Mid lane'],
  aniosExperiencia: 3,
  equiposAnteriores: ['Lobos del Caribe'],
  logros: [
    { id: 'l-1', titulo: 'Subcampeon', juego: 'League of Legends', lugar: 'BAQ', anio: 2025 },
  ],
  portafolio: [],
}

const stats = [
  {
    id: 'e-01',
    perfilId: 'p-01',
    juego: 'League of Legends' as const,
    rol: 'Mid lane',
    partidas: 1240,
    victorias: 706,
    kda: 4.62,
    winRate: 706 / 1240,
    rango: 'Diamante II',
    fuente: 'api-riot' as const,
    ultimaSync: '2026-10-19T08:12:00Z',
    tendencia: [1, 1, 0, 1, 1, 1, 0, 1, 1, 1],
  },
]

const oferta: Oferta = {
  id: 'o-01',
  equipoId: 'e-01-team',
  juego: 'League of Legends',
  rol: 'Mid lane',
  rangoMinimo: 'Platino I',
  experienciaMinima: 2,
  regionPreferida: 'Barranquilla',
  horasSemanales: 25,
  estado: 'abierta',
  publicadaEn: '2026-09-28',
  descripcion: '',
}

describe('vectorizarPerfil', () => {
  it('produce un vector de 64 dimensiones normalizado', () => {
    const v = vectorizarPerfil(perfil, stats)
    expect(v).toHaveLength(DIMENSION_EMBEDDING)
    const norma = Math.sqrt(v.reduce((a, b) => a + b * b, 0))
    expect(norma).toBeCloseTo(1, 8)
  })

  it('es determinista: el mismo perfil produce el mismo vector', () => {
    expect(vectorizarPerfil(perfil, stats)).toEqual(vectorizarPerfil(perfil, stats))
  })

  it('perfiles distintos producen vectores distintos', () => {
    const otro = vectorizarPerfil({ ...perfil, id: 'p-99', handle: 'otro' }, stats)
    expect(vectorizarPerfil(perfil, stats)).not.toEqual(otro)
  })

  it('tolera un perfil sin estadisticas asociadas', () => {
    const v = vectorizarPerfil(perfil, [])
    expect(v).toHaveLength(DIMENSION_EMBEDDING)
    expect(v.every((x) => Number.isFinite(x))).toBe(true)
  })
})

describe('vectorizarOferta', () => {
  it('genera un vector en el mismo espacio que los perfiles', () => {
    const v = vectorizarOferta(oferta)
    expect(v).toHaveLength(DIMENSION_EMBEDDING)
    const norma = Math.sqrt(v.reduce((a, b) => a + b * b, 0))
    expect(norma).toBeCloseTo(1, 8)
  })
})

describe('l2Normalizar', () => {
  it('normaliza a norma unitaria', () => {
    const v = l2Normalizar([3, 4])
    expect(Math.sqrt(v[0] ** 2 + v[1] ** 2)).toBeCloseTo(1, 10)
  })

  it('deja intacto el vector nulo', () => {
    expect(l2Normalizar([0, 0, 0])).toEqual([0, 0, 0])
  })
})

describe('similitudCoseno', () => {
  it('vale 1 para vectores identicos', () => {
    expect(similitudCoseno([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 10)
  })

  it('vale 0 para vectores ortogonales', () => {
    expect(similitudCoseno([1, 0], [0, 1])).toBeCloseTo(0, 10)
  })

  it('vale 0 cuando alguno de los vectores es nulo', () => {
    expect(similitudCoseno([0, 0], [1, 1])).toBe(0)
  })

  it('es simetrica', () => {
    const a = [1, 2, 3]
    const b = [3, 1, 0]
    expect(similitudCoseno(a, b)).toBeCloseTo(similitudCoseno(b, a), 10)
  })
})

describe('buscarPorSimilitud', () => {
  const objetivo = vectorizarOferta(oferta)
  const candidatos = [
    { id: 'a', embedding: vectorizarPerfil(perfil, stats) },
    { id: 'b', embedding: vectorizarPerfil({ ...perfil, id: 'p-99', handle: 'x' }, stats) },
  ]

  it('ordena por similitud descendente', () => {
    const r = buscarPorSimilitud(objetivo, candidatos)
    expect(r).toHaveLength(2)
    expect(r[0].similitud).toBeGreaterThanOrEqual(r[1].similitud)
  })

  it('respeta el limite top-K', () => {
    expect(buscarPorSimilitud(objetivo, candidatos, 1)).toHaveLength(1)
  })

  it('devuelve una lista vacia si no hay candidatos', () => {
    expect(buscarPorSimilitud(objetivo, [])).toEqual([])
  })
})
