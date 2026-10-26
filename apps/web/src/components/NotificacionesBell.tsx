import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  Briefcase,
  CheckCheck,
  Database,
  MessageSquare,
  Sparkles,
  UserCheck,
} from 'lucide-react'
import { Button, cn } from '@/components/ui'
import {
  useMarcarNotificacionLeida,
  useMarcarTodasLeidas,
  useNotificaciones,
} from '@/api/notificaciones'
import type { Notificacion, TipoNotificacion } from '@/mocks/modelos'

const ICONOS: Record<TipoNotificacion, typeof Bell> = {
  postulacion: Briefcase,
  estado_postulacion: Sparkles,
  oferta: Sparkles,
  endoso: UserCheck,
  ingesta: Database,
  mensaje: MessageSquare,
}

const COLORES: Record<TipoNotificacion, string> = {
  postulacion: 'bg-brand-500/12 text-brand-300',
  estado_postulacion: 'bg-accent-500/12 text-accent-400',
  oferta: 'bg-brand-500/12 text-brand-300',
  endoso: 'bg-emerald-500/12 text-emerald-300',
  ingesta: 'bg-cyan-500/12 text-cyan-300',
  mensaje: 'bg-amber-500/12 text-amber-300',
}

function tiempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutos = Math.floor(diff / 60_000)
  if (minutos < 1) return 'ahora'
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.floor(horas / 24)
  if (dias === 1) return 'ayer'
  if (dias < 30) return `hace ${dias} dias`
  return new Date(iso).toLocaleDateString('es-CO')
}

/**
 * Centro de notificaciones (RF-12). Consume los eventos de negocio que emite
 * la capa de API: postulaciones, cambios de estado, endoses, sincronizaciones
 * del worker y mensajes.
 */
export function NotificacionesBell() {
  const navegar = useNavigate()
  const [abierto, setAbierto] = useState(false)
  const { data: notificaciones = [] } = useNotificaciones()
  const marcarLeida = useMarcarNotificacionLeida()
  const marcarTodas = useMarcarTodasLeidas()
  const contenedorRef = useRef<HTMLDivElement>(null)

  // Cierre al pulsar fuera del panel.
  useEffect(() => {
    if (!abierto) return
    const alPulsar = (e: MouseEvent) => {
      if (!contenedorRef.current?.contains(e.target as Node)) setAbierto(false)
    }
    const alEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('mousedown', alPulsar)
    document.addEventListener('keydown', alEsc)
    return () => {
      document.removeEventListener('mousedown', alPulsar)
      document.removeEventListener('keydown', alEsc)
    }
  }, [abierto])

  const noLeidas = notificaciones.filter((n) => !n.leida).length

  const abrirNotificacion = async (n: Notificacion) => {
    await marcarLeida.mutateAsync(n.id)
    setAbierto(false)
    if (n.enlace) navegar(n.enlace)
  }

  return (
    <div className="relative" ref={contenedorRef}>
      <button
        onClick={() => setAbierto((v) => !v)}
        className="relative grid size-9 place-items-center rounded-lg text-slate-400 transition hover:bg-white/6 hover:text-slate-200"
        aria-label={`Notificaciones${noLeidas > 0 ? `, ${noLeidas} sin leer` : ''}`}
        aria-expanded={abierto}
      >
        <Bell size={17} />
        {noLeidas > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-brand-500 px-1 text-[9px] font-bold text-white">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <div className="animate-fade-up absolute right-0 top-11 z-50 w-[min(92vw,22rem)] overflow-hidden rounded-2xl border border-white/10 bg-surface-800 shadow-2xl shadow-black/50">
          <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-slate-100">Notificaciones</p>
              <p className="text-[10px] text-slate-500">
                {noLeidas > 0 ? `${noLeidas} sin leer` : 'Todo al dia'}
              </p>
            </div>
            {noLeidas > 0 && (
              <Button
                variante="fantasma"
                tamano="sm"
                onClick={() => marcarTodas.mutate()}
              >
                <CheckCheck size={13} />
                Marcar todas
              </Button>
            )}
          </div>

          <div className="max-h-[22rem] overflow-y-auto">
            {notificaciones.length === 0 ? (
              <p className="px-4 py-10 text-center text-xs text-slate-500">
                No hay eventos por ahora.
              </p>
            ) : (
              <ul className="divide-y divide-white/5">
                {notificaciones.map((n) => {
                  const Icono = ICONOS[n.tipo]
                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => abrirNotificacion(n)}
                        className={cn(
                          'flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-white/4',
                          !n.leida && 'bg-brand-500/6',
                        )}
                      >
                        <span
                          className={cn(
                            'mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg',
                            COLORES[n.tipo],
                          )}
                        >
                          <Icono size={15} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span className="text-[11px] font-medium text-slate-200">
                              {n.titulo}
                            </span>
                            <span className="shrink-0 text-[10px] text-slate-600">
                              {tiempoRelativo(n.fecha)}
                            </span>
                          </span>
                          <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">
                            {n.detalle}
                          </span>
                          {!n.leida && (
                            <span className="mt-1.5 inline-block size-1.5 rounded-full bg-brand-400" />
                          )}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-white/8 px-4 py-2.5">
            <p className="text-[10px] leading-relaxed text-slate-600">
              Los eventos se registran con usuario, accion y marca de tiempo en el
              registro de auditoria (RNF-06).
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
