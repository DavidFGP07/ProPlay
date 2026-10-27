import { Suspense, lazy } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import type { ComponentType, LazyExoticComponent } from 'react'
import type { Rol } from '@proplay/shared'
import { Layout } from '@/components/Layout'
import { useAuth } from '@/context/AuthContext'
import LoginPage from '@/pages/LoginPage'
import NoEncontradaPage from '@/pages/NoEncontradaPage'
import LegalPage from '@/pages/LegalPage'
import { AREAS } from '@/router/areas'

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
const CuentaPage = lazy(() => import('@/pages/CuentaPage'))

/**
 * Guarda de rutas. Es una ruta de layout sin path: sin roles exige sesion; con
 * roles, delimita un area completa (RNF-04). Las vistas no comprueban el rol.
 */
function Privado({ roles }: { roles?: readonly Rol[] }) {
  const { usuario, cargando } = useAuth()
  // Mientras se recupera la sesion no se decide nada: evita mandar al login a
  // quien tiene una cookie de refresco valida.
  if (cargando) return <Cargando />
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
  return <Outlet />
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

/** Pantalla diferida con su esqueleto de carga. */
function diferida(Pantalla: LazyExoticComponent<ComponentType>) {
  return (
    <Suspense fallback={<Cargando />}>
      <Pantalla />
    </Suspense>
  )
}

export default function App() {
  const { usuario, cargando } = useAuth()

  if (cargando) return <Cargando />

  return (
    <Routes>
      {/* Publicas */}
      <Route
        path="/login"
        element={usuario ? <Navigate to="/" replace /> : <LoginPage />}
      />
      {/* RNF-05 · Aviso de privacidad y terminos: se lee con o sin sesion */}
      <Route path="/legal/privacidad" element={<LegalPage />} />

      <Route element={<Privado />}>
        <Route element={<Layout />}>
          {/* Comunes a todos los roles */}
          <Route index element={diferida(FeedPage)} />
          <Route path="vacantes" element={diferida(OfertasPage)} />
          <Route path="vacantes/:id" element={diferida(OfertaDetallePage)} />
          <Route path="jugador/:id" element={diferida(PerfilJugadorPage)} />
          <Route path="mensajes" element={diferida(MensajesPage)} />
          {/* RF-01 · RNF-05 · Ajustes de cuenta, comunes a los cuatro roles */}
          <Route path="cuenta" element={diferida(CuentaPage)} />

          {/* Area del jugador */}
          <Route element={<Privado roles={AREAS.jugador} />}>
            <Route path="mi-perfil" element={diferida(MiPerfilPage)} />
          </Route>

          {/* Area de equipo y scout */}
          <Route element={<Privado roles={AREAS.equipo} />}>
            <Route path="explorar" element={diferida(ScoutingPage)} />
            <Route path="panel-equipo" element={diferida(PanelEquipoPage)} />
            <Route path="dashboard" element={diferida(DashboardPage)} />
          </Route>

          {/* Area de administracion */}
          <Route element={<Privado roles={AREAS.admin} />}>
            <Route path="admin" element={diferida(AdminPage)} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NoEncontradaPage />} />
    </Routes>
  )
}
