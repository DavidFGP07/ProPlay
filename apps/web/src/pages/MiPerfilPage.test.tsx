import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import type {
  PerfilJugadorRespuesta,
  PerfilPropioResponse,
  Rol,
  UsuarioPublico,
} from '@proplay/shared'
import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { ToastProvider } from '@/context/ToastContext'
import { crearQueryClient } from '@/api/queryClient'

/**
 * RF-05 · RF-09 · Tarjeta «Ubicación» de /mi-perfil. Habla con la API real
 * (GET /perfiles/me y PATCH /perfiles/jugador); aquí el cliente HTTP es un
 * doble en memoria y el resto de la vista sigue con el puente de demostración.
 */
const doble = vi.hoisted(() => ({
  usuario: null as UsuarioPublico | null,
  get: vi.fn(),
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
  return { ...real, api: { get: doble.get, patch: doble.patch } }
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

function perfil(cambios: Partial<PerfilJugadorRespuesta> = {}): PerfilJugadorRespuesta {
  return {
    id: 'perfil-1',
    usuarioId: 'cuenta-jugador',
    bio: null,
    pais: null,
    departamento: null,
    disponibilidadHoras: null,
    dispuestoRelocalizar: false,
    avatarUrl: null,
    creadoEn: new Date('2026-09-10T00:00:00Z'),
    actualizadoEn: new Date('2026-09-10T00:00:00Z'),
    ...cambios,
  }
}

function respuesta(datos: PerfilPropioResponse) {
  return { data: datos }
}

function errorApi(status: number, detalles?: { campo: string; mensaje: string }[]) {
  return new AxiosError('Error', String(status), undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: {
      error: {
        code: status === 422 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR',
        message: 'mensaje de la API',
        ...(detalles ? { details: { campos: detalles } } : {}),
      },
    },
  })
}

function renderMiPerfil() {
  return render(
    <MemoryRouter initialEntries={['/mi-perfil']}>
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

/** La tarjeta, para no confundir sus textos con los de la persona de demostración. */
async function tarjeta() {
  const titulo = await screen.findByRole('heading', { name: 'Ubicación' }, { timeout: 8000 })
  return within(titulo.closest('.card') as HTMLElement)
}

function elegir(t: Awaited<ReturnType<typeof tarjeta>>, etiqueta: RegExp, valor: string) {
  fireEvent.change(t.getByLabelText(etiqueta), { target: { value: valor } })
}

describe('Tarjeta de ubicación en Mi perfil', () => {
  beforeEach(() => {
    doble.usuario = null
    doble.get.mockReset()
    doble.patch.mockReset()
  })

  it('se distingue como dato real y pide completar la ubicación al jugador que no la tiene', async () => {
    sesionDe('JUGADOR')
    doble.get.mockResolvedValue(respuesta({ tipo: 'JUGADOR', perfil: perfil() }))
    renderMiPerfil()
    const t = await tarjeta()

    expect(await t.findByText('Dato real de tu cuenta')).toBeInTheDocument()
    expect(t.getByText(/El resto de la vista sigue mostrando datos de ejemplo/)).toBeInTheDocument()
    expect(t.getByRole('note')).toHaveTextContent('Completa tu ubicación')
    expect(doble.get).toHaveBeenCalledWith('/perfiles/me')
    // El aviso de demostración sigue para el resto de la vista.
    expect(screen.getByText('Datos de demostracion')).toBeInTheDocument()
  })

  it('guarda Colombia con departamento y muestra la ubicación con su macrorregión', async () => {
    sesionDe('JUGADOR')
    doble.get.mockResolvedValue(respuesta({ tipo: 'JUGADOR', perfil: perfil() }))
    doble.patch.mockResolvedValue(
      respuesta({
        tipo: 'JUGADOR',
        perfil: perfil({ pais: 'CO', departamento: 'ATLANTICO', dispuestoRelocalizar: true }),
      }),
    )
    renderMiPerfil()
    const t = await tarjeta()
    await t.findByRole('note')

    elegir(t, /^País/, 'CO')
    elegir(t, /^Departamento/, 'ATLANTICO')
    fireEvent.click(t.getByLabelText(/Dispuesto a relocalizarme/))
    fireEvent.click(t.getByRole('button', { name: 'Guardar ubicación' }))

    expect(await t.findByText('Ubicación guardada: Atlántico, Colombia')).toBeInTheDocument()
    expect(t.getByText('Caribe colombiano')).toBeInTheDocument()
    expect(t.queryByRole('note')).toBeNull()
    expect(doble.patch).toHaveBeenCalledWith('/perfiles/jugador', {
      pais: 'CO',
      departamento: 'ATLANTICO',
      dispuestoRelocalizar: true,
    })
  })

  it('valida en el cliente que Colombia lleve departamento, sin llamar a la API', async () => {
    sesionDe('JUGADOR')
    doble.get.mockResolvedValue(respuesta({ tipo: 'JUGADOR', perfil: perfil() }))
    renderMiPerfil()
    const t = await tarjeta()
    await t.findByRole('note')

    elegir(t, /^País/, 'CO')
    fireEvent.click(t.getByRole('button', { name: 'Guardar ubicación' }))

    expect(await t.findByText('Selecciona el departamento')).toBeInTheDocument()
    expect(doble.patch).not.toHaveBeenCalled()
  })

  it('fuera de Colombia desactiva el departamento y lo envía nulo', async () => {
    sesionDe('JUGADOR')
    doble.get.mockResolvedValue(
      respuesta({ tipo: 'JUGADOR', perfil: perfil({ pais: 'CO', departamento: 'BOLIVAR' }) }),
    )
    doble.patch.mockResolvedValue(respuesta({ tipo: 'JUGADOR', perfil: perfil({ pais: 'MX' }) }))
    renderMiPerfil()
    const t = await tarjeta()
    expect(await t.findByText('Ubicación guardada: Bolívar, Colombia')).toBeInTheDocument()

    elegir(t, /^País/, 'MX')
    expect(t.getByLabelText(/^Departamento/)).toBeDisabled()
    fireEvent.click(t.getByRole('button', { name: 'Guardar ubicación' }))

    expect(await t.findByText('Ubicación guardada: México')).toBeInTheDocument()
    expect(doble.patch).toHaveBeenCalledWith('/perfiles/jugador', {
      pais: 'MX',
      departamento: null,
      dispuestoRelocalizar: false,
    })
  })

  it('lleva a su campo el error de validación de la API', async () => {
    sesionDe('JUGADOR')
    doble.get.mockResolvedValue(respuesta({ tipo: 'JUGADOR', perfil: perfil() }))
    doble.patch.mockRejectedValue(
      errorApi(422, [{ campo: 'departamento', mensaje: 'El departamento sólo aplica a Colombia' }]),
    )
    renderMiPerfil()
    const t = await tarjeta()
    await t.findByRole('note')

    elegir(t, /^País/, 'CO')
    elegir(t, /^Departamento/, 'SUCRE')
    fireEvent.click(t.getByRole('button', { name: 'Guardar ubicación' }))

    expect(await t.findByText('El departamento sólo aplica a Colombia')).toBeInTheDocument()
  })

  it('ofrece reintentar si no puede cargar la ubicación', async () => {
    sesionDe('JUGADOR')
    doble.get
      .mockRejectedValueOnce(errorApi(500))
      .mockResolvedValueOnce(respuesta({ tipo: 'JUGADOR', perfil: perfil() }))
    renderMiPerfil()
    const t = await tarjeta()

    expect(await t.findByText('No pudimos cargar tu ubicación.')).toBeInTheDocument()
    fireEvent.click(t.getByRole('button', { name: 'Reintentar' }))

    expect(await t.findByRole('note')).toHaveTextContent('Completa tu ubicación')
    await waitFor(() => expect(doble.get).toHaveBeenCalledTimes(2))
  })

  it.each(['EQUIPO', 'SCOUT'] as const)('no se muestra al rol %s', async (rol) => {
    sesionDe(rol)
    doble.get.mockResolvedValue(respuesta({ tipo: null, perfil: null }))
    renderMiPerfil()

    await screen.findByText(/no tiene un perfil de jugador|Datos de demostracion/i, {}, { timeout: 8000 })
    expect(screen.queryByRole('heading', { name: 'Ubicación' })).toBeNull()
    expect(doble.get).not.toHaveBeenCalledWith('/perfiles/me')
  })
})
