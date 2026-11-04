import { Link } from 'react-router-dom'
import { Briefcase } from 'lucide-react'
import { Badge, EmptyState, EstadoError } from '@/components/ui'
import { useMisPostulaciones } from '@/api/ofertas'
import { es } from '@/i18n/es'
import { TONO_ESTADO_POSTULACION } from '@/lib/postulaciones'
import { RecorridoPostulacion } from '@/components/RecorridoPostulacion'

const t = es.misPostulaciones

const claseEnlace =
  'inline-flex items-center rounded-lg border border-white/12 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-brand-500/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400'

// RF-10 · Mis postulaciones: pestaña de Mi perfil con datos reales de
// GET /api/v1/ofertas/postulaciones/me. Muestra el estado de cada proceso y la
// fecha de cada paso.
export function MisPostulaciones() {
  const consulta = useMisPostulaciones()

  if (consulta.isPending) {
    return (
      <div aria-busy="true" aria-label={t.cargando} className="space-y-3">
        <div className="skeleton h-28 rounded-xl" />
        <div className="skeleton h-28 rounded-xl" />
      </div>
    )
  }

  if (consulta.isError) {
    return <EstadoError titulo={t.error} onReintentar={() => void consulta.refetch()} />
  }

  if (consulta.data.length === 0) {
    return (
      <EmptyState
        icono={<Briefcase size={22} />}
        titulo={t.vacio}
        descripcion={t.vacioDetalle}
        action={
          <Link to="/vacantes" className={claseEnlace}>
            {t.explorar}
          </Link>
        }
      />
    )
  }

  return (
    <ul className="space-y-4">
      {consulta.data.map((postulacion) => (
        <li key={postulacion.id} className="rounded-xl border border-white/8 bg-white/3 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h3 className="text-sm font-medium break-words text-slate-100">
                {postulacion.oferta.titulo}
              </h3>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {postulacion.oferta.equipo.nombreOrg} · {es.posicionLol[postulacion.oferta.rol]} ·{' '}
                {es.modalidad[postulacion.oferta.modalidad]}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge tono={TONO_ESTADO_POSTULACION[postulacion.estado]}>
                {es.estadoPostulacion[postulacion.estado]}
              </Badge>
              {postulacion.oferta.estado !== 'ABIERTA' && (
                <Badge>{t.ofertaCerrada(es.estadoOferta[postulacion.oferta.estado])}</Badge>
              )}
            </div>
          </div>

          <RecorridoPostulacion postulacion={postulacion} />

          <Link
            to={`/vacantes/${postulacion.oferta.id}`}
            className="mt-3 inline-flex text-[11px] font-medium text-brand-300 hover:text-brand-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
          >
            {t.verOferta}
          </Link>
        </li>
      ))}
    </ul>
  )
}
