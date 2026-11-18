import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Briefcase,
  ChartNoAxesColumn,
  Link2,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  Target,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { Avatar, Badge, Button, cn } from '@/components/ui'
import { AvisoDatosDemo } from '@/components/AvisoDatosDemo'
import { NotificacionesBell } from '@/components/NotificacionesBell'
import { AREAS } from '@/router/areas'
import { es } from '@/i18n/es'
import type { Rol } from '@proplay/shared'

interface ItemNav {
  to: string
  label: string
  icono: LucideIcon
  roles?: readonly Rol[]
}

// Tarea 1.7: Feed, Mensajes y Auditoría (administración) salen del menú; son
// trabajo futuro (decisión 0.10) y sus URL muestran «no disponible».
const NAVEGACION: ItemNav[] = [
  { to: '/mi-perfil', label: 'Mi perfil', icono: UserRound, roles: AREAS.jugador },
  {
    to: '/cuentas-vinculadas',
    label: es.cuentasVinculadas.menu,
    icono: Link2,
    roles: AREAS.jugador,
  },
  {
    to: '/mis-estadisticas',
    label: es.misEstadisticas.menu,
    icono: BarChart3,
    roles: AREAS.jugador,
  },
  { to: '/explorar', label: 'Explorar talento', icono: Search, roles: AREAS.equipo },
  { to: '/vacantes', label: 'Vacantes', icono: Briefcase },
  { to: '/panel-equipo', label: 'Panel de equipo', icono: Target, roles: AREAS.equipo },
  { to: '/dashboard', label: es.analitica.menu, icono: ChartNoAxesColumn, roles: AREAS.equipo },
  // Sin roles: la vista de cuenta es comun a los cuatro.
  { to: '/cuenta', label: es.cuenta.menu, icono: Settings },
]

export function Layout() {
  const { usuario, salir } = useAuth()
  const { notificar } = useToast()
  const navegar = useNavigate()
  const ubicacion = useLocation()
  const [menuAbierto, setMenuAbierto] = useState(false)

  if (!usuario) return null

  const items = NAVEGACION.filter(
    (i) => !i.roles || i.roles.includes(usuario.rol),
  )

  const manejarSalir = async () => {
    await salir()
    notificar('Sesion cerrada correctamente.', 'info')
    navegar('/login')
  }

  return (
    <div className="min-h-screen">
      {/* ------------------------------ Sidebar ------------------------------ */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-white/8 bg-surface-850/95 backdrop-blur-xl transition-transform lg:translate-x-0',
          menuAbierto ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="" className="size-8 rounded-lg" />
            <div>
              <p className="text-base font-bold leading-none tracking-tight text-slate-50">
                Pro<span className="gradient-text">Play</span>
              </p>
              <p className="mt-1 text-[10px] leading-none text-slate-500">
                Scouting de talento eSports
              </p>
            </div>
          </div>
          <button
            className="text-slate-500 lg:hidden"
            onClick={() => setMenuAbierto(false)}
            aria-label="Cerrar menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {items.map((item) => {
            const Icono = item.icono
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMenuAbierto(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                    isActive
                      ? 'bg-gradient-to-r from-brand-500/18 to-transparent text-brand-200 shadow-[inset_2px_0_0_0_#7c4df5]'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
                  )
                }
              >
                <Icono size={17} className="shrink-0" />
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        <div className="border-t border-white/8 p-3">
          <div className="rounded-xl bg-white/4 p-3">
            <div className="flex items-center gap-2.5">
              <ShieldCheck size={15} className="shrink-0 text-emerald-400" />
              <p className="text-[11px] leading-snug text-slate-400">
                Datos de juego obtenidos por
                <span className="text-slate-200"> ingesta directa</span> desde la
                API oficial.
              </p>
            </div>
          </div>
        </div>
      </aside>

      {menuAbierto && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setMenuAbierto(false)}
        />
      )}

      {/* ------------------------------ Topbar ------------------------------ */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-white/8 bg-surface-900/80 px-4 backdrop-blur-xl sm:px-6">
          <button
            className="text-slate-400 lg:hidden"
            onClick={() => setMenuAbierto(true)}
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>

          {/* RF-12 · La campana usa las notificaciones reales (GET /notificaciones);
              la línea del worker, que era simulada, sigue fuera (tarea 1.7). */}
          <div className="flex flex-1 items-center justify-end gap-2">
            <NotificacionesBell />

            <Link
              to="/cuenta"
              aria-label={es.cuenta.menu}
              className="flex items-center gap-2.5 rounded-lg border border-white/8 bg-white/4 py-1 pl-1 pr-3 transition hover:border-brand-500/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
            >
              <Avatar nombre={usuario.nombre} size="sm" />
              <div className="hidden leading-tight sm:block">
                <p className="text-xs font-medium text-slate-200">{usuario.nombre}</p>
                <Badge tono="violeta" className="mt-0.5 !px-1.5 !py-0 !text-[10px]">
                  {es.rol[usuario.rol]}
                </Badge>
              </div>
            </Link>

            <Button
              variante="fantasma"
              tamano="sm"
              onClick={manejarSalir}
              className="hidden sm:inline-flex"
            >
              <LogOut size={14} />
              Salir
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8">
          <AvisoDatosDemo />
          <Outlet key={ubicacion.pathname} />
        </main>
      </div>
    </div>
  )
}
