import { useEffect, useRef, type ReactNode } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import axios from 'axios'
import { ArrowLeft, BadgeCheck, ChevronLeft, ChevronRight, CircleAlert, Sigma, User, UserSearch } from 'lucide-react'
import type { CandidatoOferta, CandidatoRanking, DimensionMatching, PosicionLol } from '@proplay/shared'
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  EmptyState,
  EstadoError,
  EstadoSinPermiso,
  cn,
} from '@/components/ui'
import { AccionesPostulacion } from '@/components/AccionesPostulacion'
import { BarraAportes, COLOR_DIMENSION, MuestraDimension, nombreAporte } from '@/components/BarraAportes'
import { useAuth } from '@/context/AuthContext'
import { useCandidatoOferta } from '@/api/matching'
import { es } from '@/i18n/es'
import { aPorcentaje, calcularAportes, type DesgloseAportes } from '@/lib/aportes'
import { explicarDimension, faltanDatosEn } from '@/lib/explicacion'
import { DIMENSIONES_VISIBLES } from '@/lib/pesos'
import { TONO_ESTADO_POSTULACION } from '@/lib/postulaciones'
import { lugar } from '@/lib/ubicacion'

const t = es.candidato

const claseEnlace =
  'inline-flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400'

const claseVecino =
  'card card-hover flex min-w-0 flex-1 items-center gap-2 p-3 text-xs text-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400'

// RF-09 · RF-11 · Detalle del candidato: por qué tiene el puntaje que tiene en
// esta oferta. Datos reales de GET /api/v1/matching/ofertas/:id/candidatos/:jugadorId.
// Por dimensión muestra el valor, el peso, el aporte y una explicación
// determinista construida con los motivos y las cifras que guardó el motor
// (`lib/explicacion.ts`); no interviene ningún modelo de lenguaje.
export default function CandidatoDetallePage() {
  const { id, jugadorId } = useParams<{ id: string; jugadorId: string }>()
  // El filtro y el orden del ranking viajan en la URL para volver a la misma lista.
  const { search } = useLocation()
  const consulta = useCandidatoOferta(id, jugadorId)

  return (
    <div className="space-y-6">
      <Link to={{ pathname: `/vacantes/${id}/ranking`, search }} className={claseEnlace}>
        <ArrowLeft size={14} aria-hidden />
        {t.volver}
      </Link>

      {consulta.isPending ? (
        <div aria-busy="true" aria-label={t.cargando} className="space-y-4">
          <div className="skeleton h-40 rounded-2xl" />
          <div className="skeleton h-44 rounded-2xl" />
          <div className="skeleton h-56 rounded-2xl" />
        </div>
      ) : consulta.isError ? (
        <Card>
          <ErrorCandidato error={consulta.error} onReintentar={() => void consulta.refetch()} />
        </Card>
      ) : (
        <Detalle detalle={consulta.data} busqueda={search} />
      )}
    </div>
  )
}

function ErrorCandidato({ error, onReintentar }: { error: unknown; onReintentar: () => void }) {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined
  if (status === 403) return <EstadoSinPermiso descripcion={es.ranking.sinPermiso} />
  if (status === 404) {
    return (
      <EmptyState icono={<UserSearch size={22} />} titulo={t.noEncontrado} descripcion={t.noEncontradoDetalle} />
    )
  }
  return <EstadoError titulo={t.error} onReintentar={onReintentar} />
}

