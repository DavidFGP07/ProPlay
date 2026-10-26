import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'

type TipoToast = 'exito' | 'info' | 'error'

interface Toast {
  id: number
  tipo: TipoToast
  mensaje: string
}

interface ToastContextValue {
  notificar: (mensaje: string, tipo?: TipoToast) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const estilos: Record<TipoToast, { icono: typeof Info; clase: string }> = {
  exito: { icono: CheckCircle2, clase: 'border-emerald-500/40 text-emerald-300' },
  info: { icono: Info, clase: 'border-accent-500/40 text-accent-400' },
  error: { icono: TriangleAlert, clase: 'border-rose-500/40 text-rose-300' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const notificar = useCallback(
    (mensaje: string, tipo: TipoToast = 'exito') => {
      const id = Date.now() + Math.random()
      setToasts((t) => [...t, { id, tipo, mensaje }])
      window.setTimeout(() => dismiss(id), 4200)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ notificar }), [notificar])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[min(92vw,26rem)] flex-col gap-2">
        {toasts.map((t) => {
          const { icono: Icono, clase } = estilos[t.tipo]
          return (
            <div
              key={t.id}
              className={`pointer-events-auto animate-fade-up flex items-start gap-3 rounded-xl border bg-surface-800/95 px-4 py-3 shadow-xl shadow-black/40 backdrop-blur ${clase}`}
            >
              <Icono size={18} className="mt-0.5 shrink-0" />
              <p className="flex-1 text-sm leading-snug text-slate-200">{t.mensaje}</p>
              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 text-slate-500 transition hover:text-slate-300"
                aria-label="Cerrar"
              >
                <X size={15} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider')
  return ctx
}
