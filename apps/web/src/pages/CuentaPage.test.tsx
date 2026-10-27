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
 * RF-01 · RNF-05 · Vista de cuenta. La sesion y el cliente HTTP se sustituyen
 * por dobles en memoria: la vista habla con la API real, aqui no hay red.
 */
const doble = vi.hoisted(() => ({
  usuario: null as UsuarioPublico | null,
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
  return { ...real, api: { patch: doble.patch } }
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

function renderCuenta() {
  return render(
    <MemoryRouter initialEntries={['/cuenta']}>
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

function campo(nombre: RegExp) {
  return screen.getByLabelText(nombre) as HTMLInputElement
}

function escribir(nombre: RegExp, valor: string) {
  fireEvent.change(campo(nombre), { target: { value: valor } })
}

function formularioContrasena() {
  return screen.getByRole('button', { name: 'Cambiar contraseña' }).closest('form')!
}

function errorApi(status: number, code: string) {
  return new AxiosError('Error', String(status), undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { error: { code, message: 'mensaje de la API' } },
  })
}

describe('Vista de cuenta', () => {
  beforeEach(() => {
    doble.usuario = null
    doble.patch.mockReset()
  })

  it.each(['JUGADOR', 'EQUIPO', 'SCOUT', 'ADMIN'] as const)(
    'el rol %s accede desde su menu y ve sus datos sin el aviso de demostracion',
    async (rol) => {
      sesionDe(rol)
      renderCuenta()

      expect(await screen.findByText('Datos de la cuenta', {}, { timeout: 8000 })).toBeInTheDocument()
      expect(campo(/^Correo electronico/)).toHaveValue(`${rol.toLowerCase()}@proplay.gg`)
      expect(campo(/^Correo electronico/)).toHaveAttribute('readonly')
      expect(campo(/^Nombre/)).toHaveValue(`Usuario ${rol}`)
      const menu = screen.getByRole('navigation')
      expect(within(menu).getByRole('link', { name: /Mi cuenta/ })).toHaveAttribute('href', '/cuenta')
      expect(screen.queryByRole('note')).toBeNull()
    },
  )

  it('valida en el cliente la confirmacion y que la nueva no repita la actual', async () => {
    sesionDe('SCOUT')
    renderCuenta()
    await screen.findByText('Datos de la cuenta', {}, { timeout: 8000 })

    escribir(/^Contraseña actual/, 'ProPlay123')
    escribir(/^Contraseña nueva/, 'ProPlay123')
    escribir(/^Confirma la contraseña nueva/, 'Distinta2026')
    fireEvent.submit(formularioContrasena())

    expect(await screen.findByText('La nueva contraseña debe ser distinta de la actual')).toBeInTheDocument()
    expect(screen.getByText('Las contraseñas no coinciden')).toBeInTheDocument()
    expect(doble.patch).not.toHaveBeenCalled()
  })

  it('cambia la contraseña, envia solo el contrato y confirma el exito', async () => {
    sesionDe('EQUIPO')
    doble.patch.mockResolvedValue({
      data: { usuario: doble.usuario, accessToken: 'token-nuevo', expiraEn: 900 },
    })
    renderCuenta()
    await screen.findByText('Datos de la cuenta', {}, { timeout: 8000 })

    escribir(/^Contraseña actual/, 'ProPlay123')
    escribir(/^Contraseña nueva/, 'NuevaClave2026')
    escribir(/^Confirma la contraseña nueva/, 'NuevaClave2026')
    fireEvent.submit(formularioContrasena())

    expect(
      await screen.findByRole('status', {}, { timeout: 8000 }),
    ).toHaveTextContent('Contraseña actualizada')
    expect(doble.patch).toHaveBeenCalledWith('/usuarios/me/contrasena', {
      contrasenaActual: 'ProPlay123',
      contrasenaNueva: 'NuevaClave2026',
    })
    await waitFor(() => expect(campo(/^Contraseña actual/)).toHaveValue(''))
  })

  it('muestra en su campo el error de contraseña actual incorrecta', async () => {
    sesionDe('ADMIN')
    doble.patch.mockRejectedValue(errorApi(400, 'CONTRASENA_ACTUAL_INVALIDA'))
    renderCuenta()
    await screen.findByText('Datos de la cuenta', {}, { timeout: 8000 })

    escribir(/^Contraseña actual/, 'NoEsLaActual1')
    escribir(/^Contraseña nueva/, 'NuevaClave2026')
    escribir(/^Confirma la contraseña nueva/, 'NuevaClave2026')
    fireEvent.submit(formularioContrasena())

    expect(await screen.findByText('La contraseña actual no es correcta')).toBeInTheDocument()
    // Sigue en la vista: un 400 no cierra la sesion.
    expect(screen.getByText('Datos de la cuenta')).toBeInTheDocument()
  })

  it('ofrece reintentar ante un error que no es de validacion', async () => {
    sesionDe('JUGADOR')
    doble.patch
      .mockRejectedValueOnce(errorApi(500, 'INTERNAL_ERROR'))
      .mockResolvedValueOnce({ data: { usuario: { ...doble.usuario, nombre: 'Nombre Nuevo' } } })
    renderCuenta()
    await screen.findByText('Datos de la cuenta', {}, { timeout: 8000 })

    escribir(/^Nombre/, 'Nombre Nuevo')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nombre' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Nombre actualizado')
    expect(doble.patch).toHaveBeenLastCalledWith('/usuarios/me', { nombre: 'Nombre Nuevo' })
  })
})
