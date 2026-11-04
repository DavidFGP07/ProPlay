import type { Postulacion } from '@proplay/shared'
import { es } from '@/i18n/es'
import { recorrido } from '@/lib/postulaciones'

const formatoFecha = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' })

// RF-10 · Pasos que ha recorrido una postulación, con la fecha de cada uno
// (la base del embudo de la vacante). Lo usan el jugador y el equipo.
export function RecorridoPostulacion({ postulacion }: { postulacion: Postulacion }) {
  return (
    <>
      <h4 className="sr-only">{es.misPostulaciones.pasos}</h4>
      <ol className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-slate-400">
        {recorrido(postulacion).map(({ estado, fecha }) => (
          <li key={estado} className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-brand-400" aria-hidden />
            <span className="text-slate-300">{es.estadoPostulacion[estado]}</span>
            <time dateTime={fecha.toISOString()}>{formatoFecha.format(fecha)}</time>
          </li>
        ))}
      </ol>
    </>
  )
}
