import { Link } from 'react-router-dom'
import {
  BadgeCheck,
  Briefcase,
  Clock,
  Plus,
  ShieldCheck,
  Target,
  TrendingUp,
  Trophy,
  UserPlus,
} from 'lucide-react'
import type { CandidatoRanking, OfertaPropia, PosicionLol } from '@proplay/shared'
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  EmptyState,
  EstadoError,
  SectionTitle,
  Stat,
} from '@/components/ui'
import { es } from '@/i18n/es'
import { MarcaDatosDemo } from '@/components/AvisoDatosDemo'
import { BarraAportes } from '@/components/BarraAportes'
import { DatosOrganizacion } from '@/components/DatosOrganizacion'
import { useAuth } from '@/context/AuthContext'
import { useIdentidad } from '@/api/identidad'
import { useRankingOferta, type FiltrosRanking } from '@/api/matching'
import { useMisOfertas, usePostulaciones, useVacantes } from '@/api/ofertas'
import { useEquipos, usePerfilPropio } from '@/api/perfiles'
import { calcularAportes } from '@/lib/aportes'
import { lugarOferta } from '@/lib/ubicacion'

const t = es.panelEquipo

const formatoFecha = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' })

const TONO_ESTADO_OFERTA = {
  BORRADOR: 'ambar',
  ABIERTA: 'verde',
  CUBIERTA: 'azul',
  CERRADA: 'neutro',
} as const satisfies Record<OfertaPropia['estado'], string>

const claseBoton =
  'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400'

/** Ofertas abiertas que caben en «Mejores candidatos» y candidatos de cada una. */
const MAX_OFERTAS_CON_CANDIDATOS = 3
const MEJORES_CANDIDATOS = 3

/** Primera página del ranking por puntaje: la misma consulta que abre la vista del ranking. */
const PRIMEROS_DEL_RANKING: FiltrosRanking = { page: 1, soloPostulados: false, orden: 'puntaje' }

// RF-13 · RF-07 · RF-09 · Panel del equipo. Reales: «Datos de la organización»,
// «Tus ofertas» (GET /api/v1/ofertas/me), con el acceso a publicar una oferta,
// y «Mejores candidatos» (los primeros del ranking de cada oferta abierta, del
// motor de matching). Los indicadores siguen simulados, con su marca, hasta la
// analítica. El scout no tiene ofertas propias: consulta los rankings desde el
// detalle de cada oferta.
export default function PanelEquipoPage() {
  const { usuario } = useAuth()
  const { data: ofertas = [] } = useVacantes()
  const { data: postulaciones = [] } = usePostulaciones()
  const { data: perfilesEquipo = [] } = useEquipos()
  const { data: identidad } = useIdentidad()

  // El scout consulta pero no contrata: sólo el equipo publica y gestiona.
  const esScout = usuario?.rol === 'SCOUT'
  const esEquipo = usuario?.rol === 'EQUIPO'
  // Nombre real de la organizacion para el subtitulo; solo el equipo tiene perfil.
  const { data: propio } = usePerfilPropio(esEquipo)
  const nombreOrg = propio?.tipo === 'EQUIPO' ? propio.perfil.nombreOrg : null

  // Datos de la simulación para los indicadores.
  const miEquipo = perfilesEquipo.find((e) => e.id === identidad?.perfilEquipoId)
  const misOfertas = miEquipo
    ? ofertas.filter((o) => o.equipoId === miEquipo.id)
    : ofertas
  const postulacionesDeMisOfertas = postulaciones.filter((p) =>
    misOfertas.some((o) => o.id === p.ofertaId),
  )

  return (
    <div className="space-y-6">
      <SectionTitle
        title={esScout ? t.tituloScout : t.titulo}
        subtitle={nombreOrg ?? (esScout ? t.subtituloScout : t.subtitulo)}
        action={
          esEquipo && (
            <Link
              to="/panel-equipo/ofertas/nueva"
              className={`${claseBoton} bg-gradient-to-r from-brand-600 to-accent-600 text-white shadow-lg shadow-brand-900/40 hover:from-brand-500 hover:to-accent-500`}
            >
              <Plus size={14} aria-hidden />
              {t.publicar}
            </Link>
          )
        }
      />

      {esScout && (
        <Card className="border-accent-500/25 bg-accent-500/5 p-4">
          <p className="flex items-start gap-2.5 text-xs leading-relaxed text-slate-300">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-accent-400" aria-hidden />
            <span>{t.notaScout}</span>
          </p>
          <Link
            to="/vacantes"
            className={`${claseBoton} mt-3 border border-white/12 bg-white/5 text-slate-200 hover:border-brand-500/50`}
          >
            {t.verOfertas}
          </Link>
        </Card>
      )}

      {esEquipo && <DatosOrganizacion />}

      {esEquipo && <MisOfertas />}

      <div>
        <MarcaDatosDemo />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label="Vacantes abiertas"
            value={misOfertas.filter((o) => o.estado === 'ABIERTA').length}
            icono={<Briefcase size={16} />}
            acento="violeta"
          />
          <Stat
            label="Postulaciones"
            value={postulacionesDeMisOfertas.length}
            icono={<UserPlus size={16} />}
            acento="cian"
          />
          <Stat
            label="En proceso"
            value={
              postulacionesDeMisOfertas.filter(
                (p) => p.estado === 'EN_REVISION' || p.estado === 'ENTREVISTA',
              ).length
            }
            icono={<Clock size={16} />}
            acento="ambar"
          />
          <Stat
            label="Coincidencias exitosas"
            value={
              postulacionesDeMisOfertas.filter((p) => p.estado === 'ACEPTADA').length
            }
            icono={<Target size={16} />}
            acento="verde"
          />
        </div>
      </div>

      {esEquipo && <MejoresCandidatos />}
    </div>
  )
}

