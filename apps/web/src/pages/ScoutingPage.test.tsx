import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import type { Rol, UsuarioPublico } from '@proplay/shared'
import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { ToastProvider } from '@/context/ToastContext'
import { crearQueryClient } from '@/api/queryClient'

/**
 * RF-08 · Buscador de talento (/explorar) con datos reales de
 * GET /scouting/jugadores. El cliente HTTP es un doble en memoria.
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

const VERIFICADO = {
  id: 'perfil-1',
  nombre: 'Andrés Molina',
  avatarUrl: null,
  pais: 'CO',
  departamento: 'ATLANTICO',
  disponibilidadHoras: 20,
  dispuestoRelocalizar: true,
  verificacion: { plataforma: 'RIOT', verificadaEn: '2026-10-01T12:00:00.000Z' },
  posicion: 'MID',
  rango: 'DIAMANTE_II',
  datosDel: '2026-11-02T12:00:00.000Z',
}

const SIN_VERIFICAR = {
  id: 'perfil-2',
  nombre: 'Laura Beltrán',
  avatarUrl: null,
  pais: 'MX',
  departamento: null,
  disponibilidadHoras: null,
  dispuestoRelocalizar: false,
  verificacion: null,
  posicion: null,
  rango: null,
  datosDel: null,
}

function pagina(datos: unknown[], meta: Partial<{ page: number; totalPages: number; total: number }> = {}) {
  return { data: { data: datos, meta: { page: 1, pageSize: 20, total: datos.length, totalPages: 1, ...meta } } }
}

function errorApi(status: number) {
  return new AxiosError('Error', String(status), undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { error: { code: 'X', message: 'mensaje de la API' } },
  })
}

function renderExplorar() {
  return render(
    <MemoryRouter initialEntries={['/explorar']}>
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
})

describe('Buscador de talento (/explorar)', () => {
  it('lista jugadores reales: verificados con posición, rango y fecha; los demás, «Sin cuenta verificada»', async () => {
    sesionDe('SCOUT')
    doble.get.mockResolvedValue(pagina([VERIFICADO, SIN_VERIFICAR]))
    renderExplorar()

    const andres = (await screen.findByRole('heading', { name: 'Andrés Molina' }, ESPERA)).closest('a')!
    expect(andres).toHaveAttribute('href', '/jugador/perfil-1')
    expect(within(andres).getByText('Mid')).toBeInTheDocument()
    expect(within(andres).getByText('Diamante II')).toBeInTheDocument()
    expect(within(andres).getByText(/Cuenta de Riot verificada el/)).toBeInTheDocument()
    expect(within(andres).getByText('20 h por semana')).toBeInTheDocument()
    expect(within(andres).getByText('Dispuesto a relocalizarse')).toBeInTheDocument()
    expect(within(andres).getByText('Caribe colombiano')).toBeInTheDocument()

    const laura = screen.getByRole('heading', { name: 'Laura Beltrán' }).closest('a')!
    expect(within(laura).getByText('Sin cuenta verificada')).toBeInTheDocument()
    expect(within(laura).queryByText(/Cuenta de Riot verificada/)).toBeNull()

    expect(screen.getByText('2 jugadores')).toBeInTheDocument()
    // Sin datos simulados ni puntajes.
    expect(screen.queryByText('Datos de demostracion')).toBeNull()
    expect(screen.queryByText(/\d+ ?%/)).toBeNull()
    expect(doble.get).toHaveBeenCalledWith('/scouting/jugadores', { params: { page: 1 } })
  })

  it('filtra por posición, rango mínimo y departamento y vuelve a la primera página', async () => {
    sesionDe('EQUIPO')
    doble.get.mockResolvedValue(pagina([VERIFICADO], { totalPages: 3, total: 41 }))
    renderExplorar()
    await screen.findByText('41 jugadores', {}, ESPERA)

    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }))
    await waitFor(() =>
      expect(doble.get).toHaveBeenLastCalledWith('/scouting/jugadores', { params: { page: 2 } }),
    )

    fireEvent.change(screen.getByLabelText('Posición'), { target: { value: 'MID' } })
    fireEvent.change(screen.getByLabelText('Rango mínimo'), { target: { value: 'ORO_II' } })
    fireEvent.change(screen.getByLabelText('Departamento'), { target: { value: 'ATLANTICO' } })
    await waitFor(() =>
      expect(doble.get).toHaveBeenLastCalledWith('/scouting/jugadores', {
        params: { page: 1, posicion: 'MID', rangoMinimo: 'ORO_II', departamento: 'ATLANTICO' },
      }),
    )
  })

  it('el rango mínimo va de mayor a menor', async () => {
    sesionDe('SCOUT')
    doble.get.mockResolvedValue(pagina([]))
    renderExplorar()
    const opciones = within(await screen.findByLabelText('Rango mínimo', {}, ESPERA)).getAllByRole('option')
    expect(opciones.map((o) => o.textContent).slice(0, 3)).toEqual(['Sin mínimo', 'Retador', 'Gran Maestro'])
    expect(opciones.at(-1)).toHaveTextContent('Hierro IV')
  })

  it('sin resultados con filtros explica por qué y ofrece quitarlos', async () => {
    sesionDe('SCOUT')
    doble.get.mockResolvedValue(pagina([]))
    renderExplorar()
    expect(await screen.findByText('Todavía no hay jugadores', {}, ESPERA)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Posición'), { target: { value: 'TOP' } })
    expect(await screen.findByText('Ningún jugador cumple los filtros')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Quitar filtros' })[0]!)
    await waitFor(() => expect(screen.getByLabelText('Posición')).toHaveValue(''))
  })

  it('si la API falla, ofrece reintentar', async () => {
    sesionDe('SCOUT')
    doble.get.mockRejectedValueOnce(errorApi(500))
    renderExplorar()
    expect(await screen.findByText('No pudimos hacer la búsqueda.', {}, ESPERA)).toBeInTheDocument()

    doble.get.mockResolvedValue(pagina([VERIFICADO]))
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }))
    expect(await screen.findByRole('heading', { name: 'Andrés Molina' }, ESPERA)).toBeInTheDocument()
  })

  it('un 403 muestra el estado «sin permiso»', async () => {
    sesionDe('SCOUT')
    doble.get.mockRejectedValue(errorApi(403))
    renderExplorar()
    expect(await screen.findByText('No tienes acceso a esta sección', {}, ESPERA)).toBeInTheDocument()
  })

  it('el jugador no entra al buscador (RNF-04)', async () => {
    sesionDe('JUGADOR')
    renderExplorar()
    expect(await screen.findByText(/No tienes permisos para esta seccion/i, {}, ESPERA)).toBeInTheDocument()
    expect(doble.get).not.toHaveBeenCalledWith('/scouting/jugadores', expect.anything())
  })
})
