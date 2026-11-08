import { Link } from 'react-router-dom'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Crosshair,
  Eye,
  Gamepad2,
  Medal,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Swords,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Wheat,
  Flame,
} from 'lucide-react'
import {
  JUEGO_LOL,
  POSICIONES_LOL,
  metricasLolSchema,
  type Estadistica,
  type MetricasLol,
  type RangoLol,
  type ResumenEstadisticas,
} from '@proplay/shared'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Progress,
  SectionTitle,
  Stat,
  cn,
} from '@/components/ui'
import { mensajeDeError } from '@/api/client'
import { useCuentasGaming } from '@/api/cuentasGaming'
import {
  useHistorialEstadisticas,
  useResumenEstadisticas,
  useSincronizarEstadisticas,
} from '@/api/estadisticas'
import { usePerfilPropio } from '@/api/perfiles'
import { es } from '@/i18n/es'

const t = es.misEstadisticas

const formatoFecha = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeStyle: 'short' })
const formatoCorto = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' })
const porcentaje = (valor: number) => `${Math.round(valor * 1000) / 10} %`
const numero = (valor: number) => valor.toLocaleString('es-CO', { maximumFractionDigits: 2 })

/** Colores de las series: los mismos tokens brand-500 y accent-400 de index.css. */
const COLOR_WIN_RATE = 'var(--color-brand-500)'
const COLOR_KDA = 'var(--color-accent-400)'

// RF-04 · RF-13 · Mis estadisticas: lo ultimo traido de Riot, con la tendencia
// del rendimiento (indicador de analitica). API real.
export default function MisEstadisticasPage() {
  const perfil = usePerfilPropio()
  const cuentas = useCuentasGaming()
  const jugadorId = perfil.data?.tipo === 'JUGADOR' ? perfil.data.perfil.id : undefined
  const resumen = useResumenEstadisticas(jugadorId)
  const historial = useHistorialEstadisticas(jugadorId)

  const cargando =
    perfil.isPending || cuentas.isPending || (Boolean(jugadorId) && resumen.isPending)
  const error = perfil.error ?? cuentas.error ?? resumen.error

  return (
    <div className="space-y-6">
      <SectionTitle
        title={t.titulo}
        subtitle={t.subtitulo}
        action={
          <Badge tono="verde">
            <ShieldCheck size={11} aria-hidden />
            {t.verificado}
          </Badge>
        }
      />

      {cargando ? (
        <Esqueleto />
      ) : error ? (
        <ErrorCarga
          error={error}
          onReintentar={() => {
            void perfil.refetch()
            void cuentas.refetch()
            void resumen.refetch()
          }}
        />
      ) : !cuentas.data?.some((c) => c.plataforma === 'RIOT' && c.verificadaEn) ? (
        <Card>
          <EmptyState
            icono={<Gamepad2 size={22} />}
            titulo={t.sinCuenta}
            descripcion={t.sinCuentaDetalle}
            action={<EnlaceBoton to="/cuentas-vinculadas">{es.misEstadisticas.irCuentas}</EnlaceBoton>}
          />
        </Card>
      ) : (
        <Contenido resumen={resumen.data} historial={historial.data ?? []} />
      )}
    </div>
  )
}

