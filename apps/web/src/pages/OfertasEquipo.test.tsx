import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { PESOS_MATCHING, type Rol, type UsuarioPublico } from '@proplay/shared'
import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { ToastProvider } from '@/context/ToastContext'
import { crearQueryClient } from '@/api/queryClient'

/**
 * RF-07 · RF-09 · RF-10 · Vistas del equipo con datos reales: crear y editar
 * oferta con los deslizadores de pesos, gestión de la oferta propia,
 * postulaciones recibidas dentro del detalle y «Tus ofertas» del panel. El
 * cliente HTTP es un doble en memoria.
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

const PERFIL_EQUIPO = {
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
}

function oferta(cambios: Record<string, unknown> = {}) {
  return {
    id: 'oferta-1',
    equipoId: 'equipo-1',
    titulo: 'MID para la academia',
    juego: 'League of Legends',
    rol: 'MID',
    rangoMinimo: null,
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

function recibida(id: string, nombre: string, estado: string, cambios: Record<string, unknown> = {}) {
  return {
    id,
    ofertaId: 'oferta-1',
    jugadorId: `perfil-${id}`,
    estado,
    mensaje: 'Me interesa la vacante.',
    creadoEn: '2026-10-21T12:00:00.000Z',
    revisadaEn: null,
    entrevistaEn: null,
    aceptadaEn: null,
    rechazadaEn: null,
    actualizadoEn: '2026-10-21T12:00:00.000Z',
    jugador: { id: `perfil-${id}`, nombre, avatarUrl: null, pais: 'CO', departamento: 'BOLIVAR' },
    ...cambios,
  }
}

function rutas(respuestas: Record<string, unknown>) {
  doble.get.mockImplementation(async (ruta: string) => {
    if (!(ruta in respuestas)) throw new Error(`Sin respuesta para ${ruta}`)
    return { data: respuestas[ruta] }
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
  doble.patch.mockReset()
})

async function rellenarOferta() {
  fireEvent.change(await screen.findByLabelText(/^Título de la oferta/, {}, ESPERA), {
    target: { value: 'ADC para la liga en línea' },
  })
  fireEvent.change(screen.getByLabelText('Posición'), { target: { value: 'ADC' } })
  fireEvent.change(screen.getByLabelText(/^Departamento/), { target: { value: 'ATLANTICO' } })
  fireEvent.change(screen.getByLabelText(/^Descripción/), {
    target: { value: 'Equipo de la liga en línea busca ADC para la temporada.' },
  })
}

describe('Crear oferta con pesos (/panel-equipo/ofertas/nueva)', () => {
  it('los deslizadores arrancan en los valores por defecto y siempre suman 100 %', async () => {
    sesionDe('EQUIPO')
    renderRuta('/panel-equipo/ofertas/nueva')

    const tecnica = await screen.findByRole('slider', { name: 'Técnica' }, ESPERA)
    expect(tecnica).toHaveValue('50')
    fireEvent.change(tecnica, { target: { value: '61' } })

    // Sólo hay tres deslizadores: experiencia y habilidades blandas no tienen datos en el piloto.
    expect(screen.getAllByRole('slider')).toHaveLength(3)
    expect(screen.queryByRole('slider', { name: 'Experiencia' })).toBeNull()
    expect(screen.queryByRole('slider', { name: 'Habilidades blandas' })).toBeNull()
    expect(screen.queryByText(/Experiencia|Habilidades blandas/)).toBeNull()
    // 39 puntos entre 25/25: se reparten a medias.
    expect(screen.getByRole('slider', { name: 'Geográfica' })).toHaveValue('20')
    expect(screen.getByRole('slider', { name: 'Disponibilidad' })).toHaveValue('19')
    expect(screen.getByText('Total: 100 %')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Restablecer/ }))
    expect(screen.getByRole('slider', { name: 'Técnica' })).toHaveValue('50')
  })

  it('publica con los pesos elegidos en fracciones y lleva al detalle', async () => {
    sesionDe('EQUIPO')
    rutas({ '/ofertas/oferta-nueva': oferta({ id: 'oferta-nueva' }), '/perfiles/me': PERFIL_EQUIPO })
    doble.post.mockResolvedValue({ data: oferta({ id: 'oferta-nueva' }) })
    renderRuta('/panel-equipo/ofertas/nueva')

    await rellenarOferta()
    fireEvent.change(screen.getByRole('slider', { name: 'Geográfica' }), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar oferta' }))

    await waitFor(() => expect(doble.post).toHaveBeenCalled())
    const [ruta, cuerpo] = doble.post.mock.calls[0]!
    expect(ruta).toBe('/ofertas')
    expect(cuerpo).toMatchObject({
      titulo: 'ADC para la liga en línea',
      rol: 'ADC',
      modalidad: 'PRESENCIAL',
      pais: 'CO',
      departamento: 'ATLANTICO',
      estado: 'ABIERTA',
    })
    expect(cuerpo.pesos.geografica).toBe(0)
    const suma = Object.values(cuerpo.pesos as Record<string, number>).reduce((a, b) => a + b, 0)
    expect(suma).toBeCloseTo(1, 6)
    expect(await screen.findByRole('heading', { name: 'MID para la academia' }, ESPERA)).toBeInTheDocument()
  })

  it('guarda como borrador; una oferta remota no envía ubicación', async () => {
    sesionDe('EQUIPO')
    rutas({ '/ofertas/oferta-nueva': oferta({ id: 'oferta-nueva', estado: 'BORRADOR' }), '/perfiles/me': PERFIL_EQUIPO })
    doble.post.mockResolvedValue({ data: oferta({ id: 'oferta-nueva', estado: 'BORRADOR' }) })
    renderRuta('/panel-equipo/ofertas/nueva')

    await rellenarOferta()
    fireEvent.change(screen.getByLabelText('Modalidad'), { target: { value: 'REMOTA' } })
    // Remota: en lugar de campos desactivados, una nota que explica por qué no hay ubicación.
    expect(screen.getByRole('note')).toHaveTextContent('Oferta remota: sin ubicación')
    expect(screen.queryByLabelText('País')).toBeNull()
    expect(screen.queryByLabelText(/^Departamento/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))

    await waitFor(() =>
      expect(doble.post).toHaveBeenCalledWith(
        '/ofertas',
        expect.objectContaining({ estado: 'BORRADOR', modalidad: 'REMOTA', pais: null, departamento: null }),
      ),
    )
  })

  it('fuera de Colombia el departamento se desactiva y dice por qué', async () => {
    sesionDe('EQUIPO')
    renderRuta('/panel-equipo/ofertas/nueva')
    fireEvent.change(await screen.findByLabelText('País', {}, ESPERA), { target: { value: 'MX' } })
    const departamento = screen.getByLabelText(/^Departamento/)
    expect(departamento).toBeDisabled()
    expect(departamento.closest('label')).toHaveTextContent('Sólo se pide en Colombia.')
  })

  it('valida en el cliente sin llamar a la API', async () => {
    sesionDe('EQUIPO')
    renderRuta('/panel-equipo/ofertas/nueva')
    fireEvent.click(await screen.findByRole('button', { name: 'Publicar oferta' }, ESPERA))
    expect(await screen.findAllByRole('alert')).not.toHaveLength(0)
    expect(doble.post).not.toHaveBeenCalled()
  })

  it('el scout no entra a crear ofertas', async () => {
    sesionDe('SCOUT')
    renderRuta('/panel-equipo/ofertas/nueva')
    expect(await screen.findByText(/No tienes permisos para esta seccion/i, {}, ESPERA)).toBeInTheDocument()
  })
})

describe('Editar oferta (/panel-equipo/ofertas/:id/editar)', () => {
  it('carga la oferta propia y guarda con PATCH', async () => {
    sesionDe('EQUIPO')
    rutas({ '/ofertas/oferta-1': oferta(), '/perfiles/me': PERFIL_EQUIPO })
    doble.patch.mockResolvedValue({ data: oferta({ titulo: 'MID para la academia 2027' }) })
    renderRuta('/panel-equipo/ofertas/oferta-1/editar')

    const titulo = await screen.findByLabelText(/^Título de la oferta/, {}, ESPERA)
    expect(titulo).toHaveValue('MID para la academia')
    fireEvent.change(titulo, { target: { value: 'MID para la academia 2027' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() =>
      expect(doble.patch).toHaveBeenCalledWith(
        '/ofertas/oferta-1',
        expect.objectContaining({ titulo: 'MID para la academia 2027', pesos: PESOS_MATCHING }),
      ),
    )
  })

  it('no deja editar la oferta de otro equipo', async () => {
    sesionDe('EQUIPO')
    rutas({
      '/ofertas/oferta-1': oferta({ equipo: { id: 'otro', nombreOrg: 'Andes Gaming', logoUrl: null } }),
      '/perfiles/me': PERFIL_EQUIPO,
    })
    renderRuta('/panel-equipo/ofertas/oferta-1/editar')
    expect(await screen.findByText('No puedes editar esta oferta', {}, ESPERA)).toBeInTheDocument()
  })
})

describe('Detalle de una oferta propia', () => {
  const RECIBIDAS = [
    recibida('p1', 'Andrés Molina', 'ENVIADA'),
    recibida('p2', 'Valentina Ríos', 'ACEPTADA', { revisadaEn: '2026-10-22T12:00:00.000Z', entrevistaEn: '2026-10-24T12:00:00.000Z', aceptadaEn: '2026-10-28T12:00:00.000Z' }),
  ]

  it('el equipo gestiona las postulaciones recibidas según sus transiciones', async () => {
    sesionDe('EQUIPO')
    rutas({ '/ofertas/oferta-1': oferta(), '/perfiles/me': PERFIL_EQUIPO, '/ofertas/oferta-1/postulaciones': RECIBIDAS })
    doble.patch.mockResolvedValue({ data: { ...RECIBIDAS[0], jugador: undefined, estado: 'EN_REVISION', revisadaEn: '2026-11-01T12:00:00.000Z' } })
    renderRuta('/vacantes/oferta-1')

    const andres = (await screen.findByRole('heading', { name: 'Andrés Molina' }, ESPERA)).closest('article')!
    const valentina = screen.getByRole('heading', { name: 'Valentina Ríos' }).closest('article')!
    // Una aceptada ya no tiene transiciones; una enviada, revisar o rechazar.
    expect(within(valentina).queryByRole('button')).toBeNull()
    expect(within(andres).getByRole('button', { name: 'Rechazar: Andrés Molina' })).toBeInTheDocument()
    expect(within(andres).getByRole('link', { name: 'Ver perfil' })).toHaveAttribute('href', '/jugador/perfil-p1')

    fireEvent.click(within(andres).getByRole('button', { name: 'Revisar: Andrés Molina' }))
    await waitFor(() =>
      expect(doble.patch).toHaveBeenCalledWith('/ofertas/postulaciones/p1', { estado: 'EN_REVISION' }),
    )
  })

  it('el equipo dueño entra al ranking de candidatos desde el detalle, también en su borrador', async () => {
    sesionDe('EQUIPO')
    rutas({ '/ofertas/oferta-1': oferta({ estado: 'BORRADOR', publicadaEn: null }), '/perfiles/me': PERFIL_EQUIPO })
    renderRuta('/vacantes/oferta-1')

    expect(
      await screen.findByRole('link', { name: 'Ver ranking de candidatos' }, ESPERA),
    ).toHaveAttribute('href', '/vacantes/oferta-1/ranking')
  })

  it('cerrar pide confirmación y avisa de las postulaciones en proceso', async () => {
    sesionDe('EQUIPO')
    rutas({ '/ofertas/oferta-1': oferta(), '/perfiles/me': PERFIL_EQUIPO, '/ofertas/oferta-1/postulaciones': RECIBIDAS })
    doble.patch.mockResolvedValue({ data: oferta({ estado: 'CERRADA', cerradaEn: '2026-11-01T12:00:00.000Z' }) })
    renderRuta('/vacantes/oferta-1')

    expect(await screen.findByRole('link', { name: /Editar/ }, ESPERA)).toHaveAttribute(
      'href',
      '/panel-equipo/ofertas/oferta-1/editar',
    )
    await screen.findByRole('heading', { name: 'Andrés Molina' }, ESPERA)
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sin cubrir' }))
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByText('Hay 1 postulación en proceso.')).toBeInTheDocument()
    expect(doble.patch).not.toHaveBeenCalled()

    fireEvent.click(within(dialogo).getByRole('button', { name: 'Confirmar' }))
    await waitFor(() =>
      expect(doble.patch).toHaveBeenCalledWith('/ofertas/oferta-1/estado', { estado: 'CERRADA' }),
    )
  })

  it('cubrir sin aceptadas muestra el mensaje del 409', async () => {
    sesionDe('EQUIPO')
    rutas({ '/ofertas/oferta-1': oferta(), '/perfiles/me': PERFIL_EQUIPO, '/ofertas/oferta-1/postulaciones': [] })
    const { AxiosError, AxiosHeaders } = await import('axios')
    doble.patch.mockRejectedValue(
      new AxiosError('Error', '409', undefined, undefined, {
        status: 409,
        statusText: '',
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: { error: { code: 'OFERTA_SIN_ACEPTADA', message: 'x' } },
      }),
    )
    renderRuta('/vacantes/oferta-1')

    fireEvent.click(await screen.findByRole('button', { name: 'Marcar como cubierta' }, ESPERA))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirmar' }))
    expect(await screen.findByText(/acepta antes al menos una postulación/)).toBeInTheDocument()
  })

  it('el scout consulta las postulaciones sin botones de estado', async () => {
    sesionDe('SCOUT')
    rutas({ '/ofertas/oferta-1': oferta(), '/ofertas/oferta-1/postulaciones': RECIBIDAS })
    renderRuta('/vacantes/oferta-1')

    const andres = (await screen.findByRole('heading', { name: 'Andrés Molina' }, ESPERA)).closest('article')!
    expect(within(andres).queryByRole('button')).toBeNull()
    expect(screen.getByText(/Como scout puedes consultar las postulaciones/)).toBeInTheDocument()
    // El scout también entra al ranking de las ofertas publicadas.
    expect(screen.getByRole('link', { name: 'Ver ranking de candidatos' })).toHaveAttribute(
      'href',
      '/vacantes/oferta-1/ranking',
    )
    expect(screen.queryByRole('link', { name: /Editar/ })).toBeNull()
  })
})

describe('Panel del equipo: «Tus ofertas»', () => {
  it('lista las ofertas reales del equipo con su estado y sus postulaciones', async () => {
    sesionDe('EQUIPO')
    rutas({
      '/perfiles/me': PERFIL_EQUIPO,
      '/ofertas/me': {
        data: [
          { ...oferta(), totalPostulaciones: 4 },
          { ...oferta({ id: 'oferta-2', titulo: 'Top para la clausura', rol: 'TOP', estado: 'BORRADOR', publicadaEn: null }), totalPostulaciones: 0 },
        ],
        meta: { page: 1, pageSize: 100, total: 2, totalPages: 1 },
      },
    })
    renderRuta('/panel-equipo')

    const top = (await screen.findByRole('heading', { name: 'Top para la clausura' }, ESPERA)).closest('li')!
    expect(within(top).getByText('Borrador')).toBeInTheDocument()
    expect(screen.getByText('4 postulaciones')).toBeInTheDocument()
    expect(within(top).getByRole('link', { name: 'Gestionar: Top para la clausura' })).toHaveAttribute(
      'href',
      '/vacantes/oferta-2',
    )
  })
})
