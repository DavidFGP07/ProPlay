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
 * RF-05 · RF-09 · /mi-perfil: cabecera y datos profesionales reales
 * (GET /perfiles/me y PATCH /perfiles/jugador). El cliente HTTP es un doble en
 * memoria; las secciones que dependen de otros modulos siguen con el puente de
 * demostracion y llevan su propia marca.
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

/** La pestaña de datos profesionales, para no confundir sus textos con los del resto. */
async function formulario() {
  const boton = await screen.findByRole('button', { name: 'Guardar cambios' }, { timeout: 8000 })
  return within(boton.closest('form') as HTMLElement)
}

function elegir(f: Awaited<ReturnType<typeof formulario>>, etiqueta: RegExp, valor: string) {
  fireEvent.change(f.getByLabelText(etiqueta), { target: { value: valor } })
}

describe('Mi perfil', () => {
  beforeEach(() => {
    doble.usuario = null
    doble.get.mockReset()
    doble.patch.mockReset()
  })

  it('muestra la cabecera con los datos reales y enlaza al perfil público propio', async () => {
    sesionDe('JUGADOR')
    doble.get.mockResolvedValue(respuesta({ tipo: 'JUGADOR', perfil: perfil() }))
    renderMiPerfil()

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Usuario JUGADOR' }, { timeout: 8000 }),
    ).toBeInTheDocument()
    expect(screen.getByText('Ubicación sin indicar')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ver como lo ven los equipos/ })).toHaveAttribute(
      'href',
      '/jugador/perfil-1',
    )
    const f = await formulario()
    expect(f.getByRole('note')).toHaveTextContent('Completa tu ubicación')
    expect(doble.get).toHaveBeenCalledWith('/perfiles/me')
  })

  it('sin aviso de página: cada sección simulada lleva su propia marca', async () => {
    sesionDe('JUGADOR')
    doble.get.mockResolvedValue(respuesta({ tipo: 'JUGADOR', perfil: perfil() }))
    renderMiPerfil()
    const f = await formulario()

    // La pestaña real no lleva marca; los dos laterales simulados sí.
    expect(f.queryByText('Datos de demostracion')).toBeNull()
    expect(await screen.findByText('Resumen de evidencia', {}, { timeout: 8000 })).toBeInTheDocument()
    expect(screen.getAllByText('Datos de demostracion')).toHaveLength(2)
    expect(screen.queryByText(/Lo que ves en esta seccion/)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Cuentas de juego/ }))
    expect(screen.getAllByText('Datos de demostracion')).toHaveLength(3)
    expect(screen.getAllByRole('note')[0]).toHaveTextContent(/Datos de demostracion.*no de tu cuenta/)
  })

  it('guarda presentación, disponibilidad y ubicación y actualiza la cabecera', async () => {
    sesionDe('JUGADOR')
    doble.get.mockResolvedValue(respuesta({ tipo: 'JUGADOR', perfil: perfil() }))
    doble.patch.mockResolvedValue(
      respuesta({
        tipo: 'JUGADOR',
        perfil: perfil({
          bio: 'Jungla de LoL',
          disponibilidadHoras: 20,
          pais: 'CO',
          departamento: 'ATLANTICO',
          dispuestoRelocalizar: true,
        }),
      }),
    )
    renderMiPerfil()
    const f = await formulario()

    fireEvent.change(f.getByLabelText(/^Presentación/), { target: { value: 'Jungla de LoL' } })
    fireEvent.change(f.getByLabelText(/^Horas disponibles/), { target: { value: '20' } })
    elegir(f, /^País/, 'CO')
    elegir(f, /^Departamento/, 'ATLANTICO')
    fireEvent.click(f.getByLabelText(/Dispuesto a relocalizarme/))
    fireEvent.click(f.getByRole('button', { name: 'Guardar cambios' }))

    expect(await f.findByText('Perfil guardado.')).toBeInTheDocument()
    expect(doble.patch).toHaveBeenCalledWith('/perfiles/jugador', {
      bio: 'Jungla de LoL',
      disponibilidadHoras: 20,
      pais: 'CO',
      departamento: 'ATLANTICO',
      dispuestoRelocalizar: true,
    })
    expect(screen.getByText('Atlántico, Colombia')).toBeInTheDocument()
    expect(screen.getByText('Caribe colombiano')).toBeInTheDocument()
    expect(screen.getByText('20 h por semana')).toBeInTheDocument()
    expect(screen.getByText('Dispuesto a relocalizarse')).toBeInTheDocument()
    expect(f.queryByRole('note')).toBeNull()
  })

  it('valida en el cliente que Colombia lleve departamento, sin llamar a la API', async () => {
    sesionDe('JUGADOR')
    doble.get.mockResolvedValue(respuesta({ tipo: 'JUGADOR', perfil: perfil() }))
    renderMiPerfil()
    const f = await formulario()

    elegir(f, /^País/, 'CO')
    fireEvent.click(f.getByRole('button', { name: 'Guardar cambios' }))

    expect(await f.findByText('Selecciona el departamento')).toBeInTheDocument()
    expect(doble.patch).not.toHaveBeenCalled()
  })

  it('valida en español el rango de horas del contrato', async () => {
    sesionDe('JUGADOR')
    doble.get.mockResolvedValue(respuesta({ tipo: 'JUGADOR', perfil: perfil() }))
    renderMiPerfil()
    const f = await formulario()

    fireEvent.change(f.getByLabelText(/^Horas disponibles/), { target: { value: '81' } })
    fireEvent.click(f.getByRole('button', { name: 'Guardar cambios' }))

    expect(await f.findByText('Debe ser 80 o menos')).toBeInTheDocument()
    expect(doble.patch).not.toHaveBeenCalled()
  })

  it('fuera de Colombia desactiva el departamento y lo envía nulo', async () => {
    sesionDe('JUGADOR')
    doble.get.mockResolvedValue(
      respuesta({ tipo: 'JUGADOR', perfil: perfil({ pais: 'CO', departamento: 'BOLIVAR' }) }),
    )
    doble.patch.mockResolvedValue(respuesta({ tipo: 'JUGADOR', perfil: perfil({ pais: 'MX' }) }))
    renderMiPerfil()
    const f = await formulario()
    expect(screen.getByText('Bolívar, Colombia')).toBeInTheDocument()

    elegir(f, /^País/, 'MX')
    expect(f.getByLabelText(/^Departamento/)).toBeDisabled()
    fireEvent.click(f.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('México')).toBeInTheDocument()
    expect(doble.patch).toHaveBeenCalledWith(
      '/perfiles/jugador',
      expect.objectContaining({ pais: 'MX', departamento: null }),
    )
  })

  it('lleva a su campo el error de validación de la API', async () => {
    sesionDe('JUGADOR')
    doble.get.mockResolvedValue(respuesta({ tipo: 'JUGADOR', perfil: perfil() }))
    doble.patch.mockRejectedValue(
      errorApi(422, [{ campo: 'departamento', mensaje: 'El departamento sólo aplica a Colombia' }]),
    )
    renderMiPerfil()
    const f = await formulario()

    elegir(f, /^País/, 'CO')
    elegir(f, /^Departamento/, 'SUCRE')
    fireEvent.click(f.getByRole('button', { name: 'Guardar cambios' }))

    expect(await f.findByText('El departamento sólo aplica a Colombia')).toBeInTheDocument()
  })

  it('ofrece reintentar si no puede cargar el perfil', async () => {
    sesionDe('JUGADOR')
    doble.get
      .mockRejectedValueOnce(errorApi(500))
      .mockResolvedValueOnce(respuesta({ tipo: 'JUGADOR', perfil: perfil() }))
    renderMiPerfil()

    expect(
      await screen.findByText('No pudimos cargar tu perfil.', {}, { timeout: 8000 }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    const f = await formulario()
    expect(f.getByRole('note')).toHaveTextContent('Completa tu ubicación')
    await waitFor(() => expect(doble.get).toHaveBeenCalledTimes(2))
  })
})