function Contenido({
  resumen,
  historial,
}: {
  resumen: ResumenEstadisticas | undefined
  historial: Estadistica[]
}) {
  const sincronizar = useSincronizarEstadisticas()
  const lol = resumen?.juegos.find((j) => j.juego === JUEGO_LOL && j.fuente === 'RIOT')
  const metricas = lol ? metricasLolSchema.safeParse(lol.actual.metricas) : null

  const botonSincronizar = (
    <Button cargando={sincronizar.isPending} onClick={() => sincronizar.mutate()}>
      <RefreshCw size={14} aria-hidden />
      {t.sincronizar}
    </Button>
  )

  if (!lol || !metricas?.success) {
    return (
      <Card>
        <EmptyState
          icono={<RefreshCw size={22} />}
          titulo={t.sinDatos}
          descripcion={t.sinDatosDetalle}
          action={
            <div className="flex flex-col items-center gap-2">
              {botonSincronizar}
              {sincronizar.isError && <ErrorAccion error={sincronizar.error} />}
            </div>
          }
        />
      </Card>
    )
  }

  const { actual, tendencia } = lol
  const m = metricas.data

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-400">
          {t.capturadaEl(formatoFecha.format(actual.capturadaEn))} ·{' '}
          {es.servidor[m.servidor as keyof typeof es.servidor] ?? m.servidor} ·{' '}
          {t.nivel(m.nivelInvocador)}
        </p>
        <div className="flex flex-col items-end gap-1">
          {botonSincronizar}
          {sincronizar.isSuccess && !sincronizar.data.hayDatosNuevos && (
            <p role="status" className="text-[11px] text-slate-400">
              {es.cuentasVinculadas.sincronizadaSinCambios}
            </p>
          )}
          {sincronizar.isError && <ErrorAccion error={sincronizar.error} />}
        </div>
      </div>

      {/* --------------------------------- Rango -------------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2">
        <TarjetaRango titulo={t.rangoSoloDuo} rango={m.rangoSoloDuo} />
        <TarjetaRango titulo={t.rangoFlex} rango={m.rangoFlex} />
      </div>

      {/* ------------------------------- Metricas ------------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={t.partidas}
          value={actual.partidas}
          hint={t.partidasPista(actual.victorias)}
          icono={<Gamepad2 size={17} />}
        />
        <Stat
          label={t.winRate}
          value={porcentaje(actual.winRate)}
          hint={textoTendencia(tendencia.winRate, porcentaje)}
          icono={<Trophy size={17} />}
          acento="verde"
        />
        <Stat
          label={t.kda}
          value={numero(actual.kda)}
          hint={t.kdaPista(m.promedioKills, m.promedioMuertes, m.promedioAsistencias)}
          icono={<Swords size={17} />}
          acento="cian"
        />
        <Stat
          label={t.csMinuto}
          value={numero(m.csPorMinuto)}
          hint={textoTendencia(tendencia.csPorMinuto, numero)}
          icono={<Wheat size={17} />}
          acento="ambar"
        />
        <Stat label={t.oroMinuto} value={numero(m.oroPorMinuto)} icono={<Medal size={17} />} acento="ambar" />
        <Stat label={t.danoMinuto} value={numero(m.danoPorMinuto)} icono={<Flame size={17} />} />
        <Stat
          label={t.visionMinuto}
          value={numero(m.visionPorMinuto)}
          icono={<Eye size={17} />}
          acento="cian"
        />
        <Stat
          label={t.participacion}
          value={porcentaje(m.participacionKills)}
          hint={t.duracion(m.duracionMediaMinutos)}
          icono={<Users size={17} />}
          acento="verde"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Posiciones metricas={m} principal={actual.rol} />
        <Campeones metricas={m} />
      </div>

      <Tendencia historial={historial} />
    </div>
  )
}

function textoTendencia(
  valor: number | null,
  formato: (v: number) => string,
): string | undefined {
  if (valor === null || valor === 0) return undefined
  return t.tendencia(valor > 0 ? '+' : '−', formato(Math.abs(valor)))
}

function TarjetaRango({ titulo, rango }: { titulo: string; rango: RangoLol | null }) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-500/12 text-brand-300">
          <Target size={18} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-400">{titulo}</p>
          {rango ? (
            <>
              <p className="mt-1 text-xl font-bold tracking-tight text-slate-50">
                {es.liga[rango.liga]} {rango.division ?? ''}{' '}
                <span className="text-sm font-medium text-slate-400">
                  {t.lp(rango.puntosLiga)}
                </span>
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {t.victoriasDerrotas(rango.victorias, rango.derrotas)} ·{' '}
                {porcentaje(rango.victorias / Math.max(1, rango.victorias + rango.derrotas))}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-slate-500">{t.sinRango}</p>
          )}
        </div>
      </div>
    </Card>
  )
}

function Posiciones({ metricas, principal }: { metricas: MetricasLol; principal: string | null }) {
  const total = Math.max(1, metricas.partidasAnalizadas)
  return (
    <Card>
      <CardHeader icon={<Crosshair size={18} />} title={t.rolesTitulo} subtitle={t.rolesSubtitulo} />
      <ul className="space-y-3 p-5">
        {POSICIONES_LOL.map((posicion) => {
          const partidas = metricas.distribucionRoles[posicion] ?? 0
          return (
            <li key={posicion}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className={cn('font-medium', partidas ? 'text-slate-200' : 'text-slate-500')}>
                  {es.posicion[posicion]}
                  {principal === posicion && (
                    <Badge tono="violeta" className="ml-2">
                      {t.rolPrincipal}
                    </Badge>
                  )}
                </span>
                <span className="text-slate-400">{t.partidasDe(partidas)}</span>
              </div>
              <Progress valor={partidas / total} />
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function Campeones({ metricas }: { metricas: MetricasLol }) {
  return (
    <Card>
      <CardHeader
        icon={<Swords size={18} />}
        title={t.campeonesTitulo}
        subtitle={t.campeonesSubtitulo}
      />
      <ol className="divide-y divide-white/6">
        {metricas.campeonesMasJugados.map((campeon, i) => (
          <li key={campeon.campeon} className="flex items-center gap-3 px-5 py-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/5 text-xs font-bold text-slate-400">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-100">{campeon.campeon}</p>
              <p className="text-[11px] text-slate-500">
                {t.campeonDetalle(campeon.partidas, campeon.victorias, campeon.kda)}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  )
}

// RF-13 · Tendencia del rendimiento del jugador (tarea 2.16)
function Tendencia({ historial }: { historial: Estadistica[] }) {
  const puntos = historial
    .filter((e) => e.juego === JUEGO_LOL && e.fuente === 'RIOT')
    .sort((a, b) => a.capturadaEn.getTime() - b.capturadaEn.getTime())
    .map((e) => ({
      fecha: formatoCorto.format(e.capturadaEn),
      winRate: Math.round(e.winRate * 1000) / 10,
      kda: e.kda,
    }))

  return (
    <Card>
      <CardHeader
        icon={<TrendingUp size={18} />}
        title={t.tendenciaTitulo}
        subtitle={t.tendenciaSubtitulo}
      />
      {puntos.length < 2 ? (
        <p className="p-5 text-xs text-slate-500">{t.tendenciaVacia}</p>
      ) : (
        <div className="p-5">
          <div className="h-64" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={puntos}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                <XAxis dataKey="fecha" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis yAxisId="wr" stroke="#64748b" fontSize={11} tickLine={false} unit="%" />
                <YAxis
                  yAxisId="kda"
                  orientation="right"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--color-surface-800)',
                    border: '1px solid rgba(148,163,184,0.2)',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  yAxisId="wr"
                  type="monotone"
                  dataKey="winRate"
                  name={t.serieWinRate}
                  stroke={COLOR_WIN_RATE}
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
                <Line
                  yAxisId="kda"
                  type="monotone"
                  dataKey="kda"
                  name={t.serieKda}
                  stroke={COLOR_KDA}
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {/* La misma informacion como tabla, para lectores de pantalla. */}
          <table className="sr-only">
            <caption>{t.tablaResumen}</caption>
            <thead>
              <tr>
                <th scope="col">{t.fecha}</th>
                <th scope="col">{t.serieWinRate}</th>
                <th scope="col">{t.serieKda}</th>
              </tr>
            </thead>
            <tbody>
              {puntos.map((p, i) => (
                <tr key={i}>
                  <td>{p.fecha}</td>
                  <td>{p.winRate}</td>
                  <td>{p.kda}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

/* ---------------------------------- Estados --------------------------------- */

function Esqueleto() {
  return (
    <div aria-busy="true" aria-label={t.cargando} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="skeleton h-24 rounded-2xl" />
        <div className="skeleton h-24 rounded-2xl" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton h-28 rounded-2xl" />
        ))}
      </div>
      <div className="skeleton h-64 rounded-2xl" />
    </div>
  )
}

function ErrorCarga({ error, onReintentar }: { error: Error; onReintentar: () => void }) {
  return (
    <Card>
      <div role="alert">
        <EmptyState
          icono={<RotateCcw size={22} />}
          titulo={t.errorCarga}
          descripcion={mensajeDeError(error)}
          action={
            <Button variante="secundario" onClick={onReintentar}>
              <RotateCcw size={13} aria-hidden />
              {es.comun.reintentar}
            </Button>
          }
        />
      </div>
    </Card>
  )
}

function ErrorAccion({ error }: { error: Error }) {
  return (
    <p role="alert" className="text-xs text-rose-300">
      {mensajeDeError(error)}
    </p>
  )
}

function EnlaceBoton({ to, children }: { to: string; children: string }) {
  return (
    <Link
      to={to}
      className="inline-flex h-10 items-center gap-2 rounded-lg bg-gradient-to-r from-brand-600 to-accent-600 px-4 text-sm font-medium text-white transition hover:from-brand-500 hover:to-accent-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
    >
      {children}
    </Link>
  )
}
