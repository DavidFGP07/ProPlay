import { Suspense, lazy } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Layout } from '@/components/Layout'
import { useAuth } from '@/context/AuthContext'
import LoginPage from '@/pages/LoginPage'
import type { Usuario } from '@/types'

/**
 * Carga diferida por ruta. Cada pantalla se descarga solo cuando se visita,
 * de modo que el bundle inicial no arrastra el graficador (recharts) ni las
 * pantallas de gestion que un jugador no visitara.
 */
const FeedPage = lazy(() => import('@/pages/FeedPage'))
const ScoutingPage = lazy(() => import('@/pages/ScoutingPage'))
const OfertasPage = lazy(() => import('@/pages/OfertasPage'))
const OfertaDetallePage = lazy(() => import('@/pages/OfertaDetallePage'))
const PanelEquipoPage = lazy(() => import('@/pages/PanelEquipoPage'))
const PerfilJugadorPage = lazy(() => import('@/pages/PerfilJugadorPage'))
const MiPerfilPage = lazy(() => import('@/pages/MiPerfilPage'))
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const MensajesPage = lazy(() => import('@/pages/MensajesPage'))
const AdminPage = lazy(() => import('@/pages/AdminPage'))

/**
 * Guarda de rutas. Se usa como ruta padre (con Outlet) o como envoltorio de
 * una pantalla concreta (con children) cuando el permiso depende del rol.
 */
function Privado({
  roles,
  children,
}: {
  roles?: Usuario['rol'][]
  children?: ReactNode
}) {
  const { usuario } = useAuth()
  if (!usuario) return <Navigate to="/login" replace />
  if (roles && !roles.includes(usuario.rol)) {
    return (
      <div className="card p-8 text-center">
        <h2 className="text-base font-semibold text-slate-100">
          No tienes permisos para esta seccion
        </h2>
        <p className="mt-1.5 text-xs text-slate-500">
          Tu rol actual no tiene acceso a este modulo (RNF-04: control de acceso
          por rol).
        </p>
      </div>
    )
  }
  return children ? <>{children}</> : <Outlet />
}

function Cargando() {
  return (
    <div className="space-y-4">
      <div className="skeleton h-10 w-64 rounded-xl" />
      <div className="skeleton h-56 rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-32 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

export default function App() {
  const { usuario } = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={usuario ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route element={<Privado />}>
        <Route element={<Layout />}>
          <Route
            index
            element={
              <Suspense fallback={<Cargando />}>
                <FeedPage />
              </Suspense>
            }
          />
          <Route
            path="explorar"
            element={
              <Privado roles={['equipo', 'scout', 'admin']}>
                <Suspense fallback={<Cargando />}>
                  <ScoutingPage />
                </Suspense>
              </Privado>
            }
          />
          <Route
            path="vacantes"
            element={
              <Suspense fallback={<Cargando />}>
                <OfertasPage />
              </Suspense>
            }
          />
          <Route
            path="vacantes/:id"
            element={
              <Suspense fallback={<Cargando />}>
                <OfertaDetallePage />
              </Suspense>
            }
          />
          <Route
            path="panel-equipo"
            element={
              <Privado roles={['equipo', 'scout', 'admin']}>
                <Suspense fallback={<Cargando />}>
                  <PanelEquipoPage />
                </Suspense>
              </Privado>
            }
          />
          <Route
            path="jugador/:id"
            element={
              <Suspense fallback={<Cargando />}>
                <PerfilJugadorPage />
              </Suspense>
            }
          />
          <Route
            path="mi-perfil"
            element={
              <Privado roles={['jugador']}>
                <Suspense fallback={<Cargando />}>
                  <MiPerfilPage />
                </Suspense>
              </Privado>
            }
          />
          <Route
            path="dashboard"
            element={
              <Privado roles={['equipo', 'scout', 'admin']}>
                <Suspense fallback={<Cargando />}>
                  <DashboardPage />
                </Suspense>
              </Privado>
            }
          />
          <Route
            path="mensajes"
            element={
              <Suspense fallback={<Cargando />}>
                <MensajesPage />
              </Suspense>
            }
          />
          <Route
            path="admin"
            element={
              <Privado roles={['admin']}>
                <Suspense fallback={<Cargando />}>
                  <AdminPage />
                </Suspense>
              </Privado>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}
