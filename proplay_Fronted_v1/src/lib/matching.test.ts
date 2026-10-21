import { describe, expect, it } from 'vitest'
import {
  DIMENSIONES,
  PESOS_POR_DEFECTO,
  clamp01,
  compararRango,
  esCaribe,
  evaluarDimension,
  normalizarPesos,
} from '@/lib/matching'
import type { Oferta, PerfilJugador } from '@/types'

const perfilBase: PerfilJugador = {
  id: 'p-test',
  usuarioId: 'u-test',
  nombre: 'Jugador Prueba',
  handle: 'prueba',
  foto: '',
  region: 'Barranquilla',
  esCaribe: true,
  biografia: '',
  horasDisponibles: 30,
  dispuestoARelocalizarse: false,
  rolesPreferidos: ['Mid lane'],
  aniosExperiencia: 3,
  equiposAnteriores: ['Equipo A', 'Equipo B'],
  logros: [{ id: 'l-1', titulo: 'MVP', juego: 'League of Legends', lugar: 'BAQ', anio: 2025 }],
  portafolio: [],
}

const ofertaBase: Oferta = {
  id: 'o-test',
  equipoId: 'e-01-team',
  juego: 'League of Legends',
  rol: 'Mid lane',
  rangoMinimo: 'Platino I',
  experienciaMinima: 2,
  regionPreferida: 'Barranquilla',
  horasSemanales: 24,
  estado: 'abierta',
  publicadaEn: '2026-10-01',
  descripcion: '',
}

const stats = [
  {
    id: 'e-test',
    perfilId: 'p-test',
    juego: 'League of Legends' as const,
    rol: 'Mid lane',
    partidas: 1000,
    victorias: 600,
    kda: 4.5,
    winRate: 0.6,
    rango: 'Diamante I',
    fuente: 'api-riot' as const,
    ultimaSync: '2026-10-19T08:12:00Z',
    tendencia: [1, 1, 0, 1, 1, 1, 0, 1, 1, 1],
  },
]

const ctx = {
  perfil: perfilBase,
  oferta: ofertaBase,
  stats,
  endorsementCount: 3,
  skills: [
    { nivel: 4, verificada: true },
    { nivel: 5, verificada: true },
  ],
}

describe('DIMENSIONES', () => {
  it('declara las cinco dimensiones de la Seccion VIII-C', () => {
    expect(DIMENSIONES).toHaveLength(5)
    expect(DIMENSIONES.map((d) => d.key)).toEqual([
      'tecnica',
      'experiencia',
      'blandas',
      'geografica',
      'disponibilidad',
    ])
  })

  it('todos los pesos por defecto suman 1', () => {
    const total = DIMENSIONES.reduce((acc, d) => acc + PESOS_POR_DEFECTO[d.key], 0)
    expect(total).toBeCloseTo(1, 10)
  })
})

describe('normalizarPesos', () => {
  it('normaliza un conjunto de pesos arbitrario para que sume 1', () => {
    const n = normalizarPesos({
      tecnica: 2,
      experiencia: 2,
      blandas: 1,
      geografica: 1,
      disponibilidad: 4,
    })
    const total = DIMENSIONES.reduce((acc, d) => acc + n[d.key], 0)
    expect(total).toBeCloseTo(1, 10)
    expect(n.tecnica).toBeCloseTo(0.2, 10)
  })

  it('devuelve los pesos por defecto cuando el total es cero o negativo', () => {
    const n = normalizarPesos({
      tecnica: 0,
      experiencia: 0,
      blandas: 0,
      geografica: 0,
      disponibilidad: 0,
    })
    expect(n).toEqual(PESOS_POR_DEFECTO)
  })

  it('ignora los pesos negativos tratandolos como cero', () => {
    const n = normalizarPesos({
      tecnica: 1,
      experiencia: -1,
      blandas: 0,
      geografica: 0,
      disponibilidad: 0,
    })
    expect(n.tecnica).toBe(1)
    expect(n.experiencia).toBe(0)
  })
})

describe('clamp01', () => {
  it('acota los valores al intervalo [0, 1]', () => {
    expect(clamp01(-3)).toBe(0)
    expect(clamp01(0.42)).toBe(0.42)
    expect(clamp01(7)).toBe(1)
  })
})

