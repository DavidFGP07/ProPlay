import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import type { UsuarioPublico } from '@proplay/shared'
import { crearQueryClient } from '@/api/queryClient'
import { AuthProvider, useAuth } from '@/context/AuthContext'

/**
 * RF-01 · Cerrar sesión no depende de que la API responda: si /auth/logout
 * falla (p. ej. un 429), la sesión se cierra en local y no se recupera sola al
 * recargar con la cookie que la API no pudo borrar.
 */
const USUARIO: UsuarioPublico = {
  id: 'cuenta-equipo',
  email: 'equipo@proplay.gg',
  nombre: 'Caribe eSports',
  rol: 'EQUIPO',
  emailVerificado: true,
  activo: true,
  creadoEn: new Date('2026-09-10T00:00:00Z'),
}

const auth = vi.hoisted(() => ({
  yo: vi.fn(),
  login: vi.fn(),
  registrar: vi.fn(),
  logout: vi.fn(),
}))
vi.mock('@/api/auth', () => ({ authApi: auth }))

let salir: () => Promise<void> = async () => {}
let entrar: ReturnType<typeof useAuth>['entrar'] | null = null

function Sonda() {
  const contexto = useAuth()
  salir = contexto.salir
  entrar = contexto.entrar
  if (contexto.cargando) return <p>cargando</p>
  return <p>{contexto.usuario ? contexto.usuario.nombre : 'sin sesión'}</p>
}

function montar() {
  return render(
    <QueryClientProvider client={crearQueryClient()}>
      <AuthProvider>
        <Sonda />
      </AuthProvider>
    </QueryClientProvider>,
  )
}

describe('cerrar sesión', () => {
  beforeEach(() => {
    sessionStorage.clear()
    auth.yo.mockResolvedValue({ usuario: USUARIO })
    auth.login.mockResolvedValue({ usuario: USUARIO, accessToken: 'token' })
  })
  afterEach(() => vi.clearAllMocks())

  it('si la API rechaza el logout, cierra en local y no recupera la sesión al recargar', async () => {
    auth.logout.mockRejectedValue(new Error('429'))
    const { unmount } = montar()
    expect(await screen.findByText('Caribe eSports')).toBeInTheDocument()

    await act(() => salir())
    expect(screen.getByText('sin sesión')).toBeInTheDocument()
    unmount()

    auth.yo.mockClear()
    montar()
    expect(await screen.findByText('sin sesión')).toBeInTheDocument()
    expect(auth.yo).not.toHaveBeenCalled()
  })

  it('al volver a entrar, la recarga recupera la sesión de nuevo', async () => {
    auth.logout.mockRejectedValue(new Error('429'))
    const { unmount } = montar()
    await screen.findByText('Caribe eSports')
    await act(() => salir())
    await act(async () => {
      await entrar!({ email: USUARIO.email, password: 'x' })
    })
    unmount()

    montar()
    await waitFor(() => expect(auth.yo).toHaveBeenCalled())
    expect(await screen.findByText('Caribe eSports')).toBeInTheDocument()
  })

  it('con el logout confirmado, la recarga sigue preguntando a la API', async () => {
    auth.logout.mockResolvedValue(undefined)
    const { unmount } = montar()
    await screen.findByText('Caribe eSports')
    await act(() => salir())
    unmount()

    auth.yo.mockClear()
    montar()
    await waitFor(() => expect(auth.yo).toHaveBeenCalled())
  })
})