function Detalle({ detalle, busqueda }: { detalle: CandidatoOferta; busqueda: string }) {
  const { usuario } = useAuth()
  const { candidato, oferta } = detalle
  const { jugador, postulacion } = candidato
  const desglose = calcularAportes(candidato)
  // Sólo el equipo dueño (el único EQUIPO al que la API sirve el ranking) y con la oferta abierta.
  const gestiona = usuario?.rol === 'EQUIPO' && oferta.estado === 'ABIERTA'
  // Al pasar de un candidato a otro la página no se recarga: se vuelve arriba y
  // el foco va al nombre, para que el lector de pantalla anuncie al nuevo.
  const titulo = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    document.documentElement.scrollTop = 0
    titulo.current?.focus({ preventScroll: true })
  }, [jugador.id])
  const rutaVecino = (jugadorId: string) => ({
    pathname: `/vacantes/${oferta.id}/ranking/${jugadorId}`,
    search: busqueda,
  })

  return (
    <>
      {/* ---------------------------- Cabecera ---------------------------- */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            {jugador.avatarUrl ? (
              <img src={jugador.avatarUrl} alt="" className="size-14 shrink-0 rounded-full object-cover" />
            ) : (
              <Avatar nombre={jugador.nombre} size="lg" />
            )}
            <div className="min-w-0">
              <p className="text-[11px] tracking-wide text-slate-400 uppercase">
                {t.puestoDe(candidato.puesto, detalle.total)}
              </p>
              <h1
                ref={titulo}
                tabIndex={-1}
                className="mt-0.5 text-xl font-bold tracking-tight break-words text-slate-50 outline-none"
              >
                {jugador.nombre}
              </h1>
              <p className="mt-1 text-xs break-words text-slate-400">{t.paraOferta(oferta.titulo)}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {jugador.verificacion ? (
                  <>
                    <Badge tono="verde">
                      <BadgeCheck size={11} aria-hidden />
                      {es.ranking.verificado}
                    </Badge>
                    {jugador.posicion && (
                      <Badge tono="cian">
                        {es.posicionLol[jugador.posicion as PosicionLol] ?? jugador.posicion}
                      </Badge>
                    )}
                    <Badge tono="violeta">
                      {jugador.rango ? es.rangoLol[jugador.rango] : es.ranking.sinRango}
                    </Badge>
                  </>
                ) : (
                  <Badge tono="ambar">{es.ranking.sinCuenta}</Badge>
                )}
                {jugador.pais && <Badge>{lugar(jugador.pais, jugador.departamento)}</Badge>}
              </div>
              <Link
                to={`/jugador/${jugador.id}`}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-brand-300 hover:text-brand-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
              >
                <User size={13} aria-hidden />
                {t.verPerfil}
              </Link>
            </div>
          </div>

          <div className="w-full shrink-0 lg:w-80">
            <p className="flex items-baseline justify-between gap-3">
              <span className="text-xs text-slate-400">{es.ranking.compatibilidad}</span>
              <span className="text-3xl font-bold tabular-nums text-slate-50">
                {es.ranking.porcentaje(desglose.total)}
              </span>
            </p>
            <BarraAportes desglose={desglose} className="mt-2" />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/6 pt-4">
          <h2 className="text-xs text-slate-400">{t.postulacion}:</h2>
          {postulacion ? (
            <Badge tono={TONO_ESTADO_POSTULACION[postulacion.estado]}>
              {es.estadoPostulacion[postulacion.estado]}
            </Badge>
          ) : (
            <span className="text-xs text-slate-300">{es.ranking.noPostulado}</span>
          )}
          {gestiona && postulacion && (
            <span className="ml-auto flex flex-wrap gap-2">
              <AccionesPostulacion postulacion={postulacion} nombre={jugador.nombre} />
            </span>
          )}
        </div>
      </Card>

      <TablaAportes desglose={desglose} candidato={candidato} />

      <ExplicacionCandidato candidato={candidato} />

      {/* ------------------- Candidato anterior y siguiente ------------------- */}
      {(detalle.anterior || detalle.siguiente) && (
        <nav aria-label={t.navegacion} className="flex flex-col gap-3 sm:flex-row">
          {detalle.anterior ? (
            <Link to={rutaVecino(detalle.anterior.id)} className={claseVecino}>
              <ChevronLeft size={16} className="shrink-0 text-slate-400" aria-hidden />
              <span className="min-w-0">
                <span className="block text-[11px] text-slate-400">{t.etiquetaAnterior}</span>
                <span className="block truncate font-medium">
                  {t.anterior(candidato.puesto - 1, detalle.anterior.nombre)}
                </span>
              </span>
            </Link>
          ) : (
            <span className="hidden flex-1 sm:block" />
          )}
          {detalle.siguiente ? (
            <Link to={rutaVecino(detalle.siguiente.id)} className={cn(claseVecino, 'justify-between sm:justify-end sm:text-right')}>
              <span className="min-w-0 sm:order-1">
                <span className="block text-[11px] text-slate-400">{t.etiquetaSiguiente}</span>
                <span className="block truncate font-medium">
                  {t.siguiente(candidato.puesto + 1, detalle.siguiente.nombre)}
                </span>
              </span>
              <ChevronRight size={16} className="order-last shrink-0 text-slate-400 sm:order-2" aria-hidden />
            </Link>
          ) : (
            <span className="hidden flex-1 sm:block" />
          )}
        </nav>
      )}
    </>
  )
}

