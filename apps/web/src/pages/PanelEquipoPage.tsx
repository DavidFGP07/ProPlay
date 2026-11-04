import { Link } from 'react-router-dom'
import {
  Briefcase,
  Clock,
  Plus,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  UserPlus,
} from 'lucide-react'
import type { OfertaPropia } from '@proplay/shared'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  EstadoError,
  ScoreRing,
  SectionTitle,
  Stat,
} from '@/components/ui'
import { es } from '@/i18n/es'
import { MarcaDatosDemo } from '@/components/AvisoDatosDemo'
import { DatosOrganizacion } from '@/components/DatosOrganizacion'
import { useAuth } from '@/context/AuthContext'
import { useIdentidad } from '@/api/identidad'
import { useCandidatos, useJugadores } from '@/api/matching'
import { useMisOfertas, usePostulaciones, useVacantes } from '@/api/ofertas'
import { useEquipos, usePerfilPropio } from '@/api/perfiles'
import { PESOS_POR_DEFECTO } from '@/lib/matching'
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

// RF-13 · RF-07 · Panel del equipo. Reales: «Datos de la organización» y «Tus
// ofertas» (GET /api/v1/ofertas/me), con el acceso a publicar una oferta. Los
// indicadores y las recomendaciones del motor siguen simulados, cada sección
// con su marca, hasta la analítica y el motor de matching.
export default function PanelEquipoPage() {
  const { usuario } = useAuth()
  const { data: ofertas = [] } = useVacantes()
  const { data: postulaciones = [] } = usePostulaciones()
  const { data: jugadores = [] } = useJugadores()
  const { data: perfilesEquipo = [] } = useEquipos()
  const { data: identidad } = useIdentidad()

  // El scout consulta pero no contrata: sólo el equipo publica y gestiona.
  const esScout = usuario?.rol === 'SCOUT'
  const esEquipo = usuario?.rol === 'EQUIPO'
  // Nombre real de la organizacion para el subtitulo; solo el equipo tiene perfil.
  const { data: propio } = usePerfilPropio(esEquipo)
  const nombreOrg = propio?.tipo === 'EQUIPO' ? propio.perfil.nombreOrg : null

  // Datos de la simulación para los indicadores y las recomendaciones.
  const miEquipo = perfilesEquipo.find((e) => e.id === identidad?.perfilEquipoId)
  const misOfertas = miEquipo
    ? ofertas.filter((o) => o.equipoId === miEquipo.id)
    : ofertas
  const postulacionesDeMisOfertas = postulaciones.filter((p) =>
    misOfertas.some((o) => o.id === p.ofertaId),
  )
  const abiertaPrincipal = misOfertas.find((o) => o.estado === 'ABIERTA')
  const ranking = useCandidatos(abiertaPrincipal?.id, PESOS_POR_DEFECTO)
  const resultadosRanking = abiertaPrincipal ? ranking.data?.resultados : []
  const trazaRanking = abiertaPrincipal ? ranking.data?.traza : null
  const jugadorDe = (id: string) => jugadores.find((j) => j.id === id)

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

      {/* --------------------------- Recomendado --------------------------- */}
      <Card>
        <CardHeader
          title="Recomendaciones del motor para tus vacantes"
          subtitle="Los candidatos mejor posicionados por el algoritmo hibrido, con su desglose por dimension."
          icon={<TrendingUp size={16} />}
          action={
            <Link to={`/vacantes/${abiertaPrincipal?.id ?? ''}`}>
              <Button variante="fantasma" tamano="sm">
                <Sparkles size={13} />
                Ranking completo
              </Button>
            </Link>
          }
        />
        <MarcaDatosDemo className="mx-5 mt-4" />
        {!abiertaPrincipal ? (
          <EmptyState
            icono={<Briefcase size={22} />}
            titulo="Sin vacantes abiertas"
            descripcion="Publica una oportunidad para que el motor calcule el ranking de candidatos."
          />
        ) : (
          <div className="p-5">
            <p className="mb-3 text-[11px] text-slate-500">
              Para <span className="text-slate-300">{abiertaPrincipal.rol} · {abiertaPrincipal.juego}</span> ·
              modo {trazaRanking?.modo === 'hibrido' ? 'hibrido' : 'contenido puro'}
            </p>
            <ul className="space-y-2">
              {(resultadosRanking ?? []).slice(0, 5).map((r, i) => {
                const jugador = jugadorDe(r.perfilId)
                const tecnica = r.desglose.find((d) => d.key === 'tecnica')
                return (
                  <li key={r.perfilId}>
                    <Link
                      to={`/jugador/${r.perfilId}`}
                      className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/3 p-3 transition hover:border-brand-500/40 hover:bg-white/6"
                    >
                      <span className="w-5 shrink-0 text-center font-mono text-xs text-slate-500">
                        {i + 1}
                      </span>
                      {jugador && <Avatar nombre={jugador.nombre} size="sm" />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-100">
                          {jugador?.nombre ?? r.perfilId}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-slate-500">
                          {jugador?.region} · {jugador?.rolesPreferidos[0]}
                          {tecnica && ` · tecnica ${Math.round(tecnica.valor * 100)}%`}
                        </p>
                      </div>
                      {r.modo === 'hibrido' && (
                        <Badge tono="cian" className="!py-0 !text-[10px]">
                          Hibrido
                        </Badge>
                      )}
                      <ScoreRing valor={r.puntaje} tamano={44} grosor={4} />
                    </Link>
                  </li>
                )
              })}
              {(resultadosRanking ?? []).length === 0 && (
                <li className="py-6 text-center text-xs text-slate-500">
                  El motor aun no tiene candidatos que recuperar para esta vacante.
                </li>
              )}
            </ul>
          </div>
        )}
      </Card>

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
                <Link
                  to={`/vacantes/${oferta.id}`}
                  aria-label={`${t.gestionar}: ${oferta.titulo}`}
                  className={`${claseBoton} justify-center border border-white/12 bg-white/5 text-slate-200 hover:border-brand-500/50`}
                >
                  {t.gestionar}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}
