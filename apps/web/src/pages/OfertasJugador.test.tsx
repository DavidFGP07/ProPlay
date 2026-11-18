import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import { PESOS_MATCHING, type Rol, type UsuarioPublico } from '@proplay/shared'
import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { ToastProvider } from '@/context/ToastContext'
import { crearQueryClient } from '@/api/queryClient'

/**
 * RF-07 · RF-10 · Vistas del jugador con datos reales: Explorar oportunidades
 * (/vacantes), detalle y postulación (/vacantes/:id) y la pestaña «Mis
 * postulaciones» de /mi-perfil. El cliente HTTP es un doble en memoria.
 */
const doble = vi.hoisted(() => ({
  usuario: null as UsuarioPublico | null,
  get: vi.fn(),
  post: vi.fn(),
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
  return { ...real, api: { get: doble.get, post: doble.post } }
})

function sesionDe(rol: Rol) {
  doble.usuario = {
    id: `cuenta-${rol.toLowerCase()}`,
    email: `${rol.toLowerCase()}@proplay.gg`,
    nombre: `Usuario ${rol}`,
    rol,
    emailVerificado: true,
    activo: true,
    creadoEn: new Date('2026-09-10T00:00:00Z'),
  }
}

function oferta(cambios: Record<string, unknown> = {}) {
  return {
    id: 'oferta-1',
    equipoId: 'equipo-1',
    titulo: 'MID para la academia',
    juego: 'League of Legends',
    rol: 'MID',
    rangoMinimo: 'DIAMANTE_II',
    modalidad: 'PRESENCIAL',
    pais: 'CO',
    departamento: 'ATLANTICO',
    horasSemana: 25,
    descripcion: 'Roster de academia con entrenamientos de lunes a viernes.',
    pesos: PESOS_MATCHING,
    estado: 'ABIERTA',
    publicadaEn: '2026-10-20T12:00:00.000Z',
    cerradaEn: null,
    creadoEn: '2026-10-20T12:00:00.000Z',
    actualizadoEn: '2026-10-20T12:00:00.000Z',
    equipo: { id: 'equipo-1', nombreOrg: 'Caribe eSports', logoUrl: null },
    ...cambios,
  }
}

function pagina(datos: unknown[], meta: Partial<{ page: number; totalPages: number; total: number }> = {}) {
  return {
    data: datos,
    meta: { page: 1, pageSize: 20, total: datos.length, totalPages: 1, ...meta },
  }
}

function miPostulacion(cambios: Record<string, unknown> = {}) {
  return {
    id: 'postulacion-1',
    ofertaId: 'oferta-1',
    jugadorId: 'jugador-1',
    estado: 'EN_REVISION',
    mensaje: 'Me interesa',
    creadoEn: '2026-10-21T12:00:00.000Z',
    revisadaEn: '2026-10-23T12:00:00.000Z',
    entrevistaEn: null,
    aceptadaEn: null,
    rechazadaEn: null,
    actualizadoEn: '2026-10-23T12:00:00.000Z',
    oferta: {
      id: 'oferta-1',
      titulo: 'MID para la academia',
      rol: 'MID',
      modalidad: 'PRESENCIAL',
      estado: 'ABIERTA',
      equipo: { id: 'equipo-1', nombreOrg: 'Caribe eSports', logoUrl: null },
    },
    ...cambios,
  }
}

function errorApi(status: number, code = 'X') {
  return new AxiosError('Error', String(status), undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { error: { code, message: 'mensaje de la API' } },
  })
}

