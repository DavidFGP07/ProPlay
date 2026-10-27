import { forwardRef, useEffect, useRef } from 'react'
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

/* ---------------------------------- Card ---------------------------------- */

export function Card({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('card', className)} {...props}>
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  subtitle,
  icon,
  action,
}: {
  title: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/6 px-5 py-4">
      <div className="flex items-start gap-3">
        {icon && (
          <span className="mt-0.5 grid size-9 place-items-center rounded-lg bg-brand-500/12 text-brand-300">
            {icon}
          </span>
        )}
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-slate-100">{title}</h3>
          {subtitle && (
            <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{subtitle}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  )
}

/* --------------------------------- Button --------------------------------- */

type Variante = 'primario' | 'secundario' | 'fantasma' | 'peligro' | 'exito'

const variantes: Record<Variante, string> = {
  primario:
    'bg-gradient-to-r from-brand-600 to-accent-600 text-white shadow-lg shadow-brand-900/40 hover:from-brand-500 hover:to-accent-500',
  secundario:
    'border border-white/12 bg-white/5 text-slate-200 hover:border-brand-500/50 hover:bg-white/8',
  fantasma: 'text-slate-400 hover:bg-white/6 hover:text-slate-200',
  peligro: 'border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20',
  exito: 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20',
}

export function Button({
  variante = 'primario',
  cargando = false,
  tamano = 'md',
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante
  cargando?: boolean
  tamano?: 'sm' | 'md' | 'lg'
}) {
  const tamanos = {
    sm: 'h-8 px-3 text-xs gap-1.5',
    md: 'h-10 px-4 text-sm gap-2',
    lg: 'h-12 px-6 text-base gap-2.5',
  }
  return (
    <button
      type={type}
      disabled={disabled || cargando}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg font-medium transition-all duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400',
        'disabled:cursor-not-allowed disabled:opacity-45',
        tamanos[tamano],
        variantes[variante],
        className,
      )}
      {...props}
    >
      {cargando && <Loader2 size={15} className="animate-spin" />}
      {children}
    </button>
  )
}

/* --------------------------------- Badge ---------------------------------- */

type TonoBadge = 'neutro' | 'violeta' | 'cian' | 'verde' | 'ambar' | 'rojo' | 'azul'

const tonos: Record<TonoBadge, string> = {
  neutro: 'border-white/12 bg-white/6 text-slate-300',
  violeta: 'border-brand-500/40 bg-brand-500/12 text-brand-300',
  cian: 'border-accent-500/40 bg-accent-500/12 text-accent-400',
  verde: 'border-emerald-500/40 bg-emerald-500/12 text-emerald-300',
  ambar: 'border-amber-500/40 bg-amber-500/12 text-amber-300',
  rojo: 'border-rose-500/40 bg-rose-500/12 text-rose-300',
  azul: 'border-sky-500/40 bg-sky-500/12 text-sky-300',
}

export function Badge({
  tono = 'neutro',
  className,
  children,
}: {
  tono?: TonoBadge
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap',
        tonos[tono],
        className,
      )}
    >
      {children}
    </span>
  )
}

/* --------------------------------- Avatar --------------------------------- */

const paletas = [
  'from-violet-500 to-fuchsia-500',
  'from-cyan-500 to-blue-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
  'from-indigo-500 to-violet-500',
]

export function Avatar({
  nombre,
  size = 'md',
  className,
}: {
  nombre: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}) {
  const iniciales = nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
  const hash = [...nombre].reduce((a, c) => a + c.charCodeAt(0), 0)
  const paleta = paletas[hash % paletas.length]
  const tamanos = {
    xs: 'size-7 text-[10px]',
    sm: 'size-9 text-xs',
    md: 'size-11 text-sm',
    lg: 'size-16 text-lg',
    xl: 'size-24 text-3xl',
  }
  return (
    <div
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-gradient-to-br font-bold text-white select-none',
        paleta,
        tamanos[size],
        className,
      )}
    >
      {iniciales}
    </div>
  )
}

/* ------------------------------- Progress --------------------------------- */

export function Progress({
  valor,
  className,
  barClassName,
}: {
  valor: number
  className?: string
  barClassName?: string
}) {
  const v = Math.max(0, Math.min(1, valor))
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-white/8', className)}>
      <div
        className={cn(
          'h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500 transition-[width] duration-500',
          barClassName,
        )}
        style={{ width: `${v * 100}%` }}
      />
    </div>
  )
}

/* ---------------------------------- Stat ---------------------------------- */

export function Stat({
  label,
  value,
  hint,
  icono,
  acento = 'violeta',
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  icono?: ReactNode
  acento?: 'violeta' | 'cian' | 'verde' | 'ambar'
}) {
  const acentos = {
    violeta: 'bg-brand-500/12 text-brand-300',
    cian: 'bg-accent-500/12 text-accent-400',
    verde: 'bg-emerald-500/12 text-emerald-300',
    ambar: 'bg-amber-500/12 text-amber-300',
  }
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-400">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-slate-50">{value}</p>
          {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
        </div>
        {icono && (
          <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', acentos[acento])}>
            {icono}
          </span>
        )}
      </div>
    </Card>
  )
}

/* --------------------------------- Inputs --------------------------------- */

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label?: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cn('block', className)}>
      {label && (
        <span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span>
      )}
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>}
    </label>
  )
}

