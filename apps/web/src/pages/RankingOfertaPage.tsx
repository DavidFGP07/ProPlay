import { Link, useParams, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { ArrowLeft, BadgeCheck, Briefcase, CircleAlert, RefreshCw, Trophy, Users } from 'lucide-react'
import {
  ORDENES_RANKING,
  type CandidatoRanking,
  type OrdenRanking,
  type PosicionLol,
  type RankingOferta,
} from '@proplay/shared'
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  EstadoError,
  EstadoSinPermiso,
  Field,
  Paginacion,
  SectionTitle,
  Select,
  cn,
} from '@/components/ui'
import { AccionesPostulacion } from '@/components/AccionesPostulacion'
import { BarraAportes, MuestraDimension } from '@/components/BarraAportes'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useRankingOferta, useRecalcularRanking, type FiltrosRanking } from '@/api/matching'
import { es } from '@/i18n/es'
import { aPorcentaje, calcularAportes } from '@/lib/aportes'
import { datosQueFaltan } from '@/lib/explicacion'
import { DIMENSIONES_VISIBLES } from '@/lib/pesos'
import { TONO_ESTADO_POSTULACION } from '@/lib/postulaciones'

const t = es.ranking

const formatoFechaHora = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' })

const claseEnlace =
  'inline-flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400'

const claseEnlaceFuerte =
  'text-xs font-medium text-brand-300 hover:text-brand-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400'

/** Órdenes que ofrece la vista: el puntaje y las dimensiones con datos en el piloto. */
const ORDENES_VISIBLES: readonly OrdenRanking[] = ORDENES_RANKING.filter(
  (orden) => orden === 'puntaje' || DIMENSIONES_VISIBLES.includes(orden),
)

/** El filtro, el orden y la página viven en la URL: el enlace se puede compartir. */
function useFiltrosRanking(): [FiltrosRanking, (cambio: Partial<FiltrosRanking>) => void] {
  const [parametros, setParametros] = useSearchParams()
  const ordenPedido = parametros.get('orden') as OrdenRanking | null
  const pagina = Number(parametros.get('page'))
  const filtros: FiltrosRanking = {
    page: Number.isInteger(pagina) && pagina > 0 ? pagina : 1,
    soloPostulados: parametros.get('postulados') === '1',
    orden: ordenPedido && ORDENES_VISIBLES.includes(ordenPedido) ? ordenPedido : 'puntaje',
  }
  const cambiar = (cambio: Partial<FiltrosRanking>) => {
    // Cambiar el filtro o el orden vuelve a la primera página.
    const nuevos = { ...filtros, page: 1, ...cambio }
    const siguiente = new URLSearchParams()
    if (nuevos.soloPostulados) siguiente.set('postulados', '1')
    if (nuevos.orden !== 'puntaje') siguiente.set('orden', nuevos.orden)
    if (nuevos.page > 1) siguiente.set('page', String(nuevos.page))
    setParametros(siguiente, { replace: true })
  }
  return [filtros, cambiar]
}

// RF-09 · Ranking de candidatos de una oferta con el desglose por dimensión:
// datos reales de GET /api/v1/matching/ofertas/:id/ranking. Lo ven el equipo
// dueño (que además cambia el estado de las postulaciones), el scout y el
// administrador. Cada candidato muestra de dónde sale su puntaje: una barra
// con el aporte de cada dimensión (peso × valor), que suma el total.
export default function RankingOfertaPage() {
  const { id } = useParams<{ id: string }>()
  const [filtros, cambiar] = useFiltrosRanking()
  const consulta = useRankingOferta(id, filtros)

  return (
    <div className="space-y-6">
      <Link to={`/vacantes/${id}`} className={claseEnlace}>
        <ArrowLeft size={14} aria-hidden />
        {t.volver}
      </Link>

      {consulta.isPending ? (
        <div aria-busy="true" aria-label={t.cargando} className="space-y-4">
          <div className="skeleton h-10 w-72 max-w-full rounded-xl" />
          <div className="skeleton h-28 rounded-2xl" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-28 rounded-2xl" />
          ))}
        </div>
      ) : consulta.isError ? (
        <Card>
          <ErrorRanking error={consulta.error} onReintentar={() => void consulta.refetch()} />
        </Card>
      ) : (
        <Ranking ranking={consulta.data} filtros={filtros} cambiar={cambiar} />
      )}
    </div>
  )
}

function ErrorRanking({ error, onReintentar }: { error: unknown; onReintentar: () => void }) {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined
  if (status === 403) return <EstadoSinPermiso descripcion={t.sinPermiso} />
  if (status === 404) {
    return (
      <EmptyState icono={<Briefcase size={22} />} titulo={t.noEncontrada} descripcion={t.noEncontradaDetalle} />
    )
  }
  return <EstadoError titulo={t.error} onReintentar={onReintentar} />
}