/** Respuestas por ruta; lo que no esté, falla como si no hubiera servidor. */
function rutas(respuestas: Record<string, unknown | (() => unknown)>) {
  doble.get.mockImplementation(async (ruta: string) => {
    if (!(ruta in respuestas)) throw new Error(`Sin respuesta para ${ruta}`)
    const valor = respuestas[ruta]
    if (valor instanceof Error) throw valor
    return { data: typeof valor === 'function' ? (valor as () => unknown)() : valor }
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

const ESPERA = { timeout: 8000 }

beforeEach(() => {
  doble.usuario = null
  doble.get.mockReset()
  doble.post.mockReset()
})

/** Explicación válida del motor; sin cuenta verificada, la técnica con «faltan datos». */
function explicacion(verificado = true) {
  return {
    pesos: PESOS_MATCHING,
    dimensiones: {
      tecnica: verificado
        ? {
            faltanDatos: false,
            motivo: null,
            posicionPedida: 'MID',
            posicionPrincipal: 'MID',
            fraccionEnPosicion: 1,
            rango: 'DIAMANTE_II',
            rangoMinimo: 'DIAMANTE_II',
            partidasAnalizadas: 20,
            datosDel: '2026-11-10T00:00:00.000Z',
            componentes: { posicion: 1, rango: 1, rendimiento: 0.6 },
            metricas: [],
          }
        : {
            faltanDatos: true,
            motivo: 'SIN_CUENTA_VERIFICADA',
            posicionPedida: 'MID',
            posicionPrincipal: null,
            fraccionEnPosicion: null,
            rango: null,
            rangoMinimo: 'DIAMANTE_II',
            partidasAnalizadas: null,
            datosDel: null,
            componentes: null,
            metricas: [],
          },
      experiencia: { faltanDatos: true, motivo: 'SIN_DATOS_PILOTO' },
      habilidadesBlandas: { faltanDatos: true, motivo: 'SIN_ENDORSEMENTS', endorsementsDeEquipos: 0 },
      geografica: { faltanDatos: false, motivo: null, modalidad: 'PRESENCIAL', cercania: 'MISMO_DEPARTAMENTO', relocalizacionAplicada: false },
      disponibilidad: { faltanDatos: false, motivo: null, horasJugador: 25, horasOferta: 25 },
    },
  }
}

/** Oferta con la compatibilidad del jugador: puntaje = Σ pesos × desglose. */
function compatible(datos: Record<string, unknown>, tecnica: number, geografica: number, verificado = true) {
  const desglose = { tecnica, experiencia: 0, habilidadesBlandas: 0, geografica, disponibilidad: 1 }
  const puntaje = 0.5 * tecnica + 0.25 * geografica + 0.25
  return { oferta: oferta(datos), puntaje, desglose, explicacion: explicacion(verificado) }
}

function paginaCompatibles(datos: unknown[], verificado = true, meta: Partial<{ page: number; totalPages: number; total: number }> = {}) {
  return {
    ...pagina(datos, meta),
    verificado,
    calculadoEn: '2026-11-17T12:00:00.000Z',
    versionFormulas: 1,
    modo: 'CONTENIDO',
    pesoColaborativo: 0,
  }
}

const RUTA_COMPATIBLES = '/matching/jugador/me'

describe('Explorar oportunidades (/vacantes)', () => {
  it('el jugador las ve ordenadas por compatibilidad, con su puntaje y la barra de aportes', async () => {
    sesionDe('JUGADOR')
    rutas({
      [RUTA_COMPATIBLES]: paginaCompatibles([
        compatible({}, 0.9, 1),
        compatible({ id: 'oferta-2', titulo: 'ADC remoto', rol: 'ADC', modalidad: 'REMOTA', pais: null, departamento: null }, 0.2, 0.5),
      ]),
      '/ofertas/postulaciones/me': [miPostulacion()],
    })
    renderRuta('/vacantes')

    expect(await screen.findByRole('heading', { name: 'MID para la academia' }, ESPERA)).toBeInTheDocument()
    expect(screen.getByText(/ordenadas por tu compatibilidad/)).toBeInTheDocument()
    expect(screen.queryByText(/llegará con el motor de matching/)).toBeNull()
    expect(doble.get).toHaveBeenCalledWith(RUTA_COMPATIBLES, { params: { page: 1 } })
    expect(doble.get).not.toHaveBeenCalledWith('/ofertas', expect.anything())

    const tarjetas = screen.getAllByRole('listitem').filter((li) => within(li).queryByRole('heading'))
    expect(tarjetas.map((li) => within(li).getByRole('heading').textContent)).toEqual(['MID para la academia', 'ADC remoto'])
    expect(within(tarjetas[0]!).getByText('95 %')).toBeInTheDocument()
    expect(within(tarjetas[1]!).getByText('48 %')).toBeInTheDocument()
    expect(within(tarjetas[0]!).getByTestId('barra-aportes')).toBeInTheDocument()
    expect(screen.getByText('2 ofertas abiertas')).toBeInTheDocument()
    expect(screen.getByText('Remota, sin restricción de ubicación')).toBeInTheDocument()
    expect(await screen.findByText(/Ya te postulaste · En revision/)).toBeInTheDocument()
    // Con cuenta verificada no hay aviso.
    expect(screen.queryByText(/Vincula tu cuenta de Riot para que la técnica cuente/)).toBeNull()
  })

  it('sin cuenta verificada avisa que la técnica no cuenta y enlaza a Cuentas vinculadas', async () => {
    sesionDe('JUGADOR')
    rutas({
      [RUTA_COMPATIBLES]: paginaCompatibles([compatible({}, 0, 1, false)], false),
      '/ofertas/postulaciones/me': [],
    })
    renderRuta('/vacantes')

    expect(await screen.findByText(/Vincula tu cuenta de Riot para que la técnica cuente/, {}, ESPERA)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir a Cuentas vinculadas' })).toHaveAttribute('href', '/cuentas-vinculadas')
    expect(screen.getByText('50 %')).toBeInTheDocument()
  })

  it.each(['EQUIPO', 'SCOUT'] as const)('el rol %s las sigue viendo por fecha, sin puntaje', async (rol) => {
    sesionDe(rol)
    rutas({ '/ofertas': pagina([oferta()]), '/ofertas/me': pagina([]) })
    renderRuta('/vacantes')

    expect(await screen.findByRole('heading', { name: 'MID para la academia' }, ESPERA)).toBeInTheDocument()
    expect(screen.getByText(/de la más reciente a la más antigua\.$/)).toBeInTheDocument()
    expect(doble.get).not.toHaveBeenCalledWith(RUTA_COMPATIBLES, expect.anything())
    expect(screen.queryByText(/\d+ %/)).toBeNull()
    expect(screen.queryByTestId('barra-aportes')).toBeNull()
  })

  it('filtra con los parámetros de la API y vuelve a la primera página', async () => {
    sesionDe('JUGADOR')
    rutas({
      [RUTA_COMPATIBLES]: paginaCompatibles([compatible({}, 0.9, 1)], true, { totalPages: 3, total: 41 }),
      '/ofertas/postulaciones/me': [],
    })
    renderRuta('/vacantes')
    await screen.findByText('41 ofertas abiertas', {}, ESPERA)

    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }))
    await waitFor(() =>
      expect(doble.get).toHaveBeenLastCalledWith(RUTA_COMPATIBLES, { params: { page: 2 } }),
    )

    fireEvent.change(screen.getByLabelText('Posición'), { target: { value: 'JUNGLA' } })
    fireEvent.change(screen.getByLabelText('Modalidad'), { target: { value: 'REMOTA' } })
    await waitFor(() =>
      expect(doble.get).toHaveBeenLastCalledWith(RUTA_COMPATIBLES, {
        params: { page: 1, rol: 'JUNGLA', modalidad: 'REMOTA' },
      }),
    )
  })

  it('sin resultados con filtros ofrece quitarlos', async () => {
    sesionDe('JUGADOR')
    rutas({ [RUTA_COMPATIBLES]: paginaCompatibles([]), '/ofertas/postulaciones/me': [] })
    renderRuta('/vacantes')
    expect(await screen.findByText('No hay ofertas abiertas', {}, ESPERA)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Departamento'), { target: { value: 'BOLIVAR' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Quitar filtros' }, ESPERA))
    await waitFor(() => expect(screen.getByLabelText('Departamento')).toHaveValue(''))
  })

  it('si la API falla, ofrece reintentar', async () => {
    sesionDe('JUGADOR')
    rutas({ [RUTA_COMPATIBLES]: errorApi(500), '/ofertas/postulaciones/me': [] })
    renderRuta('/vacantes')
    expect(await screen.findByText('No pudimos cargar las ofertas.', {}, ESPERA)).toBeInTheDocument()

    rutas({ [RUTA_COMPATIBLES]: paginaCompatibles([compatible({}, 0.9, 1)]), '/ofertas/postulaciones/me': [] })
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }))
    expect(await screen.findByRole('heading', { name: 'MID para la academia' }, ESPERA)).toBeInTheDocument()
  })
})

