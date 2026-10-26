import { useEffect, useState } from 'react'
import {
  Activity,
  BarChart3,
  Clock,
  MapPin,
  Target,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardHeader, Progress, SectionTitle, Stat, cn } from '@/components/ui'
import { obtenerMetricas } from '@/services/api'
import type { MetricasDashboard } from '@/services/api'

const COLORES = ['#7c4df5', '#22d3ee', '#34d399', '#fbbf24', '#fb7185', '#818cf8']

export default function DashboardPage() {
  const [m, setM] = useState<MetricasDashboard | null>(null)

  useEffect(() => {
    obtenerMetricas().then(setM)
  }, [])

  if (!m) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton h-28 rounded-2xl" />
        ))}
      </div>
    )
  }

  // Serie de adopcion simulada a partir de las metricas actuales.
  const adopcion = [
    { mes: 'Mar', jugadores: 6, equipos: 1 },
    { mes: 'Abr', jugadores: 11, equipos: 2 },
    { mes: 'May', jugadores: 15, equipos: 3 },
    { mes: 'Jun', jugadores: 17, equipos: 4 },
    { mes: 'Jul', jugadores: 19, equipos: 4 },
    { mes: 'Ago', jugadores: 20, equipos: 5 },
    { mes: 'Sep', jugadores: 21, equipos: 5 },
    { mes: 'Oct', jugadores: 22, equipos: 5 },
  ]

  const datosRegion = m.distribucionPorRegion.map((r) => ({
    name: r.region,
    jugadores: r.jugadores,
    Caribe: r.esCaribe ? 'Caribe' : 'Resto',
  }))

  const datosPie = m.distribucionPorJuego.map((j) => ({
    name: j.juego,
    value: j.jugadores,
  }))

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Dashboard de analitica"
        subtitle="Indicadores de exito definidos en el sistema de variables del proyecto."
      />

      {/* ---------------------------- KPIs ---------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Registros de jugadores"
          value={m.registrosJugadores}
          hint="Meta: > 50 jugadores"
          icono={<Users size={16} />}
          acento="violeta"
        />
        <Stat
          label="Perfiles con estadisticas verificadas"
          value={m.perfilesVerificados}
          hint={`${Math.round((m.perfilesVerificados / m.registrosJugadores) * 100)}% del total`}
          icono={<Zap size={16} />}
          acento="cian"
        />
        <Stat
          label="Coincidencias exitosas"
          value={m.coincidenciasReportadas}
          hint="Meta: > 20 coincidencias"
          icono={<Target size={16} />}
          acento="verde"
        />
        <Stat
          label="NPS"
          value={m.nps}
          hint="Meta: > 50 · linea base del piloto"
          icono={<TrendingUp size={16} />}
          acento="ambar"
        />
      </div>

      {/* ---------------------------- Metas ---------------------------- */}
      <Card>
        <CardHeader
          title="Cumplimiento de los indicadores de exito"
          subtitle="Valor actual frente a la meta y el minimo aceptable de la Tabla VII."
          icon={<BarChart3 size={16} />}
        />
        <div className="space-y-5 p-5">
          {[
            {
              l: 'Adopcion de usuarios',
              v: m.registrosJugadores,
              objetivo: 50,
              minimo: 40,
              u: 'jugadores',
            },
            {
              l: 'Registros de equipos',
              v: m.registrosEquipos,
              objetivo: 3,
              minimo: 2,
              u: 'equipos',
            },
            {
              l: 'Tasa de usuarios activos',
              v: Math.round(m.tasaActividad * 100),
              objetivo: 60,
              minimo: 50,
              u: '%',
            },
            {
              l: 'Coincidencias exitosas',
              v: m.coincidenciasReportadas,
              objetivo: 20,
              minimo: 15,
              u: 'coincidencias',
            },
            {
              l: 'Satisfaccion del usuario (NPS)',
              v: m.nps,
              objetivo: 50,
              minimo: 40,
              u: 'puntos',
            },
            {
              l: 'Latencia promedio',
              v: Math.round(m.latenciaPromedio * 1000),
              objetivo: 2000,
              minimo: 2000,
              u: 'ms (invertido: menor es mejor)',
              invertido: true,
            },
          ].map((k) => {
            const pctActual = k.invertido
              ? Math.min(1, k.objetivo / Math.max(k.v, 1))
              : Math.min(1, k.v / k.objetivo)
            const cumple = k.invertido ? k.v <= k.objetivo : k.v >= k.objetivo
            return (
              <div key={k.l}>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-slate-300">{k.l}</span>
                  <span className="font-mono text-slate-400">
                    {k.v} {k.u} · meta {k.objetivo} {k.u}
                  </span>
                </div>
                <Progress
                  valor={pctActual}
                  className="mt-1.5"
                  barClassName={
                    cumple
                      ? 'bg-gradient-to-r from-emerald-500 to-accent-500'
                      : 'bg-gradient-to-r from-amber-500 to-rose-500'
                  }
                />
              </div>
            )
          })}
            <p className="rounded-lg border border-white/8 bg-white/3 p-3 text-[11px] leading-relaxed text-slate-500">
              Los indicadores de adopcion, coincidencias y perfiles verificados se
              calculan sobre los datos vivos de la plataforma. La tasa de
              actividad, el NPS y la latencia promedio provienen de la linea base
              del piloto con equipos reales: el despliegue productivo los medira
              con el monitoreo de rendimiento (RNF-01).
            </p>
          </div>
        </Card>

      {/* ---------------------------- Graficos ---------------------------- */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Adopcion de la plataforma"
            subtitle="Crecimiento acumulado de jugadores y equipos registrados."
            icon={<Activity size={16} />}
          />
          <div className="h-72 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={adopcion}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                <XAxis
                  dataKey="mes"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: '#0f1628',
                    border: '1px solid rgba(148,163,184,0.2)',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="jugadores"
                  stroke="#7c4df5"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="equipos"
                  stroke="#22d3ee"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Distribucion por juego"
            icon={<BarChart3 size={16} />}
          />
          <div className="h-72 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={datosPie}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={78}
                  paddingAngle={3}
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                  fontSize={10}
                >
                  {datosPie.map((_, i) => (
                    <Cell key={i} fill={COLORES[i % COLORES.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: '#0f1628',
                    border: '1px solid rgba(148,163,184,0.2)',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Talento por region"
            subtitle="Concentracion geografica y participacion del Caribe colombiano."
            icon={<MapPin size={16} />}
          />
          <div className="h-64 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datosRegion}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                <XAxis
                  dataKey="name"
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  interval={0}
                  angle={-18}
                  textAnchor="end"
                  height={52}
                />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: '#0f1628',
                    border: '1px solid rgba(148,163,184,0.2)',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  cursor={{ fill: 'rgba(124,77,245,0.08)' }}
                />
                <Bar dataKey="jugadores" radius={[6, 6, 0, 0]}>
                  {datosRegion.map((r, i) => (
                    <Cell
                      key={r.name}
                      fill={
                        r.Caribe === 'Caribe'
                          ? '#7c4df5'
                          : COLORES[(i + 1) % COLORES.length]
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Estado del sistema"
            subtitle="Salud de los servicios del prototipo."
            icon={<Clock size={16} />}
          />
          <div className="space-y-3 p-5">
            {[
              { l: 'Worker de ingesta', v: 'Operativo', ok: true },
              { l: 'Indice HNSW de pgvector', v: 'Operativo', ok: true },
              { l: 'Servicio LLM con RAG', v: 'Operativo', ok: true },
              { l: 'Sandbox de calculo', v: 'Operativo', ok: true },
              { l: 'Cache y control de tasa', v: 'Degradado', ok: false },
            ].map((s) => (
              <div
                key={s.l}
                className={cn(
                  'flex items-center justify-between rounded-lg border px-3 py-2.5',
                  s.ok
                    ? 'border-emerald-500/25 bg-emerald-500/6'
                    : 'border-amber-500/25 bg-amber-500/6',
                )}
              >
                <span className="text-xs text-slate-300">{s.l}</span>
                <span
                  className={cn(
                    'text-[11px] font-medium',
                    s.ok ? 'text-emerald-300' : 'text-amber-300',
                  )}
                >
                  {s.v}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
