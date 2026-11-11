import type { DimensionMatching } from '@proplay/shared'
import { cn } from '@/components/ui'
import { es } from '@/i18n/es'
import type { Aporte, ClaveAporte, DesgloseAportes } from '@/lib/aportes'

const t = es.ranking

/**
 * Color de cada dimensión, con los tokens del tema. El color nunca es la única
 * pista: los segmentos van siempre en el orden de la ecuación (1), separados,
 * y cada uno se repite debajo con su nombre y sus puntos.
 */
export const COLOR_DIMENSION = {
  tecnica: 'bg-brand-500',
  experiencia: 'bg-brand-800',
  habilidadesBlandas: 'bg-accent-600',
  geografica: 'bg-accent-400',
  disponibilidad: 'bg-brand-200',
  otras: 'bg-surface-500',
} as const satisfies Record<ClaveAporte, string>

export function nombreAporte(clave: ClaveAporte): string {
  return clave === 'otras' ? t.otras : es.dimension[clave as DimensionMatching]
}

/** Muestra de color de una dimensión, para la leyenda y el texto del desglose. */
export function MuestraDimension({ clave }: { clave: ClaveAporte }) {
  return <span aria-hidden className={cn('inline-block size-2 shrink-0 rounded-sm', COLOR_DIMENSION[clave])} />
}

// RF-09 · Desglose del puntaje de un candidato: una barra de progreso apilada
// en la que cada segmento es el aporte de una dimensión (peso × valor). Los
// segmentos suman exactamente el puntaje y el hueco del final es lo que le
// falta para el 100 %. Es un componente de progreso hecho con HTML, como
// `Progress`, no una gráfica: la barra es decorativa (`aria-hidden`) y la lista
// de debajo es la alternativa en texto, la que leen los lectores de pantalla.
export function BarraAportes({
  desglose,
  compacta = false,
  className,
}: {
  desglose: DesgloseAportes
  /** Sin la lista de texto visible (se conserva para lectores de pantalla). */
  compacta?: boolean
  className?: string
}) {
  const conPuntos = desglose.aportes.filter((a) => a.puntos > 0)

  return (
    <div className={className}>
      <div
        aria-hidden
        data-testid="barra-aportes"
        className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-white/8"
      >
        {conPuntos.map((a) => (
          <span
            key={a.clave}
            data-dimension={a.clave}
            className={cn('h-full first:rounded-l-full', COLOR_DIMENSION[a.clave])}
            style={{ width: `${a.puntos}%` }}
          />
        ))}
      </div>
      <ul
        aria-label={t.desglose}
        className={cn(
          compacta ? 'sr-only' : 'mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-300',
        )}
      >
        {/* Una dimensión con peso 0 en la oferta no puede aportar: no se lista. */}
        {desglose.aportes
          .filter((a) => a.peso !== 0)
          .map((a) => (
            <ItemAporte key={a.clave} aporte={a} />
          ))}
      </ul>
    </div>
  )
}

function ItemAporte({ aporte }: { aporte: Aporte }) {
  return (
    <li className="inline-flex items-center gap-1.5">
      <MuestraDimension clave={aporte.clave} />
      <span>
        {nombreAporte(aporte.clave)}{' '}
        <span className="font-mono text-slate-100">{aporte.puntos}</span>
        <span className="sr-only"> {t.unidadPuntos(aporte.puntos)}</span>
      </span>
    </li>
  )
}
