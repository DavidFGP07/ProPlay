import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { VERSION_AVISO_PRIVACIDAD } from '@proplay/shared'
import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { ToastProvider } from '@/context/ToastContext'
import { crearQueryClient } from '@/api/queryClient'

/**
 * RNF-05 · Aviso de privacidad publico y aceptacion obligatoria en el registro.
 * Sin sesion: /auth/me responde 401 y el registro se observa con un doble.
 */
const doble = vi.hoisted(() => ({ registrar: vi.fn() }))

vi.mock('@/api/auth', () => ({
  authApi: {
    yo: async () => {
      throw new Error('401')
    },
    login: async () => {
      throw new Error('No disponible')
    },
    registrar: doble.registrar,
    logout: async () => {},
  },
}))

function renderEn(ruta: string) {
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

describe('Aviso de privacidad (/legal/privacidad)', () => {
  beforeEach(() => {
    doble.registrar.mockReset()
  })

  it('se lee sin sesion, con su version y el descargo de Riot', async () => {
    renderEn('/legal/privacidad')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Aviso de privacidad y términos de uso' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Aviso de privacidad' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Términos de uso' })).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`Versión ${VERSION_AVISO_PRIVACIDAD.replace('.', '\\.')}`))).toBeInTheDocument()
    expect(screen.getByText(/isn't endorsed by Riot Games/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Volver al inicio de sesión/ })).toHaveAttribute('href', '/login')
    // Es una vista publica: no redirige al login ni muestra el aviso de demostracion.
    expect(screen.queryByRole('heading', { name: /Iniciar sesion/i })).toBeNull()
    expect(screen.queryByRole('note')).toBeNull()
  })

  it.each([
    ['#privacidad', 'Aviso de privacidad'],
    ['#terminos', 'Términos de uso'],
  ])('al entrar con %s baja a esa seccion y le da el foco', async (ancla, titulo) => {
    const desplazar = vi.spyOn(Element.prototype, 'scrollIntoView')
    renderEn(`/legal/privacidad${ancla}`)

    const encabezado = await screen.findByRole('heading', { level: 2, name: titulo })
    await waitFor(() => expect(encabezado).toHaveFocus())
    expect(desplazar.mock.contexts).toContain(encabezado)
    desplazar.mockRestore()
  })
})

describe('Registro (RNF-05)', () => {
  it('no se envia sin aceptar el aviso ni declarar la mayoria de edad', async () => {
    renderEn('/login')
    await screen.findByRole('heading', { name: /Iniciar sesion/i })
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    fireEvent.change(await screen.findByPlaceholderText('Daniel Ocoro'), {
      target: { value: 'Jugadora Nueva' },
    })
    fireEvent.change(screen.getByPlaceholderText('tucorreo@dominio.com'), {
      target: { value: 'nueva@proplay.test' },
    })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'ProPlay123' } })
    fireEvent.click(screen.getByRole('button', { name: /Crear mi cuenta/ }))

    expect(
      await screen.findByText(/Debes aceptar el aviso de privacidad y los términos de uso/),
    ).toBeInTheDocument()
    expect(screen.getByText(/Debes declarar que eres mayor de 18 años/)).toBeInTheDocument()
    expect(doble.registrar).not.toHaveBeenCalled()
  })
})
