import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { ToastProvider } from '@/context/ToastContext'
import { usuarios } from '@/data/seed'

/**
 * Pruebas de humo de la interfaz: renderizan la aplicacion real con sus
 * proveedores y verifican que cada pantalla carga sin errores de runtime y
 * que las guardas de rol se comportan como exige RNF-04.
 */

function renderApp(ruta: string): ReactElement {
  return (
    <MemoryRouter initialEntries={[ruta]}>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>
  )
}

function sesionDe(rol: string) {
  const usuario = usuarios.find((u) => u.rol === rol)!
  localStorage.setItem('proplay.sesion', JSON.stringify(usuario))
}

describe('Aplicacion', () => {
  beforeEach(() => {
    localStorage.clear()
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
    expect(screen.getByText('Carlos Mendoza')).toBeInTheDocument()
    expect(screen.getByText('Julian Ochoa')).toBeInTheDocument()
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
    sesionDe('jugador')
    render(renderApp('/'))
    expect(
      await screen.findByRole('heading', { name: /Bienvenido, Daniel/i }, { timeout: 8000 }),
    ).toBeInTheDocument()
    expect(
      await screen.findByText(/Vacantes que encajan contigo/i, {}, { timeout: 8000 }),
    ).toBeInTheDocument()
  })

  it('el jugador accede a su perfil profesional', async () => {
    sesionDe('jugador')
    render(renderApp('/mi-perfil'))
    expect(
      await screen.findByRole('heading', { name: 'Daniel Ocoro' }, { timeout: 8000 }),
    ).toBeInTheDocument()
    expect(
      await screen.findByText(/Vacantes que encajan contigo|Resumen de evidencia/i, {}, { timeout: 8000 }),
    ).toBeInTheDocument()
  })

  it('el directorio de talento lista los perfiles con sus roles', async () => {
    sesionDe('scout')
    render(renderApp('/explorar'))
    expect(
      await screen.findByRole('heading', { name: /Directorio de talento/i }, { timeout: 8000 }),
    ).toBeInTheDocument()
    expect(
      await screen.findByText(/Filtros de busqueda/i, {}, { timeout: 8000 }),
    ).toBeInTheDocument()
  })

  it('el panel de scouting informa del limite de sus permisos', async () => {
    sesionDe('scout')
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
    sesionDe('equipo')
    render(renderApp('/panel-equipo'))
    expect(
      await screen.findByRole('heading', { name: /Panel de equipo/i }, { timeout: 8000 }),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole('button', { name: /Publicar vacante/i }, { timeout: 8000 }),
    ).toBeInTheDocument()
  })

  it('el panel de equipo muestra los candidatos recomendados por el motor', async () => {
    sesionDe('equipo')
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
    sesionDe('jugador')
    render(renderApp('/panel-equipo'))
    expect(
      await screen.findByText(/No tienes permisos para esta seccion/i, {}, { timeout: 8000 }),
    ).toBeInTheDocument()
  })

  it('el dashboard de analitica muestra los indicadores de exito', async () => {
    sesionDe('admin')
    render(renderApp('/dashboard'))
    expect(
      await screen.findByRole('heading', { name: /Dashboard de analitica/i }, { timeout: 8000 }),
    ).toBeInTheDocument()
    expect(
      await screen.findByText('Cumplimiento de los indicadores de exito', {}, { timeout: 8000 }),
    ).toBeInTheDocument()
  })

  it('la bandeja de notificaciones lista los eventos del usuario', async () => {
    sesionDe('jugador')
    render(renderApp('/'))
    const boton = await screen.findByLabelText(/Notificaciones/i, {}, { timeout: 8000 })
    boton.click()
    expect(
      await screen.findByText(/Estadisticas sincronizadas/i, {}, { timeout: 8000 }),
    ).toBeInTheDocument()
  })

  it('la auditoria solo es visible para el administrador', async () => {
    sesionDe('equipo')
    render(renderApp('/admin'))
    expect(
      await screen.findByText(/No tienes permisos para esta seccion/i, {}, { timeout: 8000 }),
    ).toBeInTheDocument()
  })

  it('el registro de auditoria se abre para el administrador', async () => {
    sesionDe('admin')
    render(renderApp('/admin'))
    expect(
      await screen.findByRole('heading', { name: /Administracion y trazabilidad/i }, { timeout: 8000 }),
    ).toBeInTheDocument()
  })

  it('la vista de vacantes lista las oportunidades publicadas', async () => {
    sesionDe('jugador')
    render(renderApp('/vacantes'))
    expect(
      await screen.findByRole('heading', { name: /Vacantes publicadas/i }, { timeout: 8000 }),
    ).toBeInTheDocument()
    expect(
      await screen.findAllByText(/Mid lane · League of Legends/i, {}, { timeout: 8000 }),
    ).not.toHaveLength(0)
  })

  it('el perfil publico de un jugador muestra sus estadisticas verificadas', async () => {
    sesionDe('scout')
    render(renderApp('/jugador/p-01'))
    expect(
      await screen.findByRole('heading', { name: 'Daniel Ocoro' }, { timeout: 8000 }),
    ).toBeInTheDocument()
    expect(
      await screen.findByText(/Estadisticas de juego \(ingesta directa\)/i, {}, { timeout: 8000 }),
    ).toBeInTheDocument()
  })
})
