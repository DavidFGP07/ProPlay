import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, CheckCheck } from 'lucide-react'
import { Button, cn } from '@/components/ui'
import {
  useContadorNotificaciones,
  useMarcarLeidas,
  useMarcarTodasLeidas,
  useNotificacionesRecientes,
} from '@/api/notificaciones'
import { es } from '@/i18n/es'
import { describirNotificacion, haceCuanto } from '@/lib/notificaciones'

const t = es.notificaciones

/**
 * RF-12 · Campana de la cabecera: el contador de no leídas (consultado cada
 * 60 s, sin tiempo real) y un panel con las últimas notificaciones, «Marcar
 * todas como leídas» y el enlace de cada una, que la marca como leída.
 *
 * Teclado: el botón abre y cierra el panel; Esc lo cierra y devuelve el foco
 * al botón. El nombre del botón lleva el contador y un aviso educado lo anuncia
 * cuando cambia.
 */
export function NotificacionesBell() {
  const [abierto, setAbierto] = useState(false)
  const contador = useContadorNotificaciones()
  const recientes = useNotificacionesRecientes(abierto)
  const marcarLeidas = useMarcarLeidas()
  const marcarTodas = useMarcarTodasLeidas()
  const contenedor = useRef<HTMLDivElement>(null)
  const boton = useRef<HTMLButtonElement>(null)
  const idPanel = useId()
  const noLeidas = contador.data?.noLeidas ?? 0

  useEffect(() => {
    if (!abierto) return
    const alPulsar = (e: MouseEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false)
    }
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAbierto(false)
        boton.current?.focus()
      }
    }
    document.addEventListener('mousedown', alPulsar)
    document.addEventListener('keydown', alTeclear)
    return () => {
      document.removeEventListener('mousedown', alPulsar)
      document.removeEventListener('keydown', alTeclear)
    }
  }, [abierto])

  const notificaciones = recientes.data?.data ?? []

  return (
    <div className="relative" ref={contenedor}>
      <button
        ref={boton}
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-label={t.boton(noLeidas)}
        aria-expanded={abierto}
        aria-controls={idPanel}
        className="relative grid size-9 place-items-center rounded-lg text-slate-300 transition hover:bg-white/6 hover:text-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
      >
        <Bell size={17} aria-hidden />
        {noLeidas > 0 && (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white"
          >
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>
      <span className="sr-only" aria-live="polite">
        {noLeidas > 0 ? t.anuncio(noLeidas) : ''}
      </span>

      {abierto && (
        <section
          id={idPanel}
          aria-label={t.titulo}
          // En móvil, fijo a la pantalla con 16 px a cada lado (la campana no está en
          // el borde y un panel anclado a ella se saldría por la izquierda).
          className="animate-fade-up fixed inset-x-4 top-16 z-50 overflow-hidden rounded-2xl border border-white/10 bg-surface-800 shadow-2xl shadow-black/50 sm:absolute sm:inset-x-auto sm:top-11 sm:right-0 sm:w-[22rem]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
            <div>
              <h2 className="text-xs font-semibold text-slate-100">{t.titulo}</h2>
              <p className="text-[11px] text-slate-400">{t.sinLeer(noLeidas)}</p>
            </div>
            {noLeidas > 0 && (
              <Button
                variante="fantasma"
                tamano="sm"
                onClick={() => marcarTodas.mutate()}
                disabled={marcarTodas.isPending}
              >
                <CheckCheck size={13} aria-hidden />
                {t.marcarTodas}
              </Button>
            )}
          </div>

          <div className="max-h-[22rem] overflow-y-auto">
            {recientes.isPending ? (
              <div aria-busy="true" aria-label={t.cargando} className="space-y-2 p-4">
                <div className="skeleton h-10 rounded-lg" />
                <div className="skeleton h-10 rounded-lg" />
                <div className="skeleton h-10 rounded-lg" />
              </div>
            ) : recientes.isError ? (
              <div className="space-y-2 px-4 py-6 text-center">
                <p className="text-xs text-slate-400">{t.error}</p>
                <Button variante="fantasma" tamano="sm" onClick={() => void recientes.refetch()}>
                  {t.reintentar}
                </Button>
              </div>
            ) : notificaciones.length === 0 ? (
              <p className="px-4 py-10 text-center text-xs text-slate-400">{t.vacio}</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {notificaciones.map((n) => {
                  const { texto, enlace } = describirNotificacion(n)
                  const sinLeer = n.leidaEn === null
                  return (
                    <li key={n.id}>
                      <Link
                        to={enlace}
                        onClick={() => {
                          if (sinLeer) marcarLeidas.mutate([n.id])
                          setAbierto(false)
                        }}
                        className={cn(
                          'flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-white/4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-400',
                          sinLeer && 'bg-brand-500/6',
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', sinLeer ? 'bg-brand-400' : 'bg-transparent')}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs leading-relaxed text-slate-200">
                            {sinLeer && <span className="sr-only">{t.nueva}: </span>}
                            {texto}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-slate-400">{haceCuanto(n.creadoEn)}</span>
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
