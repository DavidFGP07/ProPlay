import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import { dimensionDecisivaSchema, type Rol, type UsuarioPublico } from '@proplay/shared'
import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { ToastProvider } from '@/context/ToastContext'
import { crearQueryClient } from '@/api/queryClient'
import { fraseDecisiva, porcentajeDe, textoMediana } from '@/components/IndicadoresAnalitica'

/**
 * RF-13 · Analítica (/dashboard) y su resumen en el panel del equipo: tiempos
 * de las vacantes (H1), embudo, dimensión decisiva por oferta y mapa del
 * talento con las celdas ocultas. El cliente HTTP es un doble en memoria.
 */
const doble = vi.hoisted(() => ({
  usuario: null as UsuarioPublico | null,
  get: vi.fn(),
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
  return { ...real, api: { get: doble.get } }
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

const sinDatos = { n: 0, mediana: null, media: null }

function etapas(alcanzaron: [number, number, number, number], siguen: [number, number, number] = [0, 0, 0]) {
  return (['ENVIADA', 'EN_REVISION', 'ENTREVISTA', 'ACEPTADA'] as const).map((etapa, i) => ({
    etapa,
    alcanzaron: alcanzaron[i]!,
    conversion: i === 0 || alcanzaron[i - 1] === 0 ? null : alcanzaron[i]! / alcanzaron[i - 1]!,
    siguen: i < 3 ? siguen[i]! : 0,
    rechazadas: i === 1 ? 2 : 0,
    rechazadasAlCerrar: i === 1 ? 1 : 0,
    diasEnEtapa: i < 3 ? { n: 3, mediana: 2.5, media: 3 } : sinDatos,
  }))
}

const oferta = (id: string, titulo: string, estado: string, cambios: Record<string, unknown> = {}) => ({
  id,
  titulo,
  rol: 'ADC',
  estado,
  publicadaEn: '2026-09-01T15:00:00.000Z',
  cerradaEn: estado === 'ABIERTA' ? null : '2026-10-01T15:00:00.000Z',
  postulaciones: 3,
  diasHastaCubrir: null,
  diasHastaPrimerTryout: null,
  diasAbierta: null,
  ...cambios,
})

const OFERTAS = [
  oferta('o-adc', 'ADC para la liga en línea', 'ABIERTA', { diasAbierta: 5 }),
  oferta('o-soporte', 'Soporte para la Copa del Caribe', 'CUBIERTA', { diasHastaCubrir: 12, diasHastaPrimerTryout: 7 }),
  oferta('o-jungla', 'Jungla para la liga universitaria', 'CUBIERTA', { diasHastaCubrir: 21, diasHastaPrimerTryout: 9 }),
  oferta('o-top', 'Top para el clasificatorio regional', 'CUBIERTA', { diasHastaCubrir: 45, diasHastaPrimerTryout: 8 }),
  oferta('o-suplente', 'ADC suplente para la temporada', 'CERRADA'),
]

const EMBUDO_EQUIPO = {
  embudo: { postulaciones: 14, etapas: etapas([14, 10, 6, 3], [2, 1, 0]), coincidenciasExitosas: 3 },
  diasHastaCubrir: { n: 3, mediana: 21, media: 26 },
  diasHastaPrimerTryout: { n: 4, mediana: 7.5, media: 7.5 },
  cobertura: { abiertas: 1, cubiertas: 3, cerradasSinCubrir: 1, tasa: 0.75 },
  ofertas: OFERTAS,
  calculadoEn: '2026-11-17T12:00:00.000Z',
}

const embudoDe = (o: (typeof OFERTAS)[number], alcanzaron: [number, number, number, number]) => ({
  oferta: o,
  embudo: { postulaciones: alcanzaron[0], etapas: etapas(alcanzaron), coincidenciasExitosas: alcanzaron[3] },
  calculadoEn: '2026-11-17T12:00:00.000Z',
})

const DECISIVA = {
  ofertaId: 'o-adc',
  candidatos: 27,
  top: 5,
  suficiente: true,
  puntajeMedioTop: 0.62,
  puntajeMedioResto: 0.431,
  ventajaTotal: 0.189,
  dimensiones: [
    { dimension: 'tecnica', peso: 0.6, aporteMedioTop: 0.32, aporteMedioResto: 0.103, ventaja: 0.217 },
    { dimension: 'geografica', peso: 0, aporteMedioTop: 0, aporteMedioResto: 0, ventaja: 0 },
    { dimension: 'disponibilidad', peso: 0.4, aporteMedioTop: 0.3, aporteMedioResto: 0.328, ventaja: -0.028 },
  ],
  decisiva: 'tecnica',
  calculadoEn: '2026-11-17T12:00:00.000Z',
  versionFormulas: 2,
}

const celdas = (valores: Record<string, number | null>) => valores
const TALENTO = {
  jugadoresRegistrados: 22,
  verificados: 16,
  proporcionVerificados: 16 / 22,
  umbral: 3,
  grupos: [
    {
      grupo: 'CARIBE',
      total: 8,
      porPosicion: celdas({ TOP: null, JUNGLA: null, MID: null, ADC: null, SOPORTE: null }),
      porBanda: celdas({ HIERRO_PLATA: null, ORO_PLATINO: 3, ESMERALDA_DIAMANTE: 3, MAESTRO_O_SUPERIOR: null, SIN_RANGO: 0 }),
    },
    {
      grupo: 'RESTO_COLOMBIA',
      total: 8,
      porPosicion: celdas({ TOP: 3, JUNGLA: null, MID: null, ADC: 0, SOPORTE: null }),
      porBanda: celdas({ HIERRO_PLATA: 0, ORO_PLATINO: null, ESMERALDA_DIAMANTE: 4, MAESTRO_O_SUPERIOR: null, SIN_RANGO: 0 }),
    },
  ],
  macrorregiones: [
    {
      macrorregion: 'CARIBE',
      total: 8,
      departamentos: [
        { departamento: 'ATLANTICO', jugadores: 3 },
        { departamento: 'OTROS', jugadores: 5 },
      ],
    },
    {
      macrorregion: 'ANDINA',
      total: 8,
      departamentos: [
        { departamento: 'ANTIOQUIA', jugadores: 4 },
        { departamento: 'BOGOTA_DC', jugadores: 4 },
      ],
    },
    { macrorregion: 'PACIFICA', total: 0, departamentos: [] },
  ],
  fueraDeColombia: 0,
  sinUbicacion: 0,
  calculadoEn: '2026-11-17T12:00:00.000Z',
}

function rutas(respuestas: Record<string, unknown>) {
  doble.get.mockImplementation(async (ruta: string) => {
    if (!(ruta in respuestas)) throw new Error(`Sin respuesta para ${ruta}`)
    const respuesta = respuestas[ruta]
    if (respuesta instanceof Error) throw respuesta
    return { data: respuesta }
  })
}

const RUTAS_EQUIPO = {
  '/analitica/embudo': EMBUDO_EQUIPO,
  '/analitica/ofertas/o-adc/embudo': embudoDe(OFERTAS[0]!, [6, 3, 1, 0]),
  '/analitica/ofertas/o-adc/dimension-decisiva': DECISIVA,
  '/analitica/ofertas/o-top/embudo': embudoDe(OFERTAS[3]!, [2, 2, 2, 1]),
  '/analitica/ofertas/o-top/dimension-decisiva': { ...DECISIVA, ofertaId: 'o-top' },
  '/analitica/talento': TALENTO,
}

function error403() {
  return new AxiosError('Prohibido', '403', undefined, undefined, {
    status: 403,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { error: { code: 'FORBIDDEN', message: 'Prohibido' } },
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

/** La tarjeta cuyo título es `titulo`, para no confundir sus textos con los de otras. */
async function tarjeta(titulo: string) {
  const encabezado = await screen.findByRole('heading', { name: titulo }, ESPERA)
  return within(encabezado.closest('.card') as HTMLElement)
}

beforeEach(() => {
  doble.usuario = null
  doble.get.mockReset()
})

describe('funciones de presentación', () => {
  it('sin datos la mediana es «—», no «0 días»', () => {
    expect(textoMediana({ n: 0, mediana: null, media: null })).toBe('—')
    expect(textoMediana({ n: 4, mediana: 7.5, media: 7.5 })).toBe('7,5 días')
    expect(textoMediana({ n: 1, mediana: 1, media: 1 })).toBe('1 día')
  })

  it('un porcentaje con una celda o un total oculto no se calcula', () => {
    expect(porcentajeDe(3, 8)).toBe(37.5)
    expect(porcentajeDe(null, 8)).toBeNull()
    expect(porcentajeDe(3, null)).toBeNull()
    expect(porcentajeDe(0, 0)).toBeNull()
  })

  it('la frase de la dimensión decisiva cubre el caso normal, el empate y los pocos candidatos', () => {
    const datos = dimensionDecisivaSchema.parse(DECISIVA)
    expect(fraseDecisiva(datos)).toBe(
      'Lo que más separa a tus 5 primeros del resto es la técnica: 21,7 puntos de ventaja de media, sobre una diferencia total de 18,9 puntos.',
    )
    expect(fraseDecisiva({ ...datos, decisiva: null })).toMatch(/igualados/)
    expect(
      fraseDecisiva({
        ...datos,
        suficiente: false,
        candidatos: 6,
        dimensiones: [],
        decisiva: null,
        ventajaTotal: null,
        puntajeMedioTop: null,
        puntajeMedioResto: null,
      }),
    ).toBe('Hacen falta al menos 8 candidatos en el ranking para saber qué lo decide (ahora hay 6).')
  })
})

describe('Analítica del equipo (/dashboard)', () => {
  it('muestra los tiempos de H1, el embudo, las ofertas y el talento, sin datos de demostración', async () => {
    sesionDe('EQUIPO')
    rutas(RUTAS_EQUIPO)
    renderRuta('/dashboard')

    expect(await screen.findByRole('heading', { name: 'Analítica' }, ESPERA)).toBeInTheDocument()
    const vacantes = await tarjeta('Tus vacantes')
    expect(vacantes.getByText('21 días')).toBeInTheDocument()
    expect(vacantes.getByText('Media 26 · 3 ofertas')).toBeInTheDocument()
    expect(vacantes.getByText('7,5 días')).toBeInTheDocument()
    expect(vacantes.getByText(/^75\s?%$/)).toBeInTheDocument()
    expect(vacantes.getByText('3 de 4 terminadas')).toBeInTheDocument()

    const embudo = await tarjeta('Embudo de tus vacantes')
    const filaRecibida = embudo.getByRole('rowheader', { name: 'Recibida' }).closest('tr')!
    expect(within(filaRecibida).getAllByRole('cell').map((c) => c.textContent)).toEqual([
      '14',
      '—',
      '2',
      '0',
      '0',
      '2,5 días',
    ])

    const ofertas = await tarjeta('Ofertas publicadas')
    const filaAdc = ofertas.getByRole('rowheader', { name: 'ADC para la liga en línea' }).closest('tr')!
    expect(within(filaAdc).getByText('Abierta hace 5 días')).toBeInTheDocument()
    const filaTop = ofertas.getByRole('rowheader', { name: 'Top para el clasificatorio regional' }).closest('tr')!
    expect(within(filaTop).getByText('45 días')).toBeInTheDocument()

    const talento = await tarjeta('Talento verificado')
    expect(await talento.findByText('Atlántico 3 · Otros departamentos 5', {}, ESPERA)).toBeInTheDocument()
    expect(talento.getAllByText('Oculto').length).toBeGreaterThan(0)
    expect(screen.queryByText(/Datos de demostraci/i)).toBeNull()
  })

  it('por oferta abre la abierta más reciente con su embudo y su dimensión decisiva, y cambia al elegir otra', async () => {
    sesionDe('EQUIPO')
    rutas(RUTAS_EQUIPO)
    renderRuta('/dashboard')

    const porOferta = await tarjeta('Por oferta')
    expect(porOferta.getByLabelText('Oferta')).toHaveValue('o-adc')
    expect(
      await porOferta.findByText(/es la técnica: 21,7 puntos de ventaja de media/, {}, ESPERA),
    ).toBeInTheDocument()
    const filaDisponibilidad = porOferta.getByRole('rowheader', { name: 'Disponibilidad' }).closest('tr')!
    expect(within(filaDisponibilidad).getByText('juega en contra de los primeros')).toBeInTheDocument()
    expect(porOferta.getByRole('link', { name: 'Ver el ranking' })).toHaveAttribute('href', '/vacantes/o-adc/ranking')

    fireEvent.change(porOferta.getByLabelText('Oferta'), { target: { value: 'o-top' } })
    await waitFor(() => expect(doble.get).toHaveBeenCalledWith('/analitica/ofertas/o-top/embudo'))
    expect(doble.get).toHaveBeenCalledWith('/analitica/ofertas/o-top/dimension-decisiva')
  })

  it('sin ofertas cubiertas lo dice, en vez de un 0', async () => {
    sesionDe('EQUIPO')
    rutas({
      ...RUTAS_EQUIPO,
      '/analitica/embudo': {
        ...EMBUDO_EQUIPO,
        diasHastaCubrir: sinDatos,
        cobertura: { abiertas: 1, cubiertas: 0, cerradasSinCubrir: 0, tasa: null },
        ofertas: [OFERTAS[0]],
      },
    })
    renderRuta('/dashboard')

    const vacantes = await tarjeta('Tus vacantes')
    expect(await vacantes.findByText('Aún no hay ofertas cubiertas', {}, ESPERA)).toBeInTheDocument()
    expect(vacantes.getByText('Ninguna terminada todavía')).toBeInTheDocument()
  })

  it('un equipo sin ofertas publicadas recibe la invitación a publicar', async () => {
    sesionDe('EQUIPO')
    rutas({ ...RUTAS_EQUIPO, '/analitica/embudo': { ...EMBUDO_EQUIPO, ofertas: [] } })
    renderRuta('/dashboard')

    expect(await screen.findByText('Todavía no has publicado ofertas', {}, ESPERA)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Publicar oferta' })).toHaveAttribute('href', '/panel-equipo/ofertas/nueva')
  })

  it('con pocos candidatos explica que no se puede saber qué decide el ranking', async () => {
    sesionDe('EQUIPO')
    rutas({
      ...RUTAS_EQUIPO,
      '/analitica/ofertas/o-adc/dimension-decisiva': {
        ...DECISIVA,
        candidatos: 6,
        suficiente: false,
        puntajeMedioTop: null,
        puntajeMedioResto: null,
        ventajaTotal: null,
        dimensiones: [],
        decisiva: null,
      },
    })
    renderRuta('/dashboard')

    expect(
      await screen.findByText(/Hacen falta al menos 8 candidatos.*\(ahora hay 6\)/, {}, ESPERA),
    ).toBeInTheDocument()
  })

  it('si no puede cargar el embudo ofrece reintentar', async () => {
    sesionDe('EQUIPO')
    let fallos = 1
    doble.get.mockImplementation(async (ruta: string) => {
      if (ruta === '/analitica/embudo' && fallos-- > 0) throw new Error('caída')
      if (!(ruta in RUTAS_EQUIPO)) throw new Error(`Sin respuesta para ${ruta}`)
      return { data: RUTAS_EQUIPO[ruta as keyof typeof RUTAS_EQUIPO] }
    })
    renderRuta('/dashboard')

    expect(await screen.findByText('No pudimos cargar la analítica.', {}, ESPERA)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect((await tarjeta('Tus vacantes')).getByText('21 días')).toBeInTheDocument()
  })

  it('un 403 del talento muestra el estado sin permiso', async () => {
    sesionDe('EQUIPO')
    rutas({ ...RUTAS_EQUIPO, '/analitica/talento': error403() })
    renderRuta('/dashboard')

    const talento = await tarjeta('Talento verificado')
    expect(await talento.findByText('No tienes acceso a esta sección', {}, ESPERA)).toBeInTheDocument()
  })
})

describe('Analítica del scout', () => {
  it('ve sólo el talento verificado: no pide el embudo de ningún equipo', async () => {
    sesionDe('SCOUT')
    rutas({ '/analitica/talento': TALENTO })
    renderRuta('/dashboard')

    expect(await screen.findByRole('heading', { name: 'Talento verificado' }, ESPERA)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Tus vacantes' })).toBeNull()
    expect(doble.get).not.toHaveBeenCalledWith('/analitica/embudo')
  })
})

describe('Resumen de la analítica en el panel', () => {
  it('el equipo ve sus cifras reales y el enlace a la analítica', async () => {
    sesionDe('EQUIPO')
    rutas({
      ...RUTAS_EQUIPO,
      '/perfiles/me': {
        tipo: 'EQUIPO',
        perfil: {
          id: 'equipo-1',
          usuarioId: 'cuenta-equipo',
          nombreOrg: 'Caribe eSports',
          descripcion: null,
          sitioWeb: null,
          logoUrl: null,
          pais: 'CO',
          departamento: 'ATLANTICO',
          creadoEn: '2026-09-10T00:00:00.000Z',
          actualizadoEn: '2026-09-10T00:00:00.000Z',
        },
      },
      '/ofertas/me': { data: [], meta: { page: 1, pageSize: 100, total: 0, totalPages: 1 } },
    })
    renderRuta('/panel-equipo')

    const resumen = within(await screen.findByRole('region', { name: 'Resumen de la analítica' }, ESPERA))
    expect(resumen.getByText('21 días')).toBeInTheDocument()
    // En curso: 2 recibidas y 1 en revisión sin decisión.
    expect(resumen.getByText('Postulaciones en curso').parentElement).toHaveTextContent('3')
    expect(resumen.getByRole('link', { name: 'Ver la analítica' })).toHaveAttribute('href', '/dashboard')
    expect(screen.queryByText(/Datos de demostraci/i)).toBeNull()
  })

  it('el scout ve el resumen del talento verificado', async () => {
    sesionDe('SCOUT')
    rutas({ '/analitica/talento': TALENTO })
    renderRuta('/panel-equipo')

    const resumen = within(await screen.findByRole('region', { name: 'Resumen de la analítica' }, ESPERA))
    expect(resumen.getByText('Jugadores verificados').parentElement).toHaveTextContent('16')
    expect(resumen.getByText('Del Caribe colombiano').parentElement).toHaveTextContent('8')
    expect(doble.get).not.toHaveBeenCalledWith('/analitica/embudo')
  })
})
