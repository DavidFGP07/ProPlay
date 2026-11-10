import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import type { UsuarioPublico } from '@proplay/shared'
import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { ToastProvider } from '@/context/ToastContext'
import { crearQueryClient } from '@/api/queryClient'

/**
 * RF-02 · RF-03 · RF-04 · RF-13 · Cuentas vinculadas y Mis estadisticas con la
 * API real de ProPlay (el cliente HTTP es un doble; Riot no interviene).
 */
const doble = vi.hoisted(() => ({
  usuario: null as UsuarioPublico | null,
  /** Desafio activo que devuelve GET /perfiles/cuentas-gaming/riot/desafio. */
  desafio: null as unknown,
  /** Respuestas sucesivas de GET /estadisticas/sincronizacion (la ultima se repite). */
  sincronizacion: [] as unknown[],
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('@/api/auth', () => ({
  authApi: {
    yo: async () => {
      if (!doble.usuario) throw new Error('401')
      return { usuario: doble.usuario }
    },
    login: async () => {
      throw new Error('No disponible')
    },
    registrar: async () => {
      throw new Error('No disponible')
    },
    logout: async () => {},
  },
}))

vi.mock('@/api/client', async (original) => {
  const real = await original<typeof import('@/api/client')>()
  return { ...real, api: { get: doble.get, post: doble.post, delete: doble.delete } }
})

const JUGADOR: UsuarioPublico = {
  id: 'cuenta-1',
  email: 'jugador1@proplay.gg',
  nombre: 'Valentina Rojas',
  rol: 'JUGADOR',
  emailVerificado: true,
  activo: true,
  creadoEn: new Date('2026-09-10T00:00:00Z'),
}

const CUENTA_RIOT = {
  id: 'cg-1',
  plataforma: 'RIOT',
  handle: 'Vale#LAN',
  servidor: 'LA1',
  verificadaEn: '2026-11-01T12:00:00.000Z',
  sincronizadaEn: null,
  creadoEn: '2026-11-01T12:00:00.000Z',
}

const PERFIL_ME = {
  tipo: 'JUGADOR',
  perfil: {
    id: 'perfil-1',
    usuarioId: 'cuenta-1',
    bio: null,
    pais: 'CO',
    departamento: 'ATLANTICO',
    disponibilidadHoras: 20,
    dispuestoRelocalizar: false,
    avatarUrl: null,
    creadoEn: '2026-09-10T00:00:00.000Z',
    actualizadoEn: '2026-09-10T00:00:00.000Z',
  },
}

function captura(id: string, fecha: string, winRate: number, kda: number) {
  return {
    id,
    jugadorId: 'perfil-1',
    juego: 'League of Legends',
    rol: 'SOPORTE',
    rango: 'ESMERALDA_II',
    partidas: 20,
    victorias: Math.round(winRate * 20),
    kda,
    winRate,
    fuente: 'RIOT',
    capturadaEn: fecha,
    metricas: {
      servidor: 'LA1',
      nivelInvocador: 245,
      rangoSoloDuo: { liga: 'EMERALD', division: 'II', puntosLiga: 54, victorias: 80, derrotas: 70 },
      rangoFlex: null,
      partidasAnalizadas: 20,
      colas: { '420': 20 },
      promedioKills: 2.1,
      promedioMuertes: 4.3,
      promedioAsistencias: 14.2,
      csPorMinuto: 1.4,
      oroPorMinuto: 310.5,
      danoPorMinuto: 420.2,
      visionPorMinuto: 2.4,
      participacionKills: 0.62,
      duracionMediaMinutos: 29.5,
      distribucionRoles: { SOPORTE: 18, MID: 2 },
      campeonesMasJugados: [{ campeon: 'Thresh', partidas: 9, victorias: 6, kda: 4.1 }],
      ultimaPartidaId: `LA1_${id}`,
      ultimaPartidaEn: fecha,
    },
  }
}

function errorApi(status: number, code: string, message: string) {
  return new AxiosError(message, String(status), undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { error: { code, message } },
  })
}

function renderRuta(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <QueryClientProvider client={crearQueryClient()}>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

const SIN_SINCRONIZACION = {
  estado: 'INACTIVA',
  muchaDemanda: false,
  sincronizadaEn: null,
  ultimoResultado: null,
}

function estadoSincronizacion() {
  return (doble.sincronizacion.length > 1 ? doble.sincronizacion.shift() : doble.sincronizacion[0]) ??
    SIN_SINCRONIZACION
}

function responderGet(cuentas: unknown[], resumen?: unknown, historial: unknown[] = []) {
  doble.get.mockImplementation(async (url: string) => {
    if (url === '/perfiles/cuentas-gaming') return { data: cuentas }
    if (url === '/perfiles/cuentas-gaming/riot/desafio') return { data: { desafio: doble.desafio } }
    if (url === '/estadisticas/sincronizacion') return { data: estadoSincronizacion() }
    if (url === '/perfiles/me') return { data: PERFIL_ME }
    if (url.endsWith('/resumen')) return { data: resumen ?? { jugadorId: 'perfil-1', juegos: [] } }
    if (url.startsWith('/estadisticas/jugador/')) return { data: historial }
    throw new Error(`GET inesperado ${url}`)
  })
}

const espera = { timeout: 8000 }

/** Desafio activo tal como lo devuelve la API (fechas en ISO). */
function desafioRiot(cambios: Record<string, unknown> = {}) {
  const ahora = Date.now()
  return {
    riotId: 'Vale#LAN',
    servidor: 'LA1',
    nivelInvocador: 245,
    iconoActual: 7,
    iconoRequerido: 12,
    iconoRequeridoUrl: 'https://ddragon.leagueoflegends.com/cdn/14.1.1/img/profileicon/12.png',
    creadoEn: new Date(ahora).toISOString(),
    expiraEn: new Date(ahora + 15 * 60_000).toISOString(),
    tokenDesafio: 'token-firmado',
    ultimaComprobacionEn: null,
    iconoVisto: null,
    comprobacionesRestantes: 40,
    ...cambios,
  }
}

describe('Cuentas vinculadas', () => {
  beforeEach(() => {
    doble.usuario = JUGADOR
    doble.desafio = null
    doble.sincronizacion = []
    doble.get.mockReset()
    doble.post.mockReset()
    doble.delete.mockReset()
  })

  it('vincula la cuenta de Riot con el desafío del icono', async () => {
    responderGet([])
    doble.post.mockImplementation(async (url: string, cuerpo: unknown) => {
      if (url === '/perfiles/cuentas-gaming/riot') {
        expect(cuerpo).toEqual({ gameName: 'Vale', tagLine: 'LAN', servidor: 'LA1' })
        return { data: desafioRiot() }
      }
      if (url === '/perfiles/cuentas-gaming/riot/verificar') {
        return {
          data: {
            estado: 'PENDIENTE',
            motivo: 'ICONO_DISTINTO',
            desafio: desafioRiot({
              ultimaComprobacionEn: new Date().toISOString(),
              iconoVisto: 7,
              comprobacionesRestantes: 39,
            }),
          },
        }
      }
      throw new Error(`POST inesperado ${url}`)
    })
    renderRuta('/cuentas-vinculadas')

    fireEvent.change(await screen.findByLabelText('Nombre de invocador (Riot ID)', {}, espera), {
      target: { value: 'Vale' },
    })
    fireEvent.change(screen.getByLabelText(/Etiqueta/), { target: { value: '#LAN' } })
    fireEvent.click(screen.getByRole('button', { name: 'Buscar mi cuenta' }))

    expect(await screen.findByAltText('Icono de invocador número 12')).toBeInTheDocument()
    expect(screen.getByText(/Riot puede tardar unos minutos en reflejarlo/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ya lo cambié, verificar' }))
    // Que aún no coincida es un aviso con la hora de la comprobación, no un error.
    expect(await screen.findByText(/Aún no vemos el cambio/)).toBeInTheDocument()
    expect(screen.getByText(/Última comprobación:/)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(doble.post).toHaveBeenCalledWith('/perfiles/cuentas-gaming/riot/verificar', {
      tokenDesafio: 'token-firmado',
    })
  })

  it('al volver a la vista retoma el desafío activo con el mismo icono', async () => {
    doble.desafio = desafioRiot({ iconoRequerido: 21 })
    responderGet([])
    renderRuta('/cuentas-vinculadas')

    expect(await screen.findByAltText('Icono de invocador número 21', {}, espera)).toBeInTheDocument()
    expect(screen.queryByLabelText('Nombre de invocador (Riot ID)')).toBeNull()
    expect(screen.getByText(/El desafío caduca en 1[45]:\d\d/)).toBeInTheDocument()
  })

  it('«Generar otro icono» sustituye el desafío que se muestra', async () => {
    doble.desafio = desafioRiot()
    responderGet([])
    doble.post.mockImplementation(async (url: string) => {
      if (url === '/perfiles/cuentas-gaming/riot/desafio/regenerar') {
        return { data: desafioRiot({ iconoRequerido: 3, tokenDesafio: 'token-nuevo' }) }
      }
      throw new Error(`POST inesperado ${url}`)
    })
    renderRuta('/cuentas-vinculadas')

    fireEvent.click(await screen.findByRole('button', { name: 'Generar otro icono' }, espera))
    expect(await screen.findByAltText('Icono de invocador número 3')).toBeInTheDocument()
  })

  it('comprueba sola cuando toca y, al verificarse, la vista se actualiza', async () => {
    // Creado hace un minuto: la comprobación automática ya toca.
    doble.desafio = desafioRiot({ creadoEn: new Date(Date.now() - 60_000).toISOString() })
    let cuentas: unknown[] = []
    doble.get.mockImplementation(async (url: string) => {
      if (url === '/perfiles/cuentas-gaming') return { data: cuentas }
      if (url === '/perfiles/cuentas-gaming/riot/desafio') return { data: { desafio: doble.desafio } }
      if (url === '/estadisticas/sincronizacion') return { data: SIN_SINCRONIZACION }
      if (url === '/perfiles/me') return { data: PERFIL_ME }
      throw new Error(`GET inesperado ${url}`)
    })
    doble.post.mockImplementation(async (url: string) => {
      if (url === '/perfiles/cuentas-gaming/riot/verificar') {
        cuentas = [CUENTA_RIOT]
        doble.desafio = null
        return { data: { estado: 'VERIFICADA', cuenta: CUENTA_RIOT } }
      }
      throw new Error(`POST inesperado ${url}`)
    })
    renderRuta('/cuentas-vinculadas')

    expect(await screen.findByText('Verificada', {}, espera)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sincronizar estadísticas' })).toBeInTheDocument()
    expect(screen.queryByAltText('Icono de invocador número 12')).toBeNull()
    expect(doble.post).toHaveBeenCalledTimes(1)
  })

  it('con el cupo agotado pide generar otro icono y deja de comprobar', async () => {
    doble.desafio = desafioRiot()
    responderGet([])
    doble.post.mockRejectedValue(
      errorApi(429, 'COMPROBACIONES_AGOTADAS', 'Este icono ya se comprobó demasiadas veces.'),
    )
    renderRuta('/cuentas-vinculadas')

    fireEvent.click(await screen.findByRole('button', { name: 'Ya lo cambié, verificar' }, espera))
    expect(await screen.findByText(/Genera otro icono para seguir intentándolo/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ya lo cambié, verificar' })).toBeDisabled()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('no comprueba sola con la pestaña oculta', async () => {
    const visibilidad = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    try {
      doble.desafio = desafioRiot({ creadoEn: new Date(Date.now() - 60_000).toISOString() })
      responderGet([])
      renderRuta('/cuentas-vinculadas')
      expect(await screen.findByAltText('Icono de invocador número 12', {}, espera)).toBeInTheDocument()
      await new Promise((resolver) => setTimeout(resolver, 1500))
      expect(doble.post).not.toHaveBeenCalled()
    } finally {
      visibilidad.mockRestore()
    }
  })

  it('con la cuenta verificada permite sincronizar y desvincular', async () => {
    // La sincronizacion se encola y la vista consulta hasta que termina.
    doble.sincronizacion = [
      SIN_SINCRONIZACION,
      { ...SIN_SINCRONIZACION, estado: 'EN_COLA', muchaDemanda: true },
      {
        ...SIN_SINCRONIZACION,
        sincronizadaEn: '2026-11-08T17:00:00.000Z',
        ultimoResultado: { tipo: 'NUEVAS', en: '2026-11-08T17:00:00.000Z' },
      },
    ]
    responderGet([CUENTA_RIOT])
    doble.post.mockResolvedValue({ data: { ...SIN_SINCRONIZACION, estado: 'EN_COLA' } })
    doble.delete.mockResolvedValue({ data: null })
    renderRuta('/cuentas-vinculadas')

    expect(await screen.findByText('Vale#LAN', {}, espera)).toBeInTheDocument()
    expect(screen.getByText('Latinoamérica Norte (LAN)')).toBeInTheDocument()
    expect(screen.getByText('Todavía no se ha sincronizado')).toBeInTheDocument()

    fireEvent.click(await screen.findByRole('button', { name: 'Sincronizar estadísticas' }))
    await waitFor(() => expect(doble.post).toHaveBeenCalledWith('/estadisticas/sincronizar', {}))
    expect(await screen.findByText(/En cola/)).toBeInTheDocument()
    // Sin cupo en la cuota de Riot: aviso, no error, y se hace sola.
    expect(await screen.findByText(/Mucha demanda en este momento/, {}, espera)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(
      await screen.findByText('Estadísticas actualizadas desde Riot.', {}, espera),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Desvincular' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sí, desvincular' }))
    await waitFor(() => expect(doble.delete).toHaveBeenCalledWith('/perfiles/cuentas-gaming/RIOT'))
  }, 15_000)

  it('si Riot no está disponible, sincronizar avisa «inténtalo más tarde» sin error rojo', async () => {
    responderGet([CUENTA_RIOT])
    doble.post.mockRejectedValue(
      errorApi(503, 'RIOT_NO_DISPONIBLE', 'La conexión con Riot no está disponible en este momento; inténtalo más tarde'),
    )
    renderRuta('/cuentas-vinculadas')

    fireEvent.click(await screen.findByRole('button', { name: 'Sincronizar estadísticas' }, espera))
    expect(await screen.findByText(/inténtalo más tarde/)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('sin cupo para comprobar el icono muestra «Mucha demanda, reintentando»', async () => {
    doble.desafio = desafioRiot()
    responderGet([])
    doble.post.mockResolvedValue({
      data: { estado: 'PENDIENTE', motivo: 'MUCHA_DEMANDA', desafio: desafioRiot() },
    })
    renderRuta('/cuentas-vinculadas')

    fireEvent.click(await screen.findByRole('button', { name: 'Ya lo cambié, verificar' }, espera))
    expect(await screen.findByText(/Mucha demanda, reintentando/)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('sin cupo para buscar la cuenta, avisa sin error rojo', async () => {
    responderGet([])
    doble.post.mockRejectedValue(
      errorApi(503, 'MUCHA_DEMANDA', 'Hay mucha demanda en este momento; inténtalo en un momento'),
    )
    renderRuta('/cuentas-vinculadas')

    fireEvent.change(await screen.findByLabelText('Nombre de invocador (Riot ID)', {}, espera), {
      target: { value: 'Vale' },
    })
    fireEvent.change(screen.getByLabelText(/Etiqueta/), { target: { value: 'LAN' } })
    fireEvent.click(screen.getByRole('button', { name: 'Buscar mi cuenta' }))
    expect(await screen.findByText(/mucha demanda/)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('Mis estadísticas', () => {
  beforeEach(() => {
    doble.usuario = JUGADOR
    doble.get.mockReset()
    doble.post.mockReset()
  })

  it('sin cuenta verificada lleva a Cuentas vinculadas', async () => {
    responderGet([])
    renderRuta('/mis-estadisticas')
    expect(await screen.findByText('Vincula tu cuenta de Riot', {}, espera)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir a Cuentas vinculadas' })).toHaveAttribute(
      'href',
      '/cuentas-vinculadas',
    )
  })

  it('muestra rango, métricas, posiciones y campeones de la última captura', async () => {
    const anterior = captura('a', '2026-11-01T12:00:00.000Z', 0.5, 3)
    const actual = captura('b', '2026-11-05T12:00:00.000Z', 0.6, 3.5)
    responderGet(
      [CUENTA_RIOT],
      {
        jugadorId: 'perfil-1',
        juegos: [
          {
            juego: 'League of Legends',
            fuente: 'RIOT',
            actual,
            anterior,
            tendencia: { winRate: 0.1, kda: 0.5, csPorMinuto: 0 },
          },
        ],
      },
      [actual, anterior],
    )
    renderRuta('/mis-estadisticas')

    expect(await screen.findByText('Esmeralda II', { exact: false }, espera)).toBeInTheDocument()
    expect(screen.getByText('Sin clasificar esta temporada')).toBeInTheDocument()
    expect(screen.getByText('60 %')).toBeInTheDocument()
    expect(screen.getByText('+10 % frente a la captura anterior')).toBeInTheDocument()
    expect(screen.getByText('Thresh')).toBeInTheDocument()
    expect(screen.getByText('Principal')).toBeInTheDocument()
    expect(screen.queryByText('Datos de demostracion')).toBeNull()
  })

  it('sin capturas ofrece sincronizar', async () => {
    responderGet([CUENTA_RIOT])
    renderRuta('/mis-estadisticas')
    expect(await screen.findByText('Aún no hay estadísticas', {}, espera)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sincronizar' })).toBeInTheDocument()
  })
})
