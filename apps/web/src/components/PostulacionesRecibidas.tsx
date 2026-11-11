import { Link } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import type { Oferta, PostulacionRecibida } from '@proplay/shared'
import { Avatar, Badge, Card, CardHeader, EmptyState, EstadoError } from '@/components/ui'
import { AccionesPostulacion } from '@/components/AccionesPostulacion'
import { RecorridoPostulacion } from '@/components/RecorridoPostulacion'
import { usePostulacionesRecibidas } from '@/api/ofertas'
import { es } from '@/i18n/es'
import { TONO_ESTADO_POSTULACION } from '@/lib/postulaciones'
import { lugar } from '@/lib/ubicacion'

const t = es.postulacionesRecibidas

// RF-10 · Postulaciones recibidas, dentro del detalle de la oferta (sin vista
// propia, decisión 0.10). API real: GET /api/v1/ofertas/:id/postulaciones y
// PATCH /api/v1/ofertas/postulaciones/:id. El equipo dueño cambia los estados
// según TRANSICIONES_POSTULACION; el scout y el administrador sólo leen.
export function PostulacionesRecibidas({
  oferta,
  gestiona,
}: {
  oferta: Oferta
  gestiona: boolean
}) {
  const consulta = usePostulacionesRecibidas(oferta.id)
  const abierta = oferta.estado === 'ABIERTA'

  return (
    <Card>
      <CardHeader
        title={t.titulo}
        subtitle={gestiona ? (abierta ? t.subtitulo : t.congelada) : t.soloLectura}
        icon={<UserPlus size={16} />}
      />
      <div className="p-5">
        {consulta.isPending ? (
          <div aria-busy="true" aria-label={t.cargando} className="space-y-3">
            <div className="skeleton h-28 rounded-xl" />
            <div className="skeleton h-28 rounded-xl" />
          </div>
        ) : consulta.isError ? (
          <EstadoError titulo={t.error} onReintentar={() => void consulta.refetch()} />
        ) : consulta.data.length === 0 ? (
          <EmptyState icono={<UserPlus size={22} />} titulo={t.vacio} descripcion={t.vacioDetalle} />
        ) : (
          <ul className="space-y-3">
            {consulta.data.map((postulacion) => (
              <li key={postulacion.id}>
                <Postulacion postulacion={postulacion} acciones={gestiona && abierta} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}

function Postulacion({
  postulacion,
  acciones,
}: {
  postulacion: PostulacionRecibida
  acciones: boolean
}) {
  const { jugador } = postulacion

  return (
    <article className="rounded-xl border border-white/8 bg-white/3 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {jugador.avatarUrl ? (
            <img src={jugador.avatarUrl} alt="" className="size-10 shrink-0 rounded-full object-cover" />
          ) : (
            <Avatar nombre={jugador.nombre} size="md" />
          )}
          <div className="min-w-0">
            <h3 className="truncate text-sm font-medium text-slate-100">{jugador.nombre}</h3>
            <p className="truncate text-[11px] text-slate-400">
              {jugador.pais ? lugar(jugador.pais, jugador.departamento) : es.perfilPublico.sinUbicacion}
            </p>
          </div>
        </div>
        <Badge tono={TONO_ESTADO_POSTULACION[postulacion.estado]}>
          {es.estadoPostulacion[postulacion.estado]}
        </Badge>
      </div>

      <p className="mt-3 text-xs leading-relaxed whitespace-pre-line text-slate-300">
        {postulacion.mensaje ?? t.sinMensaje}
      </p>

      <RecorridoPostulacion postulacion={postulacion} />

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/6 pt-3">
        <Link
          to={`/jugador/${jugador.id}`}
          className="mr-auto text-[11px] font-medium text-brand-300 hover:text-brand-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
        >
          {t.verPerfil}
        </Link>
        {acciones && <AccionesPostulacion postulacion={postulacion} nombre={jugador.nombre} />}
      </div>
    </article>
  )
}
