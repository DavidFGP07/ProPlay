import { Link, Outlet } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { es } from '@/i18n/es'

/**
 * Marco de las vistas que se pueden abrir sin sesión (el perfil público del
 * jugador): la marca y la entrada a la plataforma, sin el menú de la app.
 */
export function MarcoPublico() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-white/8 bg-surface-850/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            to="/login"
            className="flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-400"
          >
            <img src="/logo.svg" alt="" className="size-8 rounded-lg" />
            <span>
              <span className="block text-base font-bold leading-none tracking-tight text-slate-50">
                Pro<span className="gradient-text">Play</span>
              </span>
              <span className="mt-1 hidden text-[10px] leading-none text-slate-500 sm:block">
                {es.marcoPublico.lema}
              </span>
            </span>
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-brand-500/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
          >
            <LogIn size={14} aria-hidden />
            {es.marcoPublico.ingresar}
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
        <Outlet />
      </main>
    </div>
  )
}
