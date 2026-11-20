import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '@/api/queryClient'
import { NotificacionesBell } from '@/components/NotificacionesBell'
import { es } from '@/i18n/es'

/**
 * RF-12 · Campana de notificaciones: contador anunciado, lista con el texto y
 * el enlace de cada tipo, marcar una al abrirla, marcar todas, Esc y consulta
 * cada 60 s. El cliente HTTP es un doble en memoria.
 */
const doble = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))

vi.mock('@/api/client', async (original) => {
  const real = await original<typeof import('@/api/client')>()
  return { ...real, api: { get: doble.get, post: doble.post } }
})

const hace = (minutos: number) => new Date(Date.now() - minutos * 60_000).toISOString()

const NOTIFICACIONES = [
  {
    id: 'n1',
    tipo: 'NUEVA_POSTULACION',
    payload: { ofertaId: 'o1', ofertaTitulo: 'ADC para la liga', postulacionId: 'p1', jugadorNombre: 'Tomás Herrera' },
    leidaEn: null,
    creadoEn: hace(5),
  },
  {
    id: 'n2',
    tipo: 'POSTULACION_ACTUALIZADA',
    payload: { ofertaId: 'o2', ofertaTitulo: 'MID academia', postulacionId: 'p2', estado: 'ENTREVISTA', origen: 'EQUIPO' },
    leidaEn: null,
    creadoEn: hace(60 * 26),
  },
  {
    id: 'n3',
    tipo: 'POSTULACION_ACTUALIZADA',
    payload: { ofertaId: 'o3', ofertaTitulo: 'Top regional', postulacionId: 'p3', estado: 'RECHAZADA', origen: 'CIERRE_OFERTA' },
    leidaEn: hace(10),
    creadoEn: hace(60 * 24 * 3),
  },
]

function servidor(noLeidas = 2) {
  doble.get.mockImplementation(async (ruta: string) => {
    if (ruta === '/notificaciones/contador') return { data: { noLeidas } }
    if (ruta === '/notificaciones') {
      return { data: { data: NOTIFICACIONES, meta: { page: 1, pageSize: 10, total: 3, totalPages: 1 } } }
    }
    throw new Error(`Sin respuesta para ${ruta}`)
  })
  doble.post.mockResolvedValue({ data: { marcadas: 1 } })
}

function Ubicacion() {
  const { pathname, search } = useLocation()
  return <p data-testid="ubicacion">{pathname + search}</p>
}

