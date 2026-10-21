import { describe, expect, it } from 'vitest'
import { calculoExactoSandbox, generarExplicacion } from '@/services/llm'
import type {
  DesgloseDimension,
  Estadistica,
  Oferta,
  PerfilEquipo,
  PerfilJugador,
  ResultadoMatching,
} from '@/types'

const desglose: DesgloseDimension[] = [
  { key: 'tecnica', valor: 0.82, peso: 0.35, contribucion: 0.287, detalle: 'Win rate 60 % y KDA 4.62.' },
  { key: 'experiencia', valor: 0.7, peso: 0.2, contribucion: 0.14, detalle: '3 anos de experiencia.' },
  { key: 'blandas', valor: 0.65, peso: 0.15, contribucion: 0.0975, detalle: '2 habilidades validadas.' },
  { key: 'geografica', valor: 0.9, peso: 0.15, contribucion: 0.135, detalle: 'Misma region.' },
  { key: 'disponibilidad', valor: 0.4, peso: 0.15, contribucion: 0.06, detalle: '12 h frente a 30 h requeridas.' },
]

const resultado: ResultadoMatching = {
  ofertaId: 'o-01',
  perfilId: 'p-01',
  puntaje: 0.7195,
  desglose,
  similitudVectorial: 0.81,
  colaborativo: 0.6,
  pesoColaborativo: 0.15,
  modo: 'hibrido',
  embedding: [],
}

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

const jugador: PerfilJugador = {
  id: 'p-01',
  usuarioId: 'u-1',
  nombre: 'Daniel Ocoro',
  handle: 'DanyOcro',
  foto: '',
  region: 'Barranquilla',
  esCaribe: true,
  biografia: '',
  horasDisponibles: 12,
  dispuestoARelocalizarse: false,
  rolesPreferidos: ['Mid lane'],
  aniosExperiencia: 3,
  equiposAnteriores: [],
  logros: [],
  portafolio: [],
}

const equipo: PerfilEquipo = {
  id: 'e-01-team',
  usuarioId: 'u-e',
  nombre: 'Atlantico Esports',
  organizacion: 'Atlantico Esports SAS',
  descripcion: '',
  region: 'Barranquilla',
  logo: 'AE',
  fundacion: 2024,
  directorio: [],
}

const stats: Estadistica[] = [
  {
    id: 'e-01',
    perfilId: 'p-01',
    juego: 'League of Legends',
    rol: 'Mid lane',
    partidas: 1240,
    victorias: 706,
    kda: 4.62,
    winRate: 706 / 1240,
    rango: 'Diamante II',
    fuente: 'api-riot',
    ultimaSync: '2026-10-19T08:12:00Z',
    tendencia: [1, 1, 0, 1],
  },
]

describe('generarExplicacion', () => {
  it('redacta un resumen coherente con el puntaje mostrado', () => {
    const exp = generarExplicacion(resultado, oferta, jugador, equipo, stats, 'Riot Games')
    expect(exp.resumen).toContain('Daniel Ocoro')
    expect(exp.resumen).toContain('72 %')
    expect(exp.resumen).toContain('League of Legends')
  })

  it('indica el modo de calculo segun el peso colaborativo', () => {
    const hibrido = generarExplicacion(resultado, oferta, jugador, equipo, stats, 'Riot Games')
    expect(hibrido.resumen).toContain('hibrido')

    const soloContenido = generarExplicacion(
      { ...resultado, modo: 'contenido', pesoColaborativo: 0 },
      oferta,
      jugador,
      equipo,
      stats,
      'Riot Games',
    )
    expect(soloContenido.resumen).toContain('contenido puro')
  })

  it('separa fortalezas y riesgos segun el desglose por dimension', () => {
    const exp = generarExplicacion(resultado, oferta, jugador, equipo, stats, 'Riot Games')
    expect(exp.fortalezas.length).toBeGreaterThan(0)
    expect(exp.riesgos.length).toBeGreaterThan(0)
    // La disponibilidad es la dimension mas debil (0.4): debe aparecer como riesgo.
    expect(exp.riesgos.some((r) => /12 h frente a 30 h requeridas/.test(r))).toBe(
      true,
    )
  })

  it('ancla la explicacion en fuentes recuperadas (grounding)', () => {
    const exp = generarExplicacion(resultado, oferta, jugador, equipo, stats, 'Riot Games')
    expect(exp.grounding.length).toBeGreaterThanOrEqual(3)
    for (const f of exp.grounding) {
      expect(f.etiqueta.length).toBeGreaterThan(0)
      expect(f.url).toMatch(/^https?:\/\//)
    }
  })

  it('no inventa metricas: el detalle del grounding refleja las estadisticas reales', () => {
    const exp = generarExplicacion(resultado, oferta, jugador, equipo, stats, 'Riot Games')
    const fuenteApi = exp.grounding.find((g) => /API oficial/.test(g.etiqueta))!
    expect(fuenteApi.detalle).toContain('1.240')
    expect(fuenteApi.detalle).toContain('4.62')
  })

  it('reporta el riesgo de muestra estadistica reducida', () => {
    const exp = generarExplicacion(
      resultado,
      oferta,
      jugador,
      equipo,
      [{ ...stats[0], partidas: 80 }],
      'Riot Games',
    )
    expect(exp.riesgos.some((r) => /muestra estadistica/i.test(r))).toBe(true)
  })

  it('funciona sin estadisticas registradas', () => {
    const exp = generarExplicacion(resultado, oferta, jugador, equipo, [], 'la API oficial')
    expect(exp.resumen.length).toBeGreaterThan(0)
    expect(exp.grounding.length).toBeGreaterThan(0)
  })
})

describe('calculoExactoSandbox', () => {
  it('redondea el puntaje a seis decimales', () => {
    const [r] = calculoExactoSandbox([
      { ...resultado, puntaje: 0.123456789 },
    ])
    expect(r.puntaje).toBe(0.123457)
  })

  it('no altera el resto de los campos del resultado', () => {
    const [r] = calculoExactoSandbox([resultado])
    expect(r.desglose).toEqual(resultado.desglose)
    expect(r.modo).toBe(resultado.modo)
  })

  it('procesa listas vacias sin fallar', () => {
    expect(calculoExactoSandbox([])).toEqual([])
  })
})
