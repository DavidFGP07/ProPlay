import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import type { PerfilJugadorPublico, UsuarioPublico } from '@proplay/shared'
import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { ToastProvider } from '@/context/ToastContext'
import { crearQueryClient } from '@/api/queryClient'

/**
 * RF-05 · Perfil público del jugador (/jugador/:id): se abre sin sesión y
 * muestra sólo lo que devuelve GET /perfiles/:id. El cliente HTTP es un doble.
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

function perfil(cambios: Partial<PerfilJugadorPublico> = {}) {
  return {
    id: 'perfil-1',
    nombre: 'Valentina Rojas',
    bio: 'Support de League of Legends.',
    pais: 'CO',
    departamento: 'ATLANTICO',
    avatarUrl: null,
    cuentasVerificadas: [{ plataforma: 'RIOT', verificadaEn: '2026-10-01T12:00:00.000Z' }],
    ...cambios,
  }
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

function renderPerfil(ruta = '/jugador/perfil-1') {
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

async function titulo(nombre: string) {
  return screen.findByRole('heading', { name: nombre }, { timeout: 8000 })
}

describe('Perfil público del jugador', () => {
  beforeEach(() => {
    doble.usuario = null
    doble.get.mockReset()
  })

  it('se abre sin sesión, con el marco público y los datos de la API', async () => {
    doble.get.mockResolvedValue({ data: perfil() })
    renderPerfil()

    expect(await titulo('Valentina Rojas')).toBeInTheDocument()
    expect(doble.get).toHaveBeenCalledWith('/perfiles/perfil-1')
    expect(screen.getByRole('link', { name: /Iniciar sesión/ })).toBeInTheDocument()
    expect(screen.getByText('Atlántico, Colombia')).toBeInTheDocument()
    expect(screen.getByText('Caribe colombiano')).toBeInTheDocument()
    expect(screen.getByText('Cuenta de Riot verificada')).toBeInTheDocument()
    expect(screen.getByText('Verificada el 1 de octubre de 2026')).toBeInTheDocument()
    expect(screen.queryByText('Datos de demostracion')).toBeNull()
  })

  it('pide no ser indexado mientras está abierto', async () => {
    doble.get.mockResolvedValue({ data: perfil() })
    const { unmount } = renderPerfil()
    await titulo('Valentina Rojas')

    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex',
    )
    unmount()
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull()
  })

  it('sin cuenta de Riot ni datos opcionales muestra estados vacíos honestos', async () => {
    doble.get.mockResolvedValue({
      data: perfil({ bio: null, pais: null, departamento: null, cuentasVerificadas: [] }),
    })
    renderPerfil()
    await titulo('Valentina Rojas')

    expect(screen.getByText('Sin cuenta de Riot vinculada')).toBeInTheDocument()
    expect(screen.getByText('Ubicación no indicada')).toBeInTheDocument()
    expect(screen.getByText(/todavía no ha escrito su presentación/)).toBeInTheDocument()
    expect(screen.getByText('Todavía no hay cuentas verificadas')).toBeInTheDocument()
    expect(screen.getByText('Sin estadísticas todavía')).toBeInTheDocument()
    expect(screen.getByText('Próximamente')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /endors/i })).toBeNull()
  })

  it('con sesión se muestra dentro de la app, sin el aviso de demostración', async () => {
    doble.usuario = {
      id: 'cuenta-scout',
      email: 'scout@proplay.gg',
      nombre: 'Julian Ochoa',
      rol: 'SCOUT',
      emailVerificado: true,
      activo: true,
      creadoEn: new Date('2026-09-10T00:00:00Z'),
    }
    doble.get.mockResolvedValue({ data: perfil() })
    renderPerfil()

    expect(await titulo('Valentina Rojas')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Iniciar sesión/ })).toBeNull()
    expect(screen.getAllByRole('link', { name: /Mi cuenta/ }).length).toBeGreaterThan(0)
    expect(screen.queryByText('Datos de demostracion')).toBeNull()
  })

  it('responde «Perfil no encontrado» a un 404', async () => {
    doble.get.mockRejectedValue(errorApi(404))
    renderPerfil('/jugador/no-existe')

    expect(
      await screen.findByText('Perfil no encontrado', {}, { timeout: 8000 }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir a ProPlay' })).toHaveAttribute('href', '/login')
  })

  it('ofrece reintentar si falla la carga', async () => {
    doble.get
      .mockRejectedValueOnce(errorApi(500))
      .mockResolvedValueOnce({ data: perfil() })
    renderPerfil()

    expect(await screen.findByText('No pudimos cargar el perfil.', {}, { timeout: 8000 })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await titulo('Valentina Rojas')).toBeInTheDocument()
    await waitFor(() => expect(doble.get).toHaveBeenCalledTimes(2))
  })

  it('avisa del límite de consultas', async () => {
    doble.get.mockRejectedValue(errorApi(429))
    renderPerfil()

    expect(
      await screen.findByText(/consultado demasiados perfiles/, {}, { timeout: 8000 }),
    ).toBeInTheDocument()
  })
})