/** Valor, peso y aporte de cada dimensión: la versión en tabla de la barra. */
function TablaAportes({
  desglose,
  candidato,
}: {
  desglose: DesgloseAportes
  candidato: CandidatoRanking
}) {
  const celda = 'px-3 py-2.5 text-right font-mono'
  return (
    <Card>
      <CardHeader title={t.tablaTitulo} subtitle={t.tablaSubtitulo} icon={<Sigma size={16} />} />
      <div className="p-5">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/8 text-[11px] text-slate-400">
              <th scope="col" className="px-3 py-2 text-left font-medium">
                {t.dimension}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                {t.valor}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                {t.peso}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                {t.aporte}
              </th>
            </tr>
          </thead>
          <tbody>
            {desglose.aportes.map((a) => (
              <tr key={a.clave} className="border-b border-white/6 text-slate-200">
                <th scope="row" className="px-3 py-2.5 text-left font-normal">
                  <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
                    <MuestraDimension clave={a.clave} />
                    {nombreAporte(a.clave)}
                    {a.clave !== 'otras' && faltanDatosEn(candidato, a.clave) && (
                      <Badge tono="ambar" className="!px-1.5 !py-0 !text-[10px]">
                        {es.explicacion.faltanDatos}
                      </Badge>
                    )}
                  </span>
                </th>
                <td className={celda}>{a.valor === null ? '—' : `${aPorcentaje(a.valor)} %`}</td>
                <td className={celda}>{a.peso === null ? '—' : `${aPorcentaje(a.peso)} %`}</td>
                <td className={cn(celda, 'text-slate-50')}>{a.puntos}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="text-slate-50">
              <th scope="row" colSpan={3} className="px-3 py-2.5 text-left font-semibold">
                {t.total}
              </th>
              <td className={cn(celda, 'font-bold')}>{es.ranking.porcentaje(desglose.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  )
}

/**
 * Por qué vale cada dimensión lo que vale (RF-11). `explicacionGenerada` es el
 * hueco para la explicación en lenguaje natural del Sprint 4: cuando exista el
 * endpoint, la página se la pasará y aparecerá sobre el detalle por dimensión,
 * que es su base. Hoy nadie la pasa y no se muestra nada.
 */
export function ExplicacionCandidato({
  candidato,
  explicacionGenerada,
}: {
  candidato: CandidatoRanking
  explicacionGenerada?: ReactNode
}) {
  return (
    <Card>
      <CardHeader title={t.explicacionTitulo} subtitle={t.explicacionSubtitulo} icon={<UserSearch size={16} />} />
      <div className="space-y-4 p-5">
        {explicacionGenerada}
        {DIMENSIONES_VISIBLES.map((dimension) => (
          <ExplicacionDeDimension key={dimension} candidato={candidato} dimension={dimension} />
        ))}
      </div>
    </Card>
  )
}

function ExplicacionDeDimension({
  candidato,
  dimension,
}: {
  candidato: CandidatoRanking
  dimension: DimensionMatching
}) {
  const explicacion = explicarDimension(candidato, dimension)
  const valor = candidato.desglose[dimension]
  const faltan = faltanDatosEn(candidato, dimension)
  const te = es.explicacion.tecnica

  return (
    <section
      aria-labelledby={`dimension-${dimension}`}
      className="rounded-xl border border-white/8 bg-white/3 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3
          id={`dimension-${dimension}`}
          className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-100"
        >
          <MuestraDimension clave={dimension} />
          {es.dimension[dimension]}
          {faltan && (
            <Badge tono="ambar">
              <CircleAlert size={11} aria-hidden />
              {es.explicacion.faltanDatos}
            </Badge>
          )}
        </h3>
        <p className="font-mono text-xs text-slate-200">{t.valorDe(aPorcentaje(valor))}</p>
      </div>
      <div aria-hidden className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/8">
        <div
          className={cn('h-full rounded-full', COLOR_DIMENSION[dimension])}
          style={{ width: `${aPorcentaje(valor)}%` }}
        />
      </div>

      <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-slate-300">
        {explicacion.frases.map((frase) => (
          <li key={frase}>{frase}</li>
        ))}
      </ul>

      {explicacion.formula && (
        <p className="mt-3 rounded-lg bg-surface-900/60 px-3 py-2 font-mono text-[11px] leading-relaxed break-words text-slate-300">
          {explicacion.formula}
        </p>
      )}

      {explicacion.metricas && explicacion.metricas.length > 0 && (
        <table className="mt-3 w-full text-xs">
          <caption className="pb-1.5 text-left text-[11px] tracking-wide text-slate-400 uppercase">
            {te.metricasTitulo}
          </caption>
          <thead>
            <tr className="border-b border-white/8 text-[11px] text-slate-400">
              <th scope="col" className="py-1.5 pr-2 text-left font-medium">
                {te.metrica}
              </th>
              <th scope="col" className="px-2 py-1.5 text-right font-medium">
                {te.valorMetrica}
              </th>
              <th scope="col" className="py-1.5 pl-2 text-right font-medium">
                {te.normalizado}
              </th>
            </tr>
          </thead>
          <tbody>
            {explicacion.metricas.map((m) => (
              <tr key={m.metrica} className="border-b border-white/6 text-slate-200">
                <th scope="row" className="py-1.5 pr-2 text-left font-normal">
                  {m.nombre}
                </th>
                <td className="px-2 py-1.5 text-right font-mono">{m.valor}</td>
                <td className="py-1.5 pl-2 text-right font-mono">{m.normalizado} %</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {explicacion.muestra && <p className="mt-2 text-[11px] text-slate-400">{explicacion.muestra}</p>}
    </section>
  )
}