function Ranking({
  ranking,
  filtros,
  cambiar,
}: {
  ranking: RankingOferta
  filtros: FiltrosRanking
  cambiar: (cambio: Partial<FiltrosRanking>) => void
}) {
  const { usuario } = useAuth()
  const { oferta } = ranking
  // La API sólo sirve el ranking al equipo que publicó la oferta: si el rol es
  // EQUIPO, es el dueño. El scout y el administrador sólo leen.
  const gestiona = usuario?.rol === 'EQUIPO' && oferta.estado === 'ABIERTA'
  const busqueda = new URLSearchParams()
  if (filtros.soloPostulados) busqueda.set('postulados', '1')
  if (filtros.orden !== 'puntaje') busqueda.set('orden', filtros.orden)
  if (filtros.page > 1) busqueda.set('page', String(filtros.page))

  return (
    <>
      <SectionTitle
        title={t.titulo}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="break-words text-slate-300">{oferta.titulo}</span>
            <Badge tono="cian">{es.posicionLol[oferta.rol]}</Badge>
            <Badge>{es.estadoOferta[oferta.estado]}</Badge>
          </span>
        }
      />

      <EstadoCalculo ranking={ranking} filtros={filtros} />

      <Card className="p-4">
        <fieldset>
          <legend className="sr-only">{t.filtros}</legend>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div role="group" aria-label={t.mostrar} className="flex flex-wrap gap-2">
              {[false, true].map((soloPostulados) => (
                <Button
                  key={String(soloPostulados)}
                  tamano="sm"
                  variante={filtros.soloPostulados === soloPostulados ? 'primario' : 'secundario'}
                  aria-pressed={filtros.soloPostulados === soloPostulados}
                  onClick={() => cambiar({ soloPostulados })}
                >
                  {soloPostulados ? t.soloPostulados : t.todos}
                </Button>
              ))}
            </div>
            <div className="w-full sm:w-56">
              <Field label={t.ordenar}>
                <Select
                  value={filtros.orden}
                  onChange={(e) => cambiar({ orden: e.target.value as OrdenRanking })}
                >
                  {ORDENES_VISIBLES.map((orden) => (
                    <option key={orden} value={orden}>
                      {orden === 'puntaje' ? t.ordenPuntaje : es.dimension[orden]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>
        </fieldset>
      </Card>

      {ranking.data.length === 0 ? (
        <Card>
          <EmptyState
            icono={<Users size={22} />}
            titulo={filtros.soloPostulados ? t.vacioPostulados : t.vacio}
            descripcion={filtros.soloPostulados ? t.vacioPostuladosDetalle : t.vacioDetalle}
            action={
              filtros.soloPostulados ? (
                <Button variante="secundario" tamano="sm" onClick={() => cambiar({ soloPostulados: false })}>
                  {t.verTodos}
                </Button>
              ) : (
                <Link to="/explorar" className={claseEnlaceFuerte}>
                  {es.buscador.titulo}
                </Link>
              )
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-slate-400" aria-live="polite">
            {t.resultados(ranking.meta.total)}
          </p>
          <ol aria-label={t.lista} className="space-y-3">
            {ranking.data.map((candidato) => (
              <li key={candidato.jugador.id}>
                <FilaCandidato
                  candidato={candidato}
                  ofertaId={oferta.id}
                  gestiona={gestiona}
                  busqueda={busqueda.toString()}
                />
              </li>
            ))}
          </ol>
          <Paginacion
            pagina={ranking.meta.page}
            totalPaginas={ranking.meta.totalPages}
            onCambiar={(page) => cambiar({ page })}
          />
        </div>
      )}
    </>
  )
}

/** Fecha y modo del cálculo, pesos de la oferta (leyenda de las barras) y «Recalcular». */
function EstadoCalculo({ ranking, filtros }: { ranking: RankingOferta; filtros: FiltrosRanking }) {
  const { usuario } = useAuth()
  const { notificar } = useToast()
  const { oferta } = ranking
  const recalculo = useRecalcularRanking(oferta.id, filtros)
  const finalizada = oferta.estado === 'CUBIERTA' || oferta.estado === 'CERRADA'
  // Recalculan el equipo dueño y el scout; el administrador sólo lee.
  const puedeRecalcular = !finalizada && (usuario?.rol === 'EQUIPO' || usuario?.rol === 'SCOUT')
  const limite =
    recalculo.isError && axios.isAxiosError(recalculo.error) && recalculo.error.response?.status === 429

  const recalcular = () =>
    recalculo.mutate(undefined, {
      onSuccess: () => notificar(t.recalculado),
      onError: (error) => {
        // El límite de recálculos no es un fallo: se avisa en la tarjeta, sin error rojo.
        if (axios.isAxiosError(error) && error.response?.status === 429) return
        notificar(t.errorRecalcular, 'error')
      },
    })

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="sr-only">{t.calculo}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-slate-100">
              {t.calculadoEl(formatoFechaHora.format(ranking.calculadoEn))}
            </p>
            <Badge tono="violeta">{t.modo[ranking.modo]}</Badge>
            <Badge>{t.formulas(ranking.versionFormulas)}</Badge>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
            {finalizada ? t.instantanea(es.estadoOferta[oferta.estado]) : t.alDia} {t.modoDetalle[ranking.modo]}
          </p>
        </div>
        {puedeRecalcular && (
          <Button variante="secundario" tamano="sm" cargando={recalculo.isPending} onClick={recalcular}>
            {!recalculo.isPending && <RefreshCw size={13} aria-hidden />}
            {t.recalcular}
          </Button>
        )}
      </div>

      {limite && (
        <p
          role="status"
          className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/8 px-3 py-2 text-xs leading-relaxed text-amber-200"
        >
          <CircleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
          {t.limiteRecalculo}
        </p>
      )}

      <div className="mt-4 border-t border-white/6 pt-3">
        <h3 className="text-[11px] tracking-wide text-slate-400 uppercase">{t.pesos}</h3>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-200">
          {DIMENSIONES_VISIBLES.map((dimension) => (
            <li key={dimension} className="inline-flex items-center gap-1.5">
              <MuestraDimension clave={dimension} />
              {t.pesoDe(es.dimension[dimension], aPorcentaje(oferta.pesos[dimension]))}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{t.pesosDetalle}</p>
      </div>
    </Card>
  )
}

/**
 * Un candidato del ranking. En pantallas anchas es una fila de tres bloques
 * (quién es, de dónde sale su puntaje y el puntaje con sus acciones); a 375 px
 * los bloques se apilan en una tarjeta, con el desglose debajo.
 */
function FilaCandidato({
  candidato,
  ofertaId,
  gestiona,
  busqueda,
}: {
  candidato: CandidatoRanking
  ofertaId: string
  gestiona: boolean
  busqueda: string
}) {
  const { jugador, postulacion } = candidato
  const desglose = calcularAportes(candidato)
  const faltan = datosQueFaltan(candidato)

  return (
    <article
      aria-label={`${t.puesto(candidato.puesto)}: ${jugador.nombre}`}
      className={cn('card p-4', postulacion && 'border-brand-500/25')}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_auto] lg:items-center">
        {/* Quién es */}
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/5 font-mono text-sm font-semibold text-slate-200"
            aria-hidden
          >
            {candidato.puesto}
          </span>
          {jugador.avatarUrl ? (
            <img src={jugador.avatarUrl} alt="" className="size-10 shrink-0 rounded-full object-cover" />
          ) : (
            <Avatar nombre={jugador.nombre} size="md" />
          )}
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-100">
              <Link
                to={`/jugador/${jugador.id}`}
                className="hover:text-brand-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
              >
                {jugador.nombre}
              </Link>
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {jugador.verificacion ? (
                <>
                  <Badge tono="verde">
                    <BadgeCheck size={11} aria-hidden />
                    {t.verificado}
                  </Badge>
                  {jugador.posicion && (
                    <Badge tono="cian">
                      {es.posicionLol[jugador.posicion as PosicionLol] ?? jugador.posicion}
                    </Badge>
                  )}
                  <Badge tono="violeta">{jugador.rango ? es.rangoLol[jugador.rango] : t.sinRango}</Badge>
                </>
              ) : (
                <Badge tono="ambar">{t.sinCuenta}</Badge>
              )}
            </div>
          </div>
        </div>

        {/* De dónde sale el puntaje */}
        <div className="min-w-0">
          <BarraAportes desglose={desglose} />
          {faltan.length > 0 && (
            <p className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-200">
              <CircleAlert size={12} className="mt-0.5 shrink-0" aria-hidden />
              {t.faltanDatos(faltan.join(', '))}
            </p>
          )}
        </div>

        {/* Puntaje, postulación y acciones */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 lg:flex-col lg:items-end">
          <p className="flex items-baseline gap-1.5">
            <span className="sr-only">{t.compatibilidad}: </span>
            <Trophy size={13} className="self-center text-brand-300" aria-hidden />
            <span className="text-2xl font-bold tabular-nums text-slate-50">
              {t.porcentaje(desglose.total)}
            </span>
          </p>
          {postulacion ? (
            <Badge tono={TONO_ESTADO_POSTULACION[postulacion.estado]}>
              {t.postulado} · {es.estadoPostulacion[postulacion.estado]}
            </Badge>
          ) : (
            <span className="text-[11px] text-slate-400">{t.noPostulado}</span>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/6 pt-3">
        <Link
          to={{ pathname: `/vacantes/${ofertaId}/ranking/${jugador.id}`, search: busqueda }}
          aria-label={t.verDetalleDe(jugador.nombre)}
          className={cn(claseEnlaceFuerte, 'mr-auto')}
        >
          {t.verDetalle}
        </Link>
        {gestiona && postulacion && (
          <AccionesPostulacion postulacion={postulacion} nombre={jugador.nombre} />
        )}
      </div>
    </article>
  )
}