describe('evaluarDimension · tecnica', () => {
  it('recompensa el rendimiento, el rol coincidente y el rango suficiente', () => {
    const { valor, detalle } = evaluarDimension('tecnica', ctx)
    expect(valor).toBeGreaterThan(0.6)
    expect(valor).toBeLessThanOrEqual(1)
    expect(detalle).toContain('Win rate')
    expect(detalle).toContain('rol coincidente')
    expect(detalle).toContain('rango suficiente')
  })

  it('devuelve cero cuando no hay estadisticas para el juego de la oferta', () => {
    const { valor, detalle } = evaluarDimension('tecnica', {
      ...ctx,
      oferta: { ...ofertaBase, juego: 'Dota 2' },
    })
    expect(valor).toBe(0)
    expect(detalle).toContain('Sin estadisticas verificadas')
  })
})

describe('evaluarDimension · experiencia', () => {
  it('pondera años, equipos y logros', () => {
    const { valor, detalle } = evaluarDimension('experiencia', ctx)
    expect(valor).toBeGreaterThan(0.5)
    expect(detalle).toContain('3 anos')
  })

  it('es cero para un jugador sin trayectoria', () => {
    const { valor } = evaluarDimension('experiencia', {
      ...ctx,
      perfil: {
        ...perfilBase,
        aniosExperiencia: 0,
        equiposAnteriores: [],
        logros: [],
      },
    })
    expect(valor).toBe(0)
  })
})

describe('evaluarDimension · blandas', () => {
  it('combina el nivel de las habilidades validadas con la confianza', () => {
    const { valor, detalle } = evaluarDimension('blandas', ctx)
    expect(valor).toBeGreaterThan(0.5)
    expect(detalle).toContain('habilidades validadas')
  })

  it('es cero cuando ninguna habilidad fue validada por terceros', () => {
    const { valor, detalle } = evaluarDimension('blandas', {
      ...ctx,
      skills: [{ nivel: 5, verificada: false }],
      endorsementCount: 0,
    })
    expect(valor).toBe(0)
    expect(detalle).toContain('Sin habilidades blandas validadas')
  })
})

describe('evaluarDimension · geografica', () => {
  it('es maxima cuando la region coincide', () => {
    expect(evaluarDimension('geografica', ctx).valor).toBe(1)
  })

  it('es alta cuando la vacante no restringe region', () => {
    const { valor } = evaluarDimension('geografica', {
      ...ctx,
      oferta: { ...ofertaBase, regionPreferida: 'Cualquiera' },
    })
    expect(valor).toBeGreaterThanOrEqual(0.8)
  })

  it('penaliza el desplazamiento geografico entre regiones', () => {
    const { valor } = evaluarDimension('geografica', {
      ...ctx,
      perfil: { ...perfilBase, region: 'Bogotá', esCaribe: false },
    })
    expect(valor).toBeLessThan(0.5)
  })

  it('la disposicion a relocalizarse mejora el valor', () => {
    const sin = evaluarDimension('geografica', {
      ...ctx,
      perfil: { ...perfilBase, region: 'Bogotá', esCaribe: false },
    }).valor
    const con = evaluarDimension('geografica', {
      ...ctx,
      perfil: {
        ...perfilBase,
        region: 'Bogotá',
        esCaribe: false,
        dispuestoARelocalizarse: true,
      },
    }).valor
    expect(con).toBeGreaterThan(sin)
  })
})

describe('evaluarDimension · disponibilidad', () => {
  it('compara las horas disponibles con las requeridas', () => {
    const { valor, detalle } = evaluarDimension('disponibilidad', ctx)
    expect(valor).toBe(1)
    expect(detalle).toContain('30 h disponibles')
  })

  it('queda acotada en 1 cuando el jugador ofrece mas horas de las pedidas', () => {
    const { valor } = evaluarDimension('disponibilidad', {
      ...ctx,
      perfil: { ...perfilBase, horasDisponibles: 60 },
    })
    expect(valor).toBe(1)
  })

  it('es proporcional cuando el jugador ofrece menos horas', () => {
    const { valor } = evaluarDimension('disponibilidad', {
      ...ctx,
      perfil: { ...perfilBase, horasDisponibles: 12 },
    })
    expect(valor).toBeCloseTo(0.5, 5)
  })
})

describe('compararRango', () => {
  it('detecta cuando el jugador cumple el rango minimo', () => {
    expect(compararRango('Diamante II', 'Platino I')).toBe(true)
    expect(compararRango('Platino I', 'Diamante I')).toBe(false)
  })

  it('devuelve true cuando el rango no es interpretable', () => {
    expect(compararRango('Sin rango', 'Platino I')).toBe(true)
  })
})

describe('esCaribe', () => {
  it('reconoce las tres regiones del Caribe colombiano', () => {
    expect(esCaribe('Barranquilla')).toBe(true)
    expect(esCaribe('Cartagena')).toBe(true)
    expect(esCaribe('Santa Marta')).toBe(true)
    expect(esCaribe('Bogotá')).toBe(false)
  })
})