// RF-07 · Ofertas del equipo, en cualquier estado, con sus postulaciones.
function MisOfertas() {
  const consulta = useMisOfertas()

  return (
    <Card>
      <CardHeader title={t.misOfertas} subtitle={t.misOfertasSubtitulo} icon={<Briefcase size={16} />} />
      <div className="p-5">
        {consulta.isPending ? (
          <div aria-busy="true" aria-label={t.cargando} className="space-y-3">
            <div className="skeleton h-20 rounded-xl" />
            <div className="skeleton h-20 rounded-xl" />
          </div>
        ) : consulta.isError ? (
          <EstadoError titulo={t.error} onReintentar={() => void consulta.refetch()} />
        ) : consulta.data.data.length === 0 ? (
          <EmptyState
            icono={<Briefcase size={22} />}
            titulo={t.vacio}
            descripcion={t.vacioDetalle}
            action={
              <Link
                to="/panel-equipo/ofertas/nueva"
                className={`${claseBoton} border border-white/12 bg-white/5 text-slate-200 hover:border-brand-500/50`}
              >
                <Plus size={14} aria-hidden />
                {t.publicar}
              </Link>
            }
          />
        ) : (
          <ul className="space-y-3">
            {consulta.data.data.map((oferta) => (
              <li
                key={oferta.id}
                className="flex flex-col gap-3 rounded-xl border border-white/8 bg-white/3 p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-medium break-words text-slate-100">{oferta.titulo}</h3>
                    <Badge tono={TONO_ESTADO_OFERTA[oferta.estado]}>{es.estadoOferta[oferta.estado]}</Badge>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {es.posicionLol[oferta.rol]} · {es.modalidad[oferta.modalidad]}
                    {oferta.modalidad !== 'REMOTA' && ` · ${lugarOferta(oferta)}`}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <UserPlus size={12} aria-hidden />
                      {t.postulaciones(oferta.totalPostulaciones)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock size={12} aria-hidden />
                      {t.creadaEl(formatoFecha.format(oferta.creadoEn))}
                    </span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    to={`/vacantes/${oferta.id}/ranking`}
                    aria-label={`${t.ranking}: ${oferta.titulo}`}
                    className={`${claseBoton} flex-1 justify-center border border-brand-500/40 bg-brand-500/10 text-brand-200 hover:bg-brand-500/20 sm:flex-none`}
                  >
                    <Trophy size={13} aria-hidden />
                    {t.ranking}
                  </Link>
                  <Link
                    to={`/vacantes/${oferta.id}`}
                    aria-label={`${t.gestionar}: ${oferta.titulo}`}
                    className={`${claseBoton} flex-1 justify-center border border-white/12 bg-white/5 text-slate-200 hover:border-brand-500/50 sm:flex-none`}
                  >
                    {t.gestionar}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}

// RF-09 · Los primeros del ranking de cada oferta abierta del equipo, con el
// aporte de cada dimensión a su puntaje. Datos reales del motor de matching
// (GET /api/v1/matching/ofertas/:id/ranking), los mismos que la vista del ranking.
function MejoresCandidatos() {
  const consulta = useMisOfertas()
  const abiertas = consulta.data?.data.filter((oferta) => oferta.estado === 'ABIERTA') ?? []
  const visibles = abiertas.slice(0, MAX_OFERTAS_CON_CANDIDATOS)

  return (
    <Card>
      <CardHeader title={t.candidatos} subtitle={t.candidatosSubtitulo} icon={<TrendingUp size={16} />} />
      <div className="p-5">
        {consulta.isPending ? (
          <div aria-busy="true" aria-label={t.cargandoCandidatos} className="space-y-3">
            <div className="skeleton h-40 rounded-xl" />
          </div>
        ) : consulta.isError ? (
          <EstadoError titulo={t.error} onReintentar={() => void consulta.refetch()} />
        ) : visibles.length === 0 ? (
          <EmptyState
            icono={<Briefcase size={22} />}
            titulo={t.sinAbiertas}
            descripcion={t.sinAbiertasDetalle}
            action={
              <Link
                to="/panel-equipo/ofertas/nueva"
                className={`${claseBoton} border border-white/12 bg-white/5 text-slate-200 hover:border-brand-500/50`}
              >
                <Plus size={14} aria-hidden />
                {t.publicar}
              </Link>
            }
          />
        ) : (
          <div className="space-y-5">
            {visibles.map((oferta) => (
              <MejoresDeOferta key={oferta.id} oferta={oferta} />
            ))}
            {abiertas.length > visibles.length && (
              <p className="text-[11px] text-slate-400">{t.masAbiertas(visibles.length)}</p>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

function MejoresDeOferta({ oferta }: { oferta: OfertaPropia }) {
  const ranking = useRankingOferta(oferta.id, PRIMEROS_DEL_RANKING)
  const idTitulo = `mejores-${oferta.id}`

  return (
    <section aria-labelledby={idTitulo}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 id={idTitulo} className="min-w-0 text-sm font-medium break-words text-slate-100">
          {oferta.titulo}{' '}
          <span className="font-normal text-slate-400">· {es.posicionLol[oferta.rol]}</span>
        </h4>
        <Link
          to={`/vacantes/${oferta.id}/ranking`}
          aria-label={t.verRankingDe(oferta.titulo)}
          className="text-xs font-medium text-brand-300 hover:text-brand-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
        >
          {t.verRanking}
        </Link>
      </div>

      {ranking.isPending ? (
        <div aria-busy="true" aria-label={t.cargandoCandidatos} className="mt-3 space-y-2">
          {Array.from({ length: MEJORES_CANDIDATOS }).map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-xl" />
          ))}
        </div>
      ) : ranking.isError ? (
        <EstadoError titulo={t.errorCandidatos} onReintentar={() => void ranking.refetch()} />
      ) : ranking.data.data.length === 0 ? (
        <p className="mt-3 rounded-xl border border-white/8 bg-white/3 px-4 py-3 text-xs text-slate-400">
          {t.sinCandidatos}
        </p>
      ) : (
        <ol className="mt-3 space-y-2">
          {ranking.data.data.slice(0, MEJORES_CANDIDATOS).map((candidato) => (
            <li key={candidato.jugador.id}>
              <CandidatoDestacado candidato={candidato} ofertaId={oferta.id} />
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function CandidatoDestacado({ candidato, ofertaId }: { candidato: CandidatoRanking; ofertaId: string }) {
  const { jugador } = candidato
  const desglose = calcularAportes(candidato)

  return (
    <article
      aria-label={`${es.ranking.puesto(candidato.puesto)}: ${jugador.nombre}`}
      className="grid gap-3 rounded-xl border border-white/8 bg-white/3 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] sm:items-center"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="w-5 shrink-0 text-center font-mono text-xs text-slate-400" aria-hidden>
          {candidato.puesto}
        </span>
        {jugador.avatarUrl ? (
          <img src={jugador.avatarUrl} alt="" className="size-9 shrink-0 rounded-full object-cover" />
        ) : (
          <Avatar nombre={jugador.nombre} size="sm" />
        )}
        <div className="min-w-0">
          <Link
            to={`/vacantes/${ofertaId}/ranking/${jugador.id}`}
            aria-label={es.ranking.verDetalleDe(jugador.nombre)}
            className="block truncate text-sm font-medium text-slate-100 hover:text-brand-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
          >
            {jugador.nombre}
          </Link>
          <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-slate-400">
            {jugador.verificacion ? (
              <>
                <BadgeCheck size={12} className="shrink-0 text-emerald-400" aria-hidden />
                <span className="truncate">
                  {jugador.posicion
                    ? (es.posicionLol[jugador.posicion as PosicionLol] ?? jugador.posicion)
                    : es.ranking.verificado}
                  {' · '}
                  {jugador.rango ? es.rangoLol[jugador.rango] : es.ranking.sinRango}
                </span>
              </>
            ) : (
              <Badge tono="ambar" className="!px-1.5 !py-0 !text-[10px]">
                {es.ranking.sinCuenta}
              </Badge>
            )}
          </p>
        </div>
      </div>
      <BarraAportes desglose={desglose} />
      <p className="text-right text-lg font-bold tabular-nums text-slate-50">
        <span className="sr-only">{es.ranking.compatibilidad}: </span>
        {es.ranking.porcentaje(desglose.total)}
      </p>
    </article>
  )
}

