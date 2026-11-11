import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import type { Rol, UsuarioPublico } from '@proplay/shared'
import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { ToastProvider } from '@/context/ToastContext'
import { crearQueryClient } from '@/api/queryClient'

/**
 * RF-09 · RF-11 · Ranking de candidatos (/vacantes/:id/ranking) y detalle del
 * candidato (/vacantes/:id/ranking/:jugadorId) con datos reales: desglose que
 * suma el puntaje, jugador sin cuenta verificada, «faltan datos», filtro de
 * postulados, orden, recalcular, permisos del scout y del administrador y
 * cambio de estado de una postulación. El cliente HTTP es un doble en memoria.
 */
const doble = vi.hoisted(() => ({
  usuario: null as UsuarioPublico | null,
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
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
  return { ...real, api: { get: doble.get, post: doble.post, patch: doble.patch } }
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

/** Pesos de la oferta ADC del seed: remota, así que la geográfica no pesa. */
const PESOS = { tecnica: 0.6, experiencia: 0, habilidadesBlandas: 0, geografica: 0, disponibilidad: 0.4 }

const OFERTA = { id: 'oferta-1', titulo: 'ADC para la liga en línea', estado: 'ABIERTA', rol: 'ADC', pesos: PESOS }

const CALCULO = {
  oferta: OFERTA,
  calculadoEn: '2026-11-10T18:14:00.000Z',
  versionFormulas: 2,
  modo: 'CONTENIDO',
  pesoColaborativo: 0,
}

interface Cambios {
  tecnica?: Record<string, unknown>
  geografica?: Record<string, unknown>
  disponibilidad?: Record<string, unknown>
  jugador?: Record<string, unknown>
  postulacion?: { id: string; estado: string } | null
  pesos?: typeof PESOS
}

function candidato(
  puesto: number,
  nombre: string,
  desglose: { tecnica: number; geografica: number; disponibilidad: number },
  cambios: Cambios = {},
) {
  const pesos = cambios.pesos ?? PESOS
  return {
    puesto,
    jugador: {
      id: `jugador-${puesto}`,
      nombre,
      avatarUrl: null,
      pais: 'CO',
      departamento: 'SUCRE',
      disponibilidadHoras: 15,
      dispuestoRelocalizar: false,
      verificacion: { plataforma: 'RIOT', verificadaEn: '2026-10-01T00:00:00.000Z' },
      posicion: 'ADC',
      rango: 'PLATINO_IV',
      datosDel: '2026-11-02T12:00:00.000Z',
      ...cambios.jugador,
    },
    puntaje:
      pesos.tecnica * desglose.tecnica +
      pesos.geografica * desglose.geografica +
      pesos.disponibilidad * desglose.disponibilidad,
    desglose: { experiencia: 0, habilidadesBlandas: 0, ...desglose },
    explicacion: {
      pesos,
      dimensiones: {
        tecnica: {
          faltanDatos: false,
          motivo: null,
          posicionPedida: 'ADC',
          posicionPrincipal: 'ADC',
          fraccionEnPosicion: 0.8,
          rango: 'PLATINO_IV',
          rangoMinimo: 'PLATINO_IV',
          partidasAnalizadas: 20,
          datosDel: '2026-11-02T12:00:00.000Z',
          componentes: { posicion: 1, rango: 1, rendimiento: 0.6 },
          metricas: [
            { metrica: 'winRate', valor: 0.45, normalizado: 0.33 },
            { metrica: 'kda', valor: 5.38, normalizado: 1 },
            { metrica: 'oroPorMinuto', valor: 408, normalizado: 0.54 },
          ],
          ...cambios.tecnica,
        },
        experiencia: { faltanDatos: true, motivo: 'SIN_DATOS_PILOTO' },
        habilidadesBlandas: { faltanDatos: true, motivo: 'SIN_ENDORSEMENTS', endorsementsDeEquipos: 0 },
        geografica: {
          faltanDatos: false,
          motivo: 'OFERTA_REMOTA',
          modalidad: 'REMOTA',
          cercania: null,
          relocalizacionAplicada: false,
          ...cambios.geografica,
        },
        disponibilidad: {
          faltanDatos: false,
          motivo: null,
          horasJugador: 15,
          horasOferta: 20,
          ...cambios.disponibilidad,
        },
      },
    },
    similitud: 0.9,
    postulacion: cambios.postulacion ?? null,
  }
}

const SIN_CUENTA: Cambios = {
  jugador: { verificacion: null, posicion: null, rango: null, datosDel: null },
  tecnica: {
    faltanDatos: true,
    motivo: 'SIN_CUENTA_VERIFICADA',
    posicionPrincipal: null,
    fraccionEnPosicion: null,
    rango: null,
    partidasAnalizadas: null,
    datosDel: null,
    componentes: null,
    metricas: [],
  },
}

const ESPECIALISTA = candidato(1, 'Tomás Herrera', { tecnica: 0.78, geografica: 1, disponibilidad: 0.75 })
// Juega la posición a ratos: el factor de posición recorta la técnica.
const A_RATOS = candidato(2, 'Mariana Pardo', { tecnica: 0.21, geografica: 1, disponibilidad: 1 }, {
  jugador: { posicion: 'MID', rango: 'DIAMANTE_IV', disponibilidadHoras: 20 },
  tecnica: {
    posicionPrincipal: 'MID',
    fraccionEnPosicion: 0.2,
    rango: 'DIAMANTE_IV',
    componentes: { posicion: 1 / 3, rango: 1, rendimiento: 0.33 },
  },
  disponibilidad: { horasJugador: 20, horasOferta: 20 },
})
// Top de mucho rango que nunca juega ADC: técnica 0.
const OTRA_POSICION = candidato(3, 'Sofía Naranjo', { tecnica: 0, geografica: 1, disponibilidad: 1 }, {
  jugador: { posicion: 'TOP', rango: 'GRAN_MAESTRO', disponibilidadHoras: 30 },
  tecnica: {
    posicionPrincipal: 'TOP',
    fraccionEnPosicion: 0,
    rango: 'GRAN_MAESTRO',
    componentes: { posicion: 0, rango: 1, rendimiento: 0.7 },
  },
  disponibilidad: { horasJugador: 30, horasOferta: 20 },
})
const POSTULADA_SIN_CUENTA = candidato(4, 'Isabela Cortés', { tecnica: 0, geografica: 1, disponibilidad: 1 }, {
  ...SIN_CUENTA,
  disponibilidad: { horasJugador: 25, horasOferta: 20 },
  postulacion: { id: 'post-4', estado: 'ENVIADA' },
})
const SIN_HORAS = candidato(5, 'David García', { tecnica: 0, geografica: 1, disponibilidad: 0.5 }, {
  ...SIN_CUENTA,
  jugador: { ...SIN_CUENTA.jugador, disponibilidadHoras: null },
  disponibilidad: { faltanDatos: true, motivo: 'SIN_HORAS', horasJugador: null },
  postulacion: { id: 'post-5', estado: 'EN_REVISION' },
})

const TODOS = [ESPECIALISTA, A_RATOS, OTRA_POSICION, POSTULADA_SIN_CUENTA, SIN_HORAS]

function ranking(data = TODOS, cambios: Record<string, unknown> = {}) {
  return {
    data,
    meta: { page: 1, pageSize: 20, total: data.length, totalPages: 1 },
    ...CALCULO,
    ...cambios,
  }
}

function detalle(c: ReturnType<typeof candidato>, cambios: Record<string, unknown> = {}) {
  const i = TODOS.indexOf(c)
  const vecino = (v: ReturnType<typeof candidato> | undefined) =>
    v ? { id: v.jugador.id, nombre: v.jugador.nombre } : null
  return {
    candidato: c,
    anterior: vecino(TODOS[i - 1]),
    siguiente: vecino(TODOS[i + 1]),
    total: TODOS.length,
    ...CALCULO,
    ...cambios,
  }
}

const RUTA_RANKING = '/matching/ofertas/oferta-1/ranking'
const rutaCandidato = (c: ReturnType<typeof candidato>) =>
  `/matching/ofertas/oferta-1/candidatos/${c.jugador.id}`

function rutas(respuestas: Record<string, unknown>) {
  doble.get.mockImplementation(async (ruta: string) => {
    if (!(ruta in respuestas)) throw new Error(`Sin respuesta para ${ruta}`)
    return { data: respuestas[ruta] }
  })
}

function errorHttp(status: number, code = 'ERROR') {
  return Object.assign(new Error(String(status)), {
    isAxiosError: true,
    response: { status, data: { error: { code, message: code } } },
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

/** La tarjeta de un candidato, por su puesto y su nombre. */
const fila = (puesto: number, nombre: string) =>
  screen.findByRole('article', { name: `Puesto ${puesto}: ${nombre}` }, ESPERA)

/** Puntos de cada dimensión, leídos de la alternativa en texto de la barra. */
function puntosDe(contenedor: HTMLElement): number[] {
  const lista = within(contenedor).getByRole('list', { name: 'Aporte de cada dimensión al puntaje' })
  return within(lista)
    .getAllByRole('listitem')
    .map((item) => Number(/(\d+)\s+puntos?$/.exec(item.textContent ?? '')?.[1]))
}

beforeEach(() => {
  doble.usuario = null
  doble.get.mockReset()
  doble.post.mockReset()
  doble.patch.mockReset()
})

describe('Ranking de candidatos (/vacantes/:id/ranking)', () => {
  it('muestra cada candidato con su puesto, verificación, posición, rango, puntaje y postulación', async () => {
    sesionDe('EQUIPO')
    rutas({ [RUTA_RANKING]: ranking() })
    renderRuta('/vacantes/oferta-1/ranking')

    const primero = await fila(1, 'Tomás Herrera')
    expect(within(primero).getByRole('link', { name: 'Tomás Herrera' })).toHaveAttribute(
      'href',
      '/jugador/jugador-1',
    )
    expect(within(primero).getByText('Verificado')).toBeInTheDocument()
    expect(within(primero).getByText('ADC')).toBeInTheDocument()
    expect(within(primero).getByText('Platino IV')).toBeInTheDocument()
    expect(within(primero).getByText('77 %')).toBeInTheDocument()
    expect(within(primero).getByText('No se ha postulado')).toBeInTheDocument()
    expect(within(primero).getByRole('link', { name: 'Ver el detalle de Tomás Herrera' })).toHaveAttribute(
      'href',
      '/vacantes/oferta-1/ranking/jugador-1',
    )

    expect(screen.getByText('5 candidatos')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ranking de candidatos' })).toBeInTheDocument()
    expect(screen.getByText('ADC para la liga en línea')).toBeInTheDocument()
    // Es una vista real: sin aviso de datos de demostración.
    expect(screen.queryByText(/Datos de demostraci/i)).toBeNull()
    expect(doble.get).toHaveBeenCalledWith(RUTA_RANKING, {
      params: { page: 1, soloPostulados: false, orden: 'puntaje' },
    })
  })

  it('el desglose de cada candidato suma exactamente el puntaje que se muestra', async () => {
    sesionDe('EQUIPO')
    // Pesos del piloto, con las tres dimensiones visibles pesando.
    const pesos = { tecnica: 0.5, experiencia: 0, habilidadesBlandas: 0, geografica: 0.25, disponibilidad: 0.25 }
    const lista = [
      candidato(1, 'Ana Uno', { tecnica: 0.777, geografica: 0.6, disponibilidad: 0.8 }, { pesos }),
      candidato(2, 'Luis Dos', { tecnica: 0.333, geografica: 0.5, disponibilidad: 0.75 }, { pesos }),
      candidato(3, 'Eva Tres', { tecnica: 0.105, geografica: 0.3, disponibilidad: 1 }, { pesos }),
      candidato(4, 'Raúl Cuatro', { tecnica: 0, geografica: 0.1, disponibilidad: 0.33 }, { pesos }),
    ]
    rutas({ [RUTA_RANKING]: ranking(lista, { oferta: { ...OFERTA, pesos } }) })
    renderRuta('/vacantes/oferta-1/ranking')

    for (const c of lista) {
      const tarjeta = await fila(c.puesto, c.jugador.nombre)
      const puntos = puntosDe(tarjeta)
      const total = Math.round(c.puntaje * 100)
      expect(puntos).toHaveLength(3)
      expect(puntos.reduce((a, b) => a + b, 0)).toBe(total)
      expect(within(tarjeta).getByText(`${total} %`)).toBeInTheDocument()
      // La barra pinta esos mismos puntos como ancho de cada segmento.
      const segmentos = [...within(tarjeta).getByTestId('barra-aportes').children] as HTMLElement[]
      const anchos = segmentos.map((s) => Number.parseInt(s.style.width, 10))
      expect(anchos.reduce((a, b) => a + b, 0)).toBe(total)
      expect(anchos).toEqual(puntos.filter((p) => p > 0))
    }
  })

  it('sólo se desglosan las dimensiones visibles, y la que pesa 0 en la oferta no se lista', async () => {
    sesionDe('EQUIPO')
    rutas({ [RUTA_RANKING]: ranking() })
    renderRuta('/vacantes/oferta-1/ranking')

    const primero = await fila(1, 'Tomás Herrera')
    const desglose = within(primero).getByRole('list', { name: 'Aporte de cada dimensión al puntaje' })
    // 0,6 × 0,78 = 46,8 y 0,4 × 0,75 = 30: 47 + 30 = 77.
    expect(within(desglose).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Técnica 47 puntos',
      'Disponibilidad 30 puntos',
    ])
    expect(screen.queryByText(/Experiencia|Habilidades blandas/)).toBeNull()
    // Los pesos de la oferta hacen de leyenda de las barras.
    expect(screen.getByText('Técnica 60 %')).toBeInTheDocument()
    expect(screen.getByText('Geográfica 0 %')).toBeInTheDocument()
    expect(screen.getByText('Disponibilidad 40 %')).toBeInTheDocument()
  })

  it('el jugador sin cuenta verificada aparece marcado, sin posición ni rango y con «faltan datos»', async () => {
    sesionDe('EQUIPO')
    rutas({ [RUTA_RANKING]: ranking() })
    renderRuta('/vacantes/oferta-1/ranking')

    const tarjeta = await fila(4, 'Isabela Cortés')
    expect(within(tarjeta).getByText('Sin cuenta verificada')).toBeInTheDocument()
    expect(within(tarjeta).queryByText('Verificado')).toBeNull()
    expect(within(tarjeta).getByText('Faltan datos: cuenta verificada')).toBeInTheDocument()
    expect(puntosDe(tarjeta)).toEqual([0, 40])
    expect(within(tarjeta).getByText('40 %')).toBeInTheDocument()
    expect(within(tarjeta).getByText('Postulado · Recibida')).toBeInTheDocument()

    // Con las horas sin declarar, la disponibilidad va con el neutro y se avisa.
    const sinHoras = await fila(5, 'David García')
    expect(
      within(sinHoras).getByText('Faltan datos: cuenta verificada, horas disponibles'),
    ).toBeInTheDocument()
    expect(puntosDe(sinHoras)).toEqual([0, 20])
    // Quien tiene todos los datos no lleva la marca.
    expect(within(await fila(1, 'Tomás Herrera')).queryByText(/Faltan datos/)).toBeNull()
  })

  it('«Solo postulados» pide el filtro al servidor y conserva el puesto del ranking completo', async () => {
    sesionDe('EQUIPO')
    doble.get.mockImplementation(async (_ruta: string, opciones?: { params?: { soloPostulados?: boolean } }) => ({
      data: opciones?.params?.soloPostulados ? ranking([POSTULADA_SIN_CUENTA, SIN_HORAS]) : ranking(),
    }))
    renderRuta('/vacantes/oferta-1/ranking')
    await fila(1, 'Tomás Herrera')

    const todos = screen.getByRole('button', { name: 'Todos los candidatos' })
    const postulados = screen.getByRole('button', { name: 'Solo postulados' })
    expect(todos).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(postulados)

    await waitFor(() =>
      expect(doble.get).toHaveBeenLastCalledWith(RUTA_RANKING, {
        params: { page: 1, soloPostulados: true, orden: 'puntaje' },
      }),
    )
    await waitFor(() => expect(screen.queryByRole('article', { name: /Tomás Herrera/ })).toBeNull(), ESPERA)
    expect(postulados).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('2 candidatos')).toBeInTheDocument()
    // Sigue siendo el 4.º y el 5.º del ranking, no el 1.º y el 2.º.
    expect(await fila(4, 'Isabela Cortés')).toBeInTheDocument()
    expect(await fila(5, 'David García')).toBeInTheDocument()
  })

  it('sin postulaciones, «Solo postulados» ofrece volver a todos los candidatos', async () => {
    sesionDe('EQUIPO')
    doble.get.mockImplementation(async (_ruta: string, opciones?: { params?: { soloPostulados?: boolean } }) => ({
      data: opciones?.params?.soloPostulados ? ranking([]) : ranking(),
    }))
    renderRuta('/vacantes/oferta-1/ranking?postulados=1')

    expect(await screen.findByText('Nadie se ha postulado todavía', {}, ESPERA)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ver todos los candidatos' }))
    expect(await fila(1, 'Tomás Herrera')).toBeInTheDocument()
  })

  it('ordena por una dimensión visible pidiéndolo al servidor', async () => {
    sesionDe('EQUIPO')
    rutas({ [RUTA_RANKING]: ranking() })
    renderRuta('/vacantes/oferta-1/ranking')
    await fila(1, 'Tomás Herrera')

    const orden = screen.getByLabelText('Ordenar por')
    expect(within(orden).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Puntaje',
      'Técnica',
      'Geográfica',
      'Disponibilidad',
    ])
    fireEvent.change(orden, { target: { value: 'disponibilidad' } })
    await waitFor(() =>
      expect(doble.get).toHaveBeenLastCalledWith(RUTA_RANKING, {
        params: { page: 1, soloPostulados: false, orden: 'disponibilidad' },
      }),
    )
  })

  it('un orden que no es de las dimensiones visibles en la URL se ignora', async () => {
    sesionDe('EQUIPO')
    rutas({ [RUTA_RANKING]: ranking() })
    renderRuta('/vacantes/oferta-1/ranking?orden=experiencia&page=abc')
    await fila(1, 'Tomás Herrera')
    expect(doble.get).toHaveBeenCalledWith(RUTA_RANKING, {
      params: { page: 1, soloPostulados: false, orden: 'puntaje' },
    })
  })

  it('pagina el ranking', async () => {
    sesionDe('EQUIPO')
    rutas({
      [RUTA_RANKING]: { ...ranking(), meta: { page: 1, pageSize: 20, total: 45, totalPages: 3 } },
    })
    renderRuta('/vacantes/oferta-1/ranking')
    await fila(1, 'Tomás Herrera')

    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await waitFor(() =>
      expect(doble.get).toHaveBeenLastCalledWith(RUTA_RANKING, {
        params: { page: 2, soloPostulados: false, orden: 'puntaje' },
      }),
    )
  })

  it('muestra la fecha del cálculo y el modo, y «Recalcular» actualiza el ranking', async () => {
    sesionDe('EQUIPO')
    rutas({ [RUTA_RANKING]: ranking() })
    doble.post.mockResolvedValue({
      data: ranking([ESPECIALISTA], { calculadoEn: '2026-11-11T09:30:00.000Z' }),
    })
    renderRuta('/vacantes/oferta-1/ranking')
    await fila(1, 'Tomás Herrera')

    expect(screen.getByText(/^Calculado el 10\/11\/2026/)).toBeInTheDocument()
    expect(screen.getByText('Basado en contenido')).toBeInTheDocument()
    expect(screen.getByText('Fórmulas v2')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Recalcular' }))
    await waitFor(() =>
      expect(doble.post).toHaveBeenCalledWith('/matching/ofertas/oferta-1/recalcular', undefined, {
        params: { page: 1, soloPostulados: false, orden: 'puntaje' },
      }),
    )
    expect(await screen.findByText(/^Calculado el 11\/11\/2026/, {}, ESPERA)).toBeInTheDocument()
    expect(screen.getByText('1 candidato')).toBeInTheDocument()
    expect(await screen.findByText('Ranking recalculado.')).toBeInTheDocument()
  })

  it('al llegar al límite de recálculos avisa sin error y deja el ranking en pantalla', async () => {
    sesionDe('SCOUT')
    rutas({ [RUTA_RANKING]: ranking() })
    doble.post.mockRejectedValue(errorHttp(429, 'RATE_LIMITED'))
    renderRuta('/vacantes/oferta-1/ranking')
    await fila(1, 'Tomás Herrera')

    fireEvent.click(screen.getByRole('button', { name: 'Recalcular' }))
    const aviso = await screen.findByRole('status', {}, ESPERA)
    expect(aviso).toHaveTextContent(/Has recalculado muchas veces seguidas/)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('article', { name: 'Puesto 1: Tomás Herrera' })).toBeInTheDocument()
  })

  it('una oferta cerrada muestra su última instantánea, sin «Recalcular» ni cambios de estado', async () => {
    sesionDe('EQUIPO')
    rutas({ [RUTA_RANKING]: ranking(TODOS, { oferta: { ...OFERTA, estado: 'CERRADA' } }) })
    renderRuta('/vacantes/oferta-1/ranking')
    const tarjeta = await fila(4, 'Isabela Cortés')

    expect(screen.getByText(/La oferta está cerrada: este ranking es su última instantánea/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Recalcular' })).toBeNull()
    expect(within(tarjeta).queryByRole('button')).toBeNull()
  })

  it('el equipo dueño cambia el estado de una postulación desde el ranking', async () => {
    sesionDe('EQUIPO')
    rutas({ [RUTA_RANKING]: ranking() })
    doble.patch.mockResolvedValue({
      data: {
        id: 'post-4',
        ofertaId: 'oferta-1',
        jugadorId: 'jugador-4',
        estado: 'EN_REVISION',
        mensaje: null,
        creadoEn: '2026-11-06T12:00:00.000Z',
        revisadaEn: '2026-11-10T12:00:00.000Z',
        entrevistaEn: null,
        aceptadaEn: null,
        rechazadaEn: null,
        actualizadoEn: '2026-11-10T12:00:00.000Z',
      },
    })
    renderRuta('/vacantes/oferta-1/ranking')

    const tarjeta = await fila(4, 'Isabela Cortés')
    // Sólo las transiciones permitidas desde «Recibida».
    expect(within(tarjeta).getAllByRole('button').map((b) => b.textContent)).toEqual(['Revisar', 'Rechazar'])
    // A quien no se postuló sólo se le ve el perfil y el detalle.
    expect(within(await fila(1, 'Tomás Herrera')).queryByRole('button')).toBeNull()

    const pedidasAntes = doble.get.mock.calls.length
    fireEvent.click(within(tarjeta).getByRole('button', { name: 'Revisar: Isabela Cortés' }))
    await waitFor(() =>
      expect(doble.patch).toHaveBeenCalledWith('/ofertas/postulaciones/post-4', { estado: 'EN_REVISION' }),
    )
    // El ranking se vuelve a pedir para traer el estado nuevo.
    await waitFor(() => expect(doble.get.mock.calls.length).toBeGreaterThan(pedidasAntes))
    expect(await screen.findByText('Isabela Cortés: En revision.')).toBeInTheDocument()
  })

  it('el scout ve el ranking y recalcula, pero no cambia el estado de las postulaciones', async () => {
    sesionDe('SCOUT')
    rutas({ [RUTA_RANKING]: ranking() })
    renderRuta('/vacantes/oferta-1/ranking')

    const tarjeta = await fila(4, 'Isabela Cortés')
    expect(within(tarjeta).getByText('Postulado · Recibida')).toBeInTheDocument()
    expect(within(tarjeta).queryByRole('button')).toBeNull()
    expect(screen.queryByRole('button', { name: /Revisar|Rechazar|Aceptar|Invitar/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Recalcular' })).toBeInTheDocument()
  })

  it('el administrador sólo lee: ni recalcula ni cambia estados', async () => {
    sesionDe('ADMIN')
    rutas({ [RUTA_RANKING]: ranking() })
    renderRuta('/vacantes/oferta-1/ranking')

    await fila(4, 'Isabela Cortés')
    expect(screen.queryByRole('button', { name: 'Recalcular' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Revisar|Rechazar/ })).toBeNull()
  })

  it('el jugador no entra al ranking', async () => {
    sesionDe('JUGADOR')
    renderRuta('/vacantes/oferta-1/ranking')

    expect(await screen.findByText(/No tienes permisos para esta seccion/, {}, ESPERA)).toBeInTheDocument()
    expect(doble.get).not.toHaveBeenCalledWith(RUTA_RANKING, expect.anything())
  })

  it('otro equipo ve el estado «sin permiso» (403) y una oferta inexistente, el de no encontrada', async () => {
    sesionDe('EQUIPO')
    doble.get.mockRejectedValue(errorHttp(403, 'FORBIDDEN'))
    const { unmount } = renderRuta('/vacantes/oferta-1/ranking')
    expect(
      await screen.findByText(/El ranking de una oferta lo ven la organización que la publicó y los scouts/, {}, ESPERA),
    ).toBeInTheDocument()
    unmount()

    doble.get.mockRejectedValue(errorHttp(404, 'NOT_FOUND'))
    renderRuta('/vacantes/no-existe/ranking')
    expect(await screen.findByText('Oferta no encontrada', {}, ESPERA)).toBeInTheDocument()
  })

  it('si la carga falla ofrece reintentar', async () => {
    sesionDe('EQUIPO')
    doble.get.mockRejectedValueOnce(errorHttp(500))
    renderRuta('/vacantes/oferta-1/ranking')

    expect(await screen.findByText('No pudimos cargar el ranking.', {}, ESPERA)).toBeInTheDocument()
    rutas({ [RUTA_RANKING]: ranking() })
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }))
    expect(await fila(1, 'Tomás Herrera')).toBeInTheDocument()
  })
})

describe('Detalle del candidato (/vacantes/:id/ranking/:jugadorId)', () => {
  it('muestra el puesto, el puntaje y la tabla de valor, peso y aporte, que suma el total', async () => {
    sesionDe('EQUIPO')
    rutas({ [rutaCandidato(ESPECIALISTA)]: detalle(ESPECIALISTA) })
    renderRuta('/vacantes/oferta-1/ranking/jugador-1')

    expect(await screen.findByRole('heading', { name: 'Tomás Herrera' }, ESPERA)).toBeInTheDocument()
    expect(screen.getByText('Puesto 1 de 5')).toBeInTheDocument()
    expect(screen.getByText('Candidato para «ADC para la liga en línea»')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ver perfil público/ })).toHaveAttribute('href', '/jugador/jugador-1')

    const tabla = screen.getAllByRole('table')[0]!
    const filas = within(tabla)
      .getAllByRole('row')
      .map((tr) => [...tr.querySelectorAll('th, td')].map((c) => c.textContent))
    expect(filas).toEqual([
      ['Dimensión', 'Valor', 'Peso', 'Aporte'],
      ['Técnica', '78 %', '60 %', '47'],
      ['Geográfica', '100 %', '0 %', '0'],
      ['Disponibilidad', '75 %', '40 %', '30'],
      ['Puntaje', '77 %'],
    ])
    // La suma de la columna de aportes es el total que se muestra.
    const aportes = filas.slice(1, -1).map((celdas) => Number(celdas[3]))
    expect(aportes.reduce((a, b) => a + b, 0)).toBe(Number.parseInt(filas.at(-1)![1]!, 10))
    expect(screen.queryByText(/Experiencia|Habilidades blandas/)).toBeNull()
  })

  it('explica la técnica del especialista con el factor de posición, el rango, el rendimiento y las métricas', async () => {
    sesionDe('EQUIPO')
    rutas({ [rutaCandidato(ESPECIALISTA)]: detalle(ESPECIALISTA) })
    renderRuta('/vacantes/oferta-1/ranking/jugador-1')

    const tecnica = await screen.findByRole('region', { name: /Técnica/ }, ESPERA)
    expect(within(tecnica).getByText('Valor 78 %')).toBeInTheDocument()
    expect(
      within(tecnica).getByText(
        'Juega ADC en el 80 % de sus partidas de solo/dúo: cuenta como especialista (factor de posición 1).',
      ),
    ).toBeInTheDocument()
    expect(
      within(tecnica).getByText('Es Platino IV y la oferta pide Platino IV o más: cumple el rango (100 %).'),
    ).toBeInTheDocument()
    expect(
      within(tecnica).getByText('Rendimiento 60 %: media de las 3 métricas que cuentan para la posición.'),
    ).toBeInTheDocument()
    expect(
      within(tecnica).getByText(
        'Técnica = factor de posición × (0,45 × rango + 0,55 × rendimiento) = 1,00 × (0,45 × 1,00 + 0,55 × 0,60) = 78 %',
      ),
    ).toBeInTheDocument()
    const metricas = within(within(tecnica).getByRole('table'))
      .getAllByRole('row')
      .slice(1)
      .map((tr) => [...tr.querySelectorAll('th, td')].map((c) => c.textContent))
    expect(metricas).toEqual([
      ['Win rate', '45 %', '33 %'],
      ['KDA', '5,38', '100 %'],
      ['Oro por minuto', '408', '54 %'],
    ])
    expect(
      within(tecnica).getByText('20 partidas analizadas · datos de Riot del 2/11/2026'),
    ).toBeInTheDocument()

    expect(
      within(screen.getByRole('region', { name: /Geográfica/ })).getByText(
        'La oferta es remota: la ubicación no cuenta y la dimensión vale 100 %.',
      ),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('region', { name: /Disponibilidad/ })).getByText(
        'Dispone de 15 h a la semana de las 20 h que pide la oferta (75 %).',
      ),
    ).toBeInTheDocument()
    // Ninguna explicación generada por un modelo: el hueco existe, pero no se muestra.
    expect(screen.getByText(/No interviene ningún modelo de lenguaje/)).toBeInTheDocument()
  })

  it('quien juega la posición a ratos ve el factor de posición recortado', async () => {
    sesionDe('SCOUT')
    rutas({ [rutaCandidato(A_RATOS)]: detalle(A_RATOS) })
    renderRuta('/vacantes/oferta-1/ranking/jugador-2')

    const tecnica = await screen.findByRole('region', { name: /Técnica/ }, ESPERA)
    expect(
      within(tecnica).getByText(
        'Juega ADC en el 20 % de sus partidas de solo/dúo. No llega al 60 % de un especialista: el factor de posición es 0,33.',
      ),
    ).toBeInTheDocument()
    expect(within(tecnica).getByText('Su posición más jugada es Mid.')).toBeInTheDocument()
    expect(
      within(screen.getByRole('region', { name: /Disponibilidad/ })).getByText(
        'Dispone de 20 h a la semana y la oferta pide 20 h: la cubre (100 %).',
      ),
    ).toBeInTheDocument()
  })

  it('quien nunca juega la posición tiene técnica 0 aunque sea Gran Maestro', async () => {
    sesionDe('EQUIPO')
    rutas({ [rutaCandidato(OTRA_POSICION)]: detalle(OTRA_POSICION) })
    renderRuta('/vacantes/oferta-1/ranking/jugador-3')

    const tecnica = await screen.findByRole('region', { name: /Técnica/ }, ESPERA)
    expect(within(tecnica).getByText('Valor 0 %')).toBeInTheDocument()
    expect(
      within(tecnica).getByText(
        'No juega ADC en clasificatoria solo/dúo. El factor de posición es 0, así que la técnica vale 0 por mucho rango que tenga.',
      ),
    ).toBeInTheDocument()
    expect(within(tecnica).getByText('Su posición más jugada es Top.')).toBeInTheDocument()
    expect(
      within(tecnica).getByText('Es Gran Maestro y la oferta pide Platino IV o más: cumple el rango (100 %).'),
    ).toBeInTheDocument()
  })

  it('marca «Faltan datos» en la técnica sin cuenta verificada y en la disponibilidad sin horas', async () => {
    sesionDe('EQUIPO')
    rutas({ [rutaCandidato(SIN_HORAS)]: detalle(SIN_HORAS) })
    renderRuta('/vacantes/oferta-1/ranking/jugador-5')

    const tecnica = await screen.findByRole('region', { name: /Técnica/ }, ESPERA)
    expect(within(tecnica).getByText('Faltan datos')).toBeInTheDocument()
    expect(within(tecnica).getByText(/No tiene una cuenta de Riot verificada/)).toBeInTheDocument()
    expect(within(tecnica).queryByRole('table')).toBeNull()

    const disponibilidad = screen.getByRole('region', { name: /Disponibilidad/ })
    expect(within(disponibilidad).getByText('Faltan datos')).toBeInTheDocument()
    expect(within(disponibilidad).getByText('Valor 50 %')).toBeInTheDocument()
    expect(within(disponibilidad).getByText(/Se puntúa con el valor neutro \(50 %\)/)).toBeInTheDocument()

    // La geográfica tiene su dato (oferta remota): sin marca.
    expect(within(screen.getByRole('region', { name: /Geográfica/ })).queryByText('Faltan datos')).toBeNull()
    expect(screen.getAllByText('Sin cuenta verificada').length).toBeGreaterThan(0)
  })

  it('explica la geográfica de una oferta presencial: cercanía, ubicación y relocalización', async () => {
    sesionDe('EQUIPO')
    const pesos = { tecnica: 0.5, experiencia: 0, habilidadesBlandas: 0, geografica: 0.25, disponibilidad: 0.25 }
    const c = candidato(1, 'Tomás Herrera', { tecnica: 0.78, geografica: 0.75, disponibilidad: 0.75 }, {
      pesos,
      jugador: { departamento: 'ANTIOQUIA', dispuestoRelocalizar: true },
      geografica: { motivo: null, modalidad: 'PRESENCIAL', cercania: 'MISMO_PAIS', relocalizacionAplicada: true },
    })
    rutas({ [rutaCandidato(c)]: { ...detalle(ESPECIALISTA), candidato: c } })
    renderRuta('/vacantes/oferta-1/ranking/jugador-1')

    const geografica = await screen.findByRole('region', { name: /Geográfica/ }, ESPERA)
    expect(within(geografica).getByText('La oferta es presencial.')).toBeInTheDocument()
    expect(
      within(geografica).getByText('Vive en el mismo país que la oferta, en otra macrorregión.'),
    ).toBeInTheDocument()
    expect(within(geografica).getByText('Ubicación del jugador: Antioquia, Colombia.')).toBeInTheDocument()
    expect(
      within(geografica).getByText('Está dispuesto a relocalizarse, y eso sube el valor de la cercanía.'),
    ).toBeInTheDocument()
  })

  it('enlaza al candidato anterior y al siguiente, y vuelve al ranking con sus filtros', async () => {
    sesionDe('EQUIPO')
    rutas({
      [rutaCandidato(A_RATOS)]: detalle(A_RATOS),
      [rutaCandidato(OTRA_POSICION)]: detalle(OTRA_POSICION),
    })
    renderRuta('/vacantes/oferta-1/ranking/jugador-2?postulados=1')
    await screen.findByRole('heading', { name: 'Mariana Pardo' }, ESPERA)

    const vecinos = screen.getByRole('navigation', { name: 'Otros candidatos' })
    expect(within(vecinos).getByRole('link', { name: /Puesto 1: Tomás Herrera/ })).toHaveAttribute(
      'href',
      '/vacantes/oferta-1/ranking/jugador-1?postulados=1',
    )
    expect(screen.getByRole('link', { name: /Volver al ranking/ })).toHaveAttribute(
      'href',
      '/vacantes/oferta-1/ranking?postulados=1',
    )

    fireEvent.click(within(vecinos).getByRole('link', { name: /Puesto 3: Sofía Naranjo/ }))
    const titulo = await screen.findByRole('heading', { name: 'Sofía Naranjo' }, ESPERA)
    expect(screen.getByText('Puesto 3 de 5')).toBeInTheDocument()
    // El foco pasa al nombre del nuevo candidato.
    await waitFor(() => expect(titulo).toHaveFocus())
  })

  it('el primero no tiene anterior ni el último, siguiente', async () => {
    sesionDe('EQUIPO')
    rutas({ [rutaCandidato(ESPECIALISTA)]: detalle(ESPECIALISTA) })
    renderRuta('/vacantes/oferta-1/ranking/jugador-1')
    await screen.findByRole('heading', { name: 'Tomás Herrera' }, ESPERA)

    const vecinos = screen.getByRole('navigation', { name: 'Otros candidatos' })
    expect(within(vecinos).getAllByRole('link')).toHaveLength(1)
    expect(within(vecinos).getByRole('link', { name: /Puesto 2: Mariana Pardo/ })).toBeInTheDocument()
  })

  it('el equipo dueño cambia el estado de la postulación desde el detalle; el scout no', async () => {
    sesionDe('EQUIPO')
    rutas({ [rutaCandidato(POSTULADA_SIN_CUENTA)]: detalle(POSTULADA_SIN_CUENTA) })
    doble.patch.mockResolvedValue({
      data: {
        id: 'post-4',
        ofertaId: 'oferta-1',
        jugadorId: 'jugador-4',
        estado: 'RECHAZADA',
        mensaje: null,
        creadoEn: '2026-11-06T12:00:00.000Z',
        revisadaEn: null,
        entrevistaEn: null,
        aceptadaEn: null,
        rechazadaEn: '2026-11-10T12:00:00.000Z',
        actualizadoEn: '2026-11-10T12:00:00.000Z',
      },
    })
    const { unmount } = renderRuta('/vacantes/oferta-1/ranking/jugador-4')
    await screen.findByRole('heading', { name: 'Isabela Cortés' }, ESPERA)

    fireEvent.click(screen.getByRole('button', { name: 'Rechazar: Isabela Cortés' }))
    await waitFor(() =>
      expect(doble.patch).toHaveBeenCalledWith('/ofertas/postulaciones/post-4', { estado: 'RECHAZADA' }),
    )
    unmount()

    sesionDe('SCOUT')
    renderRuta('/vacantes/oferta-1/ranking/jugador-4')
    await screen.findByRole('heading', { name: 'Isabela Cortés' }, ESPERA)
    expect(screen.getByText('Recibida')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Revisar|Rechazar/ })).toBeNull()
  })

  it('un jugador que no está en el ranking muestra el estado de no encontrado', async () => {
    sesionDe('EQUIPO')
    doble.get.mockRejectedValue(errorHttp(404, 'NOT_FOUND'))
    renderRuta('/vacantes/oferta-1/ranking/no-existe')

    expect(await screen.findByText('Este jugador no está en el ranking', {}, ESPERA)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Volver al ranking/ })).toBeInTheDocument()
  })
})
