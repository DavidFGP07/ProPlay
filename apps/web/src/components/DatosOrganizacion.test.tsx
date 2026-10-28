import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import type {
  PerfilEquipoRespuesta,
  PerfilPropioResponse,
  Rol,
  UsuarioPublico,
} from '@proplay/shared'
import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { ToastProvider } from '@/context/ToastContext'
import { crearQueryClient } from '@/api/queryClient'

/**
 * RF-07 · Tarjeta «Datos de la organización» de /panel-equipo (GET
 * /perfiles/me y PATCH /perfiles/equipo). El cliente HTTP es un doble en
 * memoria; las secciones simuladas del panel llevan su propia marca.
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

function perfil(cambios: Partial<PerfilEquipoRespuesta> = {}): PerfilEquipoRespuesta {
  return {
    id: 'equipo-1',
    usuarioId: 'cuenta-equipo',
    nombreOrg: 'Lobos del Caribe',
    descripcion: null,
    sitioWeb: null,
    logoUrl: null,
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

function renderPanel() {
  return render(
    <MemoryRouter initialEntries={['/panel-equipo']}>
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

/** La tarjeta, para no confundir sus textos con los del resto del panel. */
async function tarjeta() {
  const titulo = await screen.findByRole(
    'heading',
    { name: 'Datos de la organización' },
    { timeout: 8000 },
  )
  return within(titulo.closest('.card') as HTMLElement)
}