function renderCampana() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <QueryClientProvider client={crearQueryClient()}>
        <NotificacionesBell />
        <Routes>
          <Route path="*" element={<Ubicacion />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

const ESPERA = { timeout: 5000 }

beforeEach(() => {
  doble.get.mockReset()
  doble.post.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Campana de notificaciones', () => {
  it('anuncia el contador en el nombre del botón y en un aviso educado', async () => {
    servidor(2)
    renderCampana()
    const boton = await screen.findByRole('button', { name: 'Notificaciones, 2 sin leer' }, ESPERA)
    expect(boton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('Tienes 2 notificaciones sin leer')).toHaveAttribute('aria-live', 'polite')
  })

  it('sin pendientes, el botón lo dice y no hay globo', async () => {
    servidor(0)
    renderCampana()
    const boton = await screen.findByRole('button', { name: 'Notificaciones, ninguna sin leer' }, ESPERA)
    expect(within(boton).queryByText(/\d/)).toBeNull()
  })

  it('al abrirla lista cada tipo con su texto y su enlace', async () => {
    servidor(2)
    renderCampana()
    fireEvent.click(await screen.findByRole('button', { name: /^Notificaciones/ }, ESPERA))

    const panel = await screen.findByRole('region', { name: 'Notificaciones' })
    expect(screen.getByRole('button', { name: /^Notificaciones/ })).toHaveAttribute('aria-expanded', 'true')
    const enlaces = await within(panel).findAllByRole('link', {}, ESPERA)
    expect(enlaces.map((a) => [a.textContent?.replace(/hace.*|ayer.*/, '').trim(), a.getAttribute('href')])).toEqual([
      ['Sin leer: Tomás Herrera se postuló a «ADC para la liga».', '/vacantes/o1'],
      ['Sin leer: Tu postulación a «MID academia» pasó a «Tryout / entrevista».', '/mi-perfil?pestana=postulaciones'],
      ['La oferta «Top regional» se cerró y tu postulación quedó rechazada.', '/mi-perfil?pestana=postulaciones'],
    ])
    expect(within(panel).getByText('2 sin leer')).toBeInTheDocument()
    expect(doble.get).toHaveBeenCalledWith('/notificaciones', { params: { pageSize: 10 } })
  })

  it('abrir una sin leer la marca, cierra el panel y navega', async () => {
    servidor(2)
    renderCampana()
    fireEvent.click(await screen.findByRole('button', { name: /^Notificaciones/ }, ESPERA))
    fireEvent.click(await screen.findByRole('link', { name: /Tomás Herrera se postuló a «ADC para la liga»/ }, ESPERA))

    await waitFor(() => expect(doble.post).toHaveBeenCalledWith('/notificaciones/leidas', { ids: ['n1'] }))
    expect(screen.getByTestId('ubicacion')).toHaveTextContent('/vacantes/o1')
    expect(screen.queryByRole('region', { name: 'Notificaciones' })).toBeNull()
  })

  it('abrir una ya leída no la vuelve a marcar', async () => {
    servidor(2)
    renderCampana()
    fireEvent.click(await screen.findByRole('button', { name: /^Notificaciones/ }, ESPERA))
    fireEvent.click(await screen.findByRole('link', { name: /Top regional/ }, ESPERA))
    expect(screen.getByTestId('ubicacion')).toHaveTextContent('/mi-perfil?pestana=postulaciones')
    expect(doble.post).not.toHaveBeenCalled()
  })

  it('marcar todas como leídas', async () => {
    servidor(2)
    renderCampana()
    fireEvent.click(await screen.findByRole('button', { name: /^Notificaciones/ }, ESPERA))
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar todas como leídas' }, ESPERA))
    await waitFor(() => expect(doble.post).toHaveBeenCalledWith('/notificaciones/leidas/todas'))
  })

  it('Esc cierra el panel y devuelve el foco a la campana', async () => {
    servidor(2)
    renderCampana()
    const boton = await screen.findByRole('button', { name: /^Notificaciones/ }, ESPERA)
    fireEvent.click(boton)
    await screen.findByRole('region', { name: 'Notificaciones' })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('region', { name: 'Notificaciones' })).toBeNull()
    expect(boton).toHaveFocus()
  })

  it('sin notificaciones muestra el estado vacío', async () => {
    servidor(0)
    doble.get.mockImplementation(async (ruta: string) =>
      ruta === '/notificaciones/contador'
        ? { data: { noLeidas: 0 } }
        : { data: { data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } } },
    )
    renderCampana()
    fireEvent.click(await screen.findByRole('button', { name: /^Notificaciones/ }, ESPERA))
    expect(await screen.findByText('Todavía no tienes notificaciones.', {}, ESPERA)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Marcar todas como leídas' })).toBeNull()
  })

  it('vuelve a consultar el contador cada 60 s, sin tiempo real', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    servidor(1)
    renderCampana()
    await screen.findByRole('button', { name: 'Notificaciones, 1 sin leer' }, ESPERA)
    const llamadas = () => doble.get.mock.calls.filter(([ruta]) => ruta === '/notificaciones/contador').length
    expect(llamadas()).toBe(1)

    servidor(3)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    await screen.findByRole('button', { name: 'Notificaciones, 3 sin leer' }, ESPERA)
    expect(llamadas()).toBe(2)
  })
})

describe('texto de una nueva postulación', () => {
  it('nombra al jugador y, en las notificaciones anteriores sin nombre, dice sólo la oferta', () => {
    expect(es.notificaciones.nuevaPostulacion('ADC para la liga', 'Tomás Herrera')).toBe(
      'Tomás Herrera se postuló a «ADC para la liga».',
    )
    expect(es.notificaciones.nuevaPostulacion('ADC para la liga')).toBe(
      'Nueva postulación a «ADC para la liga».',
    )
  })
})
