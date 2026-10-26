import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { ToastProvider } from '@/context/ToastContext'
import { crearQueryClient } from '@/api/queryClient'
import type { Rol, UsuarioPublico } from '@proplay/shared'

/**
 * Pruebas de humo de la interfaz: renderizan la aplicacion real con sus
 * proveedores y verifican que cada pantalla carga sin errores de runtime y
 * que las guardas de rol se comportan como exige RNF-04.
 */

function renderApp(ruta: string): ReactElement {
  return (
    <MemoryRouter initialEntries={[ruta]}>
      <QueryClientProvider client={crearQueryClient()}>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

/**
 * La sesion la da la API real (GET /auth/me con la cookie de refresco); aqui
 * se sustituye el recurso `auth` por uno en memoria. Cada usuario lleva el
 * nombre de la persona de demostracion de su rol, que es la que ven las vistas.
 */
const sesion = vi.hoisted(() => ({ usuario: null as UsuarioPublico | null }))

vi.mock('@/api/auth', () => ({
  authApi: {
    yo: async () => {
      if (!sesion.usuario) throw new Error('401')
      return { usuario: sesion.usuario }
    },
    login: async () => {
      throw new Error('No disponible en las pruebas de humo')
    },
    registrar: async () => {
      throw new Error('No disponible en las pruebas de humo')
    },
    logout: async () => {},
  },
}))

const NOMBRES: Record<Rol, string> = {
  JUGADOR: 'Daniel Ocoro',
  EQUIPO: 'Carlos Mendoza',
  SCOUT: 'Julian Ochoa',
  ADMIN: 'Andrea Restrepo',
}

function sesionDe(rol: Rol) {
  sesion.usuario = {
    id: `cuenta-${rol.toLowerCase()}`,
    email: `${rol.toLowerCase()}@proplay.gg`,
    nombre: NOMBRES[rol],
    rol,
    emailVerificado: true,
    activo: true,
    creadoEn: new Date('2026-09-10T00:00:00Z'),
  }
}

describe('Aplicacion', () => {
  beforeEach(() => {
    sesion.usuario = null
  })

  it('sin sesion activa redirige al login', async () => {
    render(renderApp('/'))
    expect(
      await screen.findByRole('heading', { name: /Iniciar sesion/i }),
    ).toBeInTheDocument()
  })

  it('el login ofrece las cuentas de demostracion por rol', async () => {
    render(renderApp('/login'))
    expect(await screen.findByText('Cuentas de demostracion')).toBeInTheDocument()
    expect(screen.getByText('Caribe eSports')).toBeInTheDocument()
    expect(screen.getByText('Marcela Guzmán')).toBeInTheDocument()
  })

  it('el registro exige aceptar el aviso de privacidad (RNF-05)', async () => {
    render(renderApp('/login'))
    await screen.findByRole('heading', { name: /Iniciar sesion/i })
    const pestana = screen.getByRole('button', { name: 'Crear cuenta' })
    pestana.click()

    const aviso = await screen.findByText(/aviso de privacidad de ProPlay/i)
    expect(aviso).toBeInTheDocument()
    expect(
      screen.getByText(/Ley 1581 de 2012/i),
    ).toBeInTheDocument()
  })

  it('el feed del jugador carga con sus metricas y recomendaciones', async () => {
    sesionDe('JUGADOR')
    render(renderApp('/'))
    expect(
      await screen.findByRole('heading', { name: /Bienvenido, Daniel/i }, { timeout: 8000 }),
    ).toBeInTheDocument()
    expect(
      await screen.findByText(/Vacantes que encajan contigo/i, {}, { timeout: 8000 }),
    ).toBeInTheDocument()
  })

  it('el jugador accede a su perfil profesional', async () => {
    sesionDe('JUGADOR')
    render(renderApp('/mi-perfil'))
    expect(
      await screen.findByRole('heading', { name: 'Daniel Ocoro' }, { timeout: 8000 }),
    ).toBeInTheDocument()
    expect(
      await screen.findByText(/Vacantes que encajan contigo|Resumen de evidencia/i, {}, { timeout: 8000 }),
    ).toBeInTheDocument()
  })

  it('el directorio de talento lista los perfiles con sus roles', async () => {
    sesionDe('SCOUT')
    render(renderApp('/explorar'))
    expect(
      await screen.findByRole('heading', { name: /Directorio de talento/i }, { timeout: 8000 }),
    ).toBeInTheDocument()
    expect(
      await screen.findByText(/Filtros de busqueda/i, {}, { timeout: 8000 }),
    ).toBeInTheDocument()
  })

  it('el panel de scouting informa del limite de sus permisos', async () => {
    sesionDe('SCOUT')
    render(renderApp('/panel-equipo'))
    expect(
      await screen.findByRole('heading', { name: /Panel de scouting/i }, { timeout: 8000 }),
    ).toBeInTheDocument()
    expect(
      await screen.findByText(/mismas capacidades de/i, {}, { timeout: 8000 }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Publicar vacante/i })).toBeNull()
  })

  it('el panel de equipo si permite publicar vacantes', async () => {
    sesionDe('EQUIPO')
    render(renderApp('/panel-equipo'))
    expect(
      await screen.findByRole('heading', { name: /Panel de equipo/i }, { timeout: 8000 }),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole('button', { name: /Publicar vacante/i }, { timeout: 8000 }),
    ).toBeInTheDocument()
  })

  it('el panel de equipo muestra los candidatos recomendados por el motor', async () => {
    sesionDe('EQUIPO')
    render(renderApp('/panel-equipo'))
    expect(
      await screen.findByText(/Recomendaciones del motor para tus vacantes/i, {}, { timeout: 8000 }),
    ).toBeInTheDocument()
    // El ranking se calcula sobre la vacante abierta y lista candidatos reales.
    expect(
      await screen.findAllByText(/Daniel Ocoro|Sara Pelaez|Vanesa Ospina|Kevin Barrios/, {}, { timeout: 8000 }),
    ).not.toHaveLength(0)
  })

  it('el jugador no puede entrar al panel de equipo (RNF-04)', async () => {
    sesionDe('JUGADOR')
    render(renderApp('/panel-equipo'))
    expect(
      await screen.findByText(/No tienes permisos para esta seccion/i, {}, { timeout: 8000 }),
    ).toBeInTheDocument()
  })

  it('el dashboard de analitica muestra los indicadores de exito', async () => {
    sesionDe('ADMIN')
    render(renderApp('/dashboard'))
    expect(
      await screen.findByRole('heading', { name: /Dashboard de analitica/i }, { timeout: 8000 }),
    ).toBeInTheDocument()
    expect(
      await screen.findByText('Cumplimiento de los indicadores de exito', {}, { timeout: 8000 }),
    ).toBeInTheDocument()
  })

  it('la bandeja de notificaciones lista los eventos del usuario', async () => {
    sesionDe('JUGADOR')
    render(renderApp('/'))
    const boton = await screen.findByLabelText(/Notificaciones/i, {}, { timeout: 8000 })
    boton.click()
    expect(
      await screen.findByText(/Estadisticas sincronizadas/i, {}, { timeout: 8000 }),
    ).toBeInTheDocument()
  })

  it('la auditoria solo es visible para el administrador', async () => {
    sesionDe('EQUIPO')
    render(renderApp('/admin'))
    expect(
      await screen.findByText(/No tienes permisos para esta seccion/i, {}, { timeout: 8000 }),
    ).toBeInTheDocument()
  })

  it('el registro de auditoria se abre para el administrador', async () => {
    sesionDe('ADMIN')
    render(renderApp('/admin'))
    expect(
      await screen.findByRole('heading', { name: /Administracion y trazabilidad/i }, { timeout: 8000 }),
    ).toBeInTheDocument()
  })

  it('la vista de vacantes lista las oportunidades publicadas', async () => {
    sesionDe('JUGADOR')
    render(renderApp('/vacantes'))
    expect(
      await screen.findByRole('heading', { name: /Vacantes publicadas/i }, { timeout: 8000 }),
    ).toBeInTheDocument()
    expect(
      await screen.findAllByText(/Mid lane · League of Legends/i, {}, { timeout: 8000 }),
    ).not.toHaveLength(0)
  })

  it('el perfil publico de un jugador muestra sus estadisticas verificadas', async () => {
    sesionDe('SCOUT')
    render(renderApp('/jugador/p-01'))
    expect(
      await screen.findByRole('heading', { name: 'Daniel Ocoro' }, { timeout: 8000 }),
    ).toBeInTheDocument()
    expect(
      await screen.findByText(/Estadisticas de juego \(ingesta directa\)/i, {}, { timeout: 8000 }),
    ).toBeInTheDocument()
  })
})