describe('Datos de la organización en el panel de equipo', () => {
  beforeEach(() => {
    doble.usuario = null
    doble.get.mockReset()
    doble.patch.mockReset()
  })

  it('carga los datos reales y pone el nombre de la organización en el subtítulo', async () => {
    sesionDe('EQUIPO')
    doble.get.mockResolvedValue(respuesta({ tipo: 'EQUIPO', perfil: perfil() }))
    renderPanel()
    const t = await tarjeta()

    expect(await t.findByLabelText(/^Nombre de la organización/)).toHaveValue('Lobos del Caribe')
    expect(screen.getByText('Lobos del Caribe', { selector: 'p' })).toBeInTheDocument()
    expect(doble.get).toHaveBeenCalledWith('/perfiles/me')
    // Sin aviso de página: las secciones simuladas llevan su marca y la tarjeta no.
    expect(t.queryByText('Datos de demostracion')).toBeNull()
    expect(screen.getAllByText('Datos de demostracion').length).toBeGreaterThanOrEqual(4)
    expect(screen.queryByText(/Lo que ves en esta seccion/)).toBeNull()
  })

  it('pinta el sitio web como enlace externo con noopener noreferrer', async () => {
    sesionDe('EQUIPO')
    doble.get.mockResolvedValue(
      respuesta({ tipo: 'EQUIPO', perfil: perfil({ sitioWeb: 'https://lobos.gg' }) }),
    )
    renderPanel()
    const t = await tarjeta()

    const enlace = await t.findByRole('link', { name: /https:\/\/lobos\.gg/ })
    expect(enlace).toHaveAttribute('href', 'https://lobos.gg')
    expect(enlace).toHaveAttribute('target', '_blank')
    expect(enlace).toHaveAttribute('rel', 'noopener noreferrer')
    expect(enlace).toHaveAccessibleName(/se abre en una pestaña nueva/)
  })

  it('guarda los cambios y envía null en los campos que quedan vacíos', async () => {
    sesionDe('EQUIPO')
    doble.get.mockResolvedValue(
      respuesta({
        tipo: 'EQUIPO',
        perfil: perfil({ descripcion: 'Club antiguo', sitioWeb: 'https://lobos.gg' }),
      }),
    )
    doble.patch.mockResolvedValue(
      respuesta({ tipo: 'EQUIPO', perfil: perfil({ nombreOrg: 'Lobos eSports' }) }),
    )
    renderPanel()
    const t = await tarjeta()

    fireEvent.change(await t.findByLabelText(/^Nombre de la organización/), {
      target: { value: 'Lobos eSports' },
    })
    fireEvent.change(t.getByLabelText(/^Descripción/), { target: { value: '   ' } })
    fireEvent.change(t.getByLabelText(/^Sitio web/), { target: { value: '' } })
    fireEvent.click(t.getByRole('button', { name: 'Guardar cambios' }))

    expect(await t.findByText('Datos de la organización guardados.')).toBeInTheDocument()
    expect(doble.patch).toHaveBeenCalledWith('/perfiles/equipo', {
      nombreOrg: 'Lobos eSports',
      descripcion: null,
      sitioWeb: null,
    })
    expect(t.queryByRole('link')).toBeNull()
  })

  it.each([
    ['javascript:', 'javascript:alert(1)'],
    ['sin esquema', 'lobos.gg'],
  ])('rechaza en el cliente un sitio web %s, sin llamar a la API', async (_caso, valor) => {
    sesionDe('EQUIPO')
    doble.get.mockResolvedValue(respuesta({ tipo: 'EQUIPO', perfil: perfil() }))
    renderPanel()
    const t = await tarjeta()

    fireEvent.change(await t.findByLabelText(/^Sitio web/), { target: { value: valor } })
    fireEvent.click(t.getByRole('button', { name: 'Guardar cambios' }))

    expect(
      await t.findByText('Escribe una dirección web válida, con https://'),
    ).toBeInTheDocument()
    expect(doble.patch).not.toHaveBeenCalled()
  })

  it('valida que el nombre tenga al menos dos caracteres', async () => {
    sesionDe('EQUIPO')
    doble.get.mockResolvedValue(respuesta({ tipo: 'EQUIPO', perfil: perfil() }))
    renderPanel()
    const t = await tarjeta()

    fireEvent.change(await t.findByLabelText(/^Nombre de la organización/), {
      target: { value: 'L' },
    })
    fireEvent.click(t.getByRole('button', { name: 'Guardar cambios' }))

    expect(await t.findByText('Mínimo 2 caracteres')).toBeInTheDocument()
    expect(doble.patch).not.toHaveBeenCalled()
  })

  it('lleva a su campo el error de validación de la API', async () => {
    sesionDe('EQUIPO')
    doble.get.mockResolvedValue(respuesta({ tipo: 'EQUIPO', perfil: perfil() }))
    doble.patch.mockRejectedValue(
      errorApi(422, [{ campo: 'sitioWeb', mensaje: 'Sitio web no admitido' }]),
    )
    renderPanel()
    const t = await tarjeta()

    fireEvent.change(await t.findByLabelText(/^Sitio web/), {
      target: { value: 'https://lobos.gg' },
    })
    fireEvent.click(t.getByRole('button', { name: 'Guardar cambios' }))

    expect(await t.findByText('Sitio web no admitido')).toBeInTheDocument()
  })

  it('ofrece reintentar si no puede cargar los datos', async () => {
    sesionDe('EQUIPO')
    doble.get
      .mockRejectedValueOnce(errorApi(500))
      .mockResolvedValueOnce(respuesta({ tipo: 'EQUIPO', perfil: perfil() }))
    renderPanel()
    const t = await tarjeta()

    expect(
      await t.findByText('No pudimos cargar los datos de la organización.'),
    ).toBeInTheDocument()
    fireEvent.click(t.getByRole('button', { name: 'Reintentar' }))

    expect(await t.findByLabelText(/^Nombre de la organización/)).toHaveValue('Lobos del Caribe')
    await waitFor(() => expect(doble.get).toHaveBeenCalledTimes(2))
  })

  it('no se muestra al scout, que no tiene perfil propio', async () => {
    sesionDe('SCOUT')
    renderPanel()

    expect(
      await screen.findByRole('heading', { name: /Panel de scouting/ }, { timeout: 8000 }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Datos de la organización' })).toBeNull()
    expect(doble.get).not.toHaveBeenCalledWith('/perfiles/me')
  })
})