describe('Detalle de la oferta (/vacantes/:id)', () => {
  it('muestra los datos reales y los pesos que eligió el equipo, sin ranking', async () => {
    sesionDe('JUGADOR')
    rutas({ '/ofertas/oferta-1': oferta(), '/ofertas/postulaciones/me': [] })
    renderRuta('/vacantes/oferta-1')

    expect(await screen.findByRole('heading', { name: 'MID para la academia' }, ESPERA)).toBeInTheDocument()
    expect(screen.getByText('Diamante II')).toBeInTheDocument()
    expect(screen.getByText('50 %')).toBeInTheDocument()
    // Los pesos de la oferta muestran sólo las dimensiones con datos en el piloto.
    expect(screen.queryByText('Experiencia')).toBeNull()
    expect(screen.queryByText('Habilidades blandas')).toBeNull()
    expect(screen.queryByText(/Ranking de compatibilidad/i)).toBeNull()
  })

  it('el jugador se postula con su mensaje y la vista pasa a «Ya te postulaste»', async () => {
    sesionDe('JUGADOR')
    let postulado = false
    rutas({
      '/ofertas/oferta-1': oferta(),
      '/ofertas/postulaciones/me': () => (postulado ? [miPostulacion({ estado: 'ENVIADA' })] : []),
    })
    doble.post.mockImplementation(async () => {
      postulado = true
      return { data: miPostulacion({ estado: 'ENVIADA', revisadaEn: null, oferta: undefined }) }
    })
    renderRuta('/vacantes/oferta-1')

    fireEvent.click(await screen.findByRole('button', { name: /Postularme/ }, ESPERA))
    const dialogo = await screen.findByRole('dialog')
    fireEvent.change(within(dialogo).getByLabelText(/Mensaje para el equipo/), {
      target: { value: 'Juego MID desde hace tres años' },
    })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Enviar postulación' }))

    await waitFor(() =>
      expect(doble.post).toHaveBeenCalledWith('/ofertas/oferta-1/postulaciones', {
        mensaje: 'Juego MID desde hace tres años',
      }),
    )
    expect(await screen.findByText('Ya te postulaste', {}, ESPERA)).toBeInTheDocument()
  })

  it('una postulación duplicada muestra su mensaje en el formulario', async () => {
    sesionDe('JUGADOR')
    rutas({ '/ofertas/oferta-1': oferta(), '/ofertas/postulaciones/me': [] })
    doble.post.mockRejectedValue(errorApi(409, 'POSTULACION_DUPLICADA'))
    renderRuta('/vacantes/oferta-1')

    fireEvent.click(await screen.findByRole('button', { name: /Postularme/ }, ESPERA))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Enviar postulación' }))
    expect(await screen.findByText('Ya te habías postulado a esta oferta.')).toBeInTheDocument()
  })

  it('una oferta cerrada no ofrece postularse', async () => {
    sesionDe('JUGADOR')
    rutas({ '/ofertas/oferta-1': oferta({ estado: 'CERRADA' }), '/ofertas/postulaciones/me': [] })
    renderRuta('/vacantes/oferta-1')
    expect(await screen.findByText('Esta oferta ya no admite postulaciones.', {}, ESPERA)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Postularme/ })).toBeNull()
  })

  it('el scout la consulta sin botón de postulación', async () => {
    sesionDe('SCOUT')
    rutas({ '/ofertas/oferta-1': oferta() })
    renderRuta('/vacantes/oferta-1')
    expect(await screen.findByText(/Estás viendo la oferta como scout/, {}, ESPERA)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Postularme/ })).toBeNull()
  })

  it('un 404 muestra «Oferta no encontrada»', async () => {
    sesionDe('JUGADOR')
    rutas({ '/ofertas/no-existe': errorApi(404, 'NOT_FOUND'), '/ofertas/postulaciones/me': [] })
    renderRuta('/vacantes/no-existe')
    expect(await screen.findByText('Oferta no encontrada', {}, ESPERA)).toBeInTheDocument()
  })
})