const baseInput =
  'w-full rounded-lg border border-white/10 bg-surface-900/70 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 transition focus:border-brand-500/60 focus:outline-none focus:ring-2 focus:ring-brand-500/20'

// Reenvian el ref para que react-hook-form pueda registrar el campo.
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(baseInput, className)} {...props} />
  },
)

/** Mensaje de error de un campo de formulario, anunciado a lectores de pantalla. */
export function ErrorCampo({ mensaje }: { mensaje?: string }) {
  if (!mensaje) return null
  return (
    <span role="alert" className="mt-1 block text-[11px] text-rose-300">
      {mensaje}
    </span>
  )
}

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn(baseInput, 'cursor-pointer', className)} {...props}>
        {children}
      </select>
    )
  },
)

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(baseInput, 'resize-none', className)} {...props} />
}

/* --------------------------------- Empty ---------------------------------- */

export function EmptyState({
  icono,
  titulo,
  descripcion,
  action,
}: {
  icono: ReactNode
  titulo: string
  descripcion?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-xl bg-white/5 text-slate-500">
        {icono}
      </span>
      <div>
        <p className="text-sm font-semibold text-slate-300">{titulo}</p>
        {descripcion && (
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
            {descripcion}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}

/* --------------------------------- Tabs ----------------------------------- */

export function Tabs({
  tabs,
  activa,
  onChange,
}: {
  tabs: { id: string; label: string; badge?: number }[]
  activa: string
  onChange: (id: string) => void
}) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-white/8">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            'relative shrink-0 px-3.5 py-2.5 text-xs font-medium transition',
            activa === t.id
              ? 'text-brand-300'
              : 'text-slate-500 hover:text-slate-300',
          )}
        >
          <span className="flex items-center gap-1.5">
            {t.label}
            {t.badge !== undefined && t.badge > 0 && (
              <span className="rounded-full bg-brand-500/20 px-1.5 py-0.5 text-[10px] text-brand-300">
                {t.badge}
              </span>
            )}
          </span>
          {activa === t.id && (
            <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-brand-500 to-accent-500" />
          )}
        </button>
      ))}
    </div>
  )
}

/* --------------------------------- Modal ---------------------------------- */

export function Modal({
  abierto,
  onCerrar,
  titulo,
  children,
  ancho = 'max-w-lg',
}: {
  abierto: boolean
  onCerrar: () => void
  titulo: ReactNode
  children: ReactNode
  ancho?: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Cierre con Escape y foco inicial en el panel (accesibilidad del dialogo).
  useEffect(() => {
    if (!abierto) return
    const alEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', alEsc)
    const foco = window.setTimeout(() => panelRef.current?.focus(), 30)
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', alEsc)
      window.clearTimeout(foco)
      document.body.style.overflow = overflowPrevio
    }
  }, [abierto, onCerrar])

  if (!abierto) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCerrar}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          'animate-fade-up relative w-full rounded-2xl border border-white/10 bg-surface-800 shadow-2xl shadow-black/50 focus:outline-none',
          ancho,
        )}
      >
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-100">{titulo}</h3>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-md px-2 py-1 text-xs text-slate-500 transition hover:bg-white/6 hover:text-slate-300"
          >
            Cerrar
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  )
}

/* -------------------------------- Sparkline -------------------------------- */

export function Sparkline({
  datos,
  className,
  alto = 28,
}: {
  datos: number[]
  className?: string
  alto?: number
}) {
  if (!datos.length) return null
  const max = Math.max(...datos, 1)
  const puntos = datos
    .map((d, i) => {
      const x = (i / Math.max(datos.length - 1, 1)) * 100
      const y = alto - (d / max) * (alto - 4) - 2
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg
      viewBox={`0 0 100 ${alto}`}
      preserveAspectRatio="none"
      className={cn('w-full', className)}
      style={{ height: alto }}
    >
      <polyline
        points={puntos}
        fill="none"
        stroke="url(#spark)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <defs>
        <linearGradient id="spark" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7c4df5" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
    </svg>
  )
}

/* ------------------------------- Score ring -------------------------------- */

export function ScoreRing({
  valor,
  tamano = 64,
  grosor = 6,
  etiqueta,
}: {
  valor: number
  tamano?: number
  grosor?: number
  etiqueta?: string
}) {
  const r = (tamano - grosor) / 2
  const circunferencia = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, valor))
  return (
    <div className="relative shrink-0" style={{ width: tamano, height: tamano }}>
      <svg width={tamano} height={tamano} className="-rotate-90">
        <circle
          cx={tamano / 2}
          cy={tamano / 2}
          r={r}
          fill="none"
          stroke="rgba(148,163,184,0.15)"
          strokeWidth={grosor}
        />
        <circle
          cx={tamano / 2}
          cy={tamano / 2}
          r={r}
          fill="none"
          stroke="url(#ring)"
          strokeWidth={grosor}
          strokeLinecap="round"
          strokeDasharray={circunferencia}
          strokeDashoffset={circunferencia * (1 - v)}
          style={{ transition: 'stroke-dashoffset 700ms ease' }}
        />
        <defs>
          <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7c4df5" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center leading-none">
          <span className="text-sm font-bold text-slate-50">{Math.round(v * 100)}%</span>
          {etiqueta && (
            <span className="mt-0.5 block text-[9px] text-slate-500">{etiqueta}</span>
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------- Section title ------------------------------ */

export function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold tracking-tight text-slate-50">{title}</h2>
        {subtitle && (
          <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  )
}