describe('Mis postulaciones (pestaña de /mi-perfil)', () => {
  const perfilPropio = {
    tipo: 'JUGADOR',
    perfil: {
      id: 'jugador-1',
      usuarioId: 'cuenta-jugador',
      bio: null,
      pais: null,
      departamento: null,
      disponibilidadHoras: null,
      dispuestoRelocalizar: false,
      avatarUrl: null,
      creadoEn: '2026-09-10T00:00:00.000Z',
      actualizadoEn: '2026-09-10T00:00:00.000Z',
    },
  }

  it('se abre desde la URL y muestra el estado y la fecha de cada paso, sin marca de demostración', async () => {
    sesionDe('JUGADOR')
    rutas({
      '/perfiles/me': perfilPropio,
      '/ofertas/postulaciones/me': [
        miPostulacion(),
        miPostulacion({
          id: 'postulacion-2',
          estado: 'RECHAZADA',
          rechazadaEn: '2026-10-30T12:00:00.000Z',
          oferta: { ...miPostulacion().oferta, id: 'oferta-2', titulo: 'Soporte universitario', estado: 'CUBIERTA' },
        }),
      ],
    })
    renderRuta('/mi-perfil?pestana=postulaciones')

    const primera = (await screen.findByRole('heading', { name: 'MID para la academia' }, ESPERA)).closest('li')
    const segunda = screen.getByRole('heading', { name: 'Soporte universitario' }).closest('li')
    expect(within(primera!).getByText('MID para la academia')).toBeInTheDocument()
    expect(within(primera!).getAllByText('En revision')).not.toHaveLength(0)
    expect(within(primera!).getByText('Recibida')).toBeInTheDocument()
    expect(within(segunda!).getByText('Oferta cubierta')).toBeInTheDocument()
    expect(within(segunda!).getAllByText('Rechazada')).not.toHaveLength(0)
    expect(screen.queryByText(/Ejemplo de/)).toBeNull()
  })

  it('sin postulaciones invita a explorar las ofertas', async () => {
    sesionDe('JUGADOR')
    rutas({ '/perfiles/me': perfilPropio, '/ofertas/postulaciones/me': [] })
    renderRuta('/mi-perfil?pestana=postulaciones')
    expect(await screen.findByText('Todavía no te has postulado', {}, ESPERA)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Explorar oportunidades' })).toHaveAttribute('href', '/vacantes')
  })
})
