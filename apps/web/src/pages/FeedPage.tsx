import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Briefcase,
  Database,
  MapPin,
  RefreshCw,
  Sparkles,
  Trophy,
  UserCheck,
} from 'lucide-react'
import {
  Card,
  CardHeader,
  Badge,
  Button,
  EmptyState,
  Progress,
  ScoreRing,
  SectionTitle,
} from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import {
  obtenerFeed,
  ejecutarIngesta,
  obtenerMetricas,
  obtenerRecomendaciones,
  perfilDeUsuario,
} from '@/services/api'
import { PESOS_POR_DEFECTO } from '@/lib/matching'
import type { MetricasDashboard } from '@/services/api'
import type { RecomendacionOferta } from '@/types'

type TipoActividad = 'oferta' | 'logro' | 'sync' | 'endoso'

interface Actividad {
  id: string
  tipo: TipoActividad
  titulo: string
  detalle: string
  fecha: string
  color: string
}

const ICONOS: Record<TipoActividad, typeof Briefcase> = {
  oferta: Briefcase,
  logro: Trophy,
  sync: Database,
  endoso: UserCheck,
}

const COLORES: Record<string, string> = {
  violet: 'bg-brand-500/12 text-brand-300',
  amber: 'bg-amber-500/12 text-amber-300',
  cyan: 'bg-accent-500/12 text-accent-400',
  emerald: 'bg-emerald-500/12 text-emerald-300',
}

function tiempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const horas = Math.floor(diff / 3_600_000)
  if (horas < 1) return 'hace unos minutos'
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.floor(horas / 24)
  if (dias === 1) return 'ayer'
  if (dias < 30) return `hace ${dias} dias`
  return new Date(iso).toLocaleDateString('es-CO')
}

export default function FeedPage() {
  const { usuario } = useAuth()
  const { notificar } = useToast()
  const [actividad, setActividad] = useState<Actividad[]>([])
  const [metricas, setMetricas] = useState<MetricasDashboard | null>(null)
  const [recomendaciones, setRecomendaciones] = useState<RecomendacionOferta[]>([])
  const [cargando, setCargando] = useState(true)
  const [sincronizando, setSincronizando] = useState(false)

  const perfilId = usuario ? perfilDeUsuario(usuario.id)?.id : undefined

  const cargar = async () => {
    setCargando(true)
    const [f, m] = await Promise.all([obtenerFeed(), obtenerMetricas()])
    setActividad(f)
    setMetricas(m)
    if (perfilId) {
      setRecomendaciones(
        await obtenerRecomendaciones(perfilId, { pesos: PESOS_POR_DEFECTO }),
      )
    }
    setCargando(false)
  }

  useEffect(() => {
    void cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfilId])

  const sincronizar = async () => {
    setSincronizando(true)
    const r = await ejecutarIngesta()
    setSincronizando(false)
    notificar(
      `Ingesta completada: ${r.registrosActualizados} registros actualizados desde las APIs de Riot Games y Steam en ${r.duracionMs} ms.`,
    )
    cargar()
  }

  return (
    <div className="space-y-6">
      {/* ------------------------------ Hero ------------------------------ */}
      <Card className="relative overflow-hidden border-brand-500/20">
        <div className="grid-bg absolute inset-0 opacity-40" />
        <div className="absolute -right-20 -top-20 size-72 rounded-full bg-brand-600/20 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-5 p-6 sm:p-8">
          <div className="max-w-2xl">
            <Badge tono="violeta" className="mb-3">
              <Sparkles size={11} />
              Motor de matching hibrido activo
            </Badge>
            <h1 className="text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
              Bienvenido, {usuario?.nombre.split(' ')[0]}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Cada perfil en ProPlay se construye con estadisticas obtenidas por
              ingesta directa desde las APIs oficiales de los juegos. El scouting
              deja de depender de contactos personales y de statistiques
              autorreportadas.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variante="primario" tamano="sm" onClick={sincronizar} cargando={sincronizando}>
                <RefreshCw size={14} />
                Sincronizar ahora
              </Button>
              <Link to="/vacantes">
                <Button variante="secundario" tamano="sm">
                  Ver vacantes abiertas
                  <ArrowRight size={14} />
                </Button>
              </Link>
            </div>
          </div>

          {metricas && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { v: metricas.registrosJugadores, l: 'Jugadores' },
                { v: metricas.perfilesVerificados, l: 'Verificados' },
                { v: metricas.ofertasAbiertas, l: 'Vacantes' },
              ].map((s) => (
                <div
                  key={s.l}
                  className="rounded-xl border border-white/8 bg-surface-900/60 px-4 py-3 text-center"
                >
                  <p className="text-xl font-bold text-slate-50">{s.v}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                    {s.l}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {perfilId && (
        <Card>
          <CardHeader
            title="Vacantes que encajan contigo"
            subtitle="El motor de matching evaluo tu perfil contra cada vacante abierta del ecosistema."
            icon={<Sparkles size={16} />}
            action={
              <Link to="/mi-perfil">
                <Button variante="fantasma" tamano="sm">
                  Completar mi perfil
                  <ArrowRight size={13} />
                </Button>
              </Link>
            }
          />
          <div className="p-5">
            {cargando ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="skeleton h-16 rounded-xl" />
                ))}
              </div>
            ) : recomendaciones.length === 0 ? (
              <EmptyState
                icono={<Briefcase size={22} />}
                titulo="Sin vacantes por ahora"
                descripcion="Cuando los equipos publiquen oportunidades, aparecera aqui tu compatibilidad con cada una."
              />
            ) : (
              <ul className="space-y-3">
                {recomendaciones.slice(0, 5).map(({ oferta, resultado }) => (
                  <li key={oferta.id}>
                    <Link
                      to={`/vacantes/${oferta.id}`}
                      className="flex items-center gap-4 rounded-xl border border-white/8 bg-white/3 p-4 transition hover:border-brand-500/40 hover:bg-white/6"
                    >
                      <ScoreRing valor={resultado.puntaje} tamano={50} grosor={5} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-100">
                          {oferta.rol} · {oferta.juego}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                          <span className="flex items-center gap-1">
                            <MapPin size={11} />
                            {oferta.regionPreferida}
                          </span>
                          <span>{oferta.horasSemanales} h/semana</span>
                          <span>Rank min. {oferta.rangoMinimo}</span>
                          {resultado.modo === 'hibrido' && (
                            <Badge tono="cian" className="!py-0 !text-[10px]">
                              Hibrido
                            </Badge>
                          )}
                        </div>
                        <Progress
                          valor={resultado.puntaje}
                          className="mt-2 h-1"
                        />
                      </div>
                      <ArrowRight
                        size={15}
                        className="shrink-0 text-slate-600 transition group-hover:text-brand-300"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* --------------------------- Actividad --------------------------- */}
        <Card>
          <CardHeader
            title="Actividad reciente del ecosistema"
            subtitle="Eventos generados por la ingesta, los equipos y los endoses de la comunidad."
            icon={<RefreshCw size={16} />}
          />
          <div className="p-2">
            {cargando ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="skeleton h-14 rounded-xl" />
                ))}
              </div>
            ) : actividad.length === 0 ? (
              <EmptyState
                icono={<RefreshCw size={22} />}
                titulo="Sin actividad reciente"
                descripcion="Cuando los equipos publiquen vacantes o los jugadores alcancen logros, apareceran aqui."
              />
            ) : (
              <ul className="divide-y divide-white/5">
                {actividad.map((a) => {
                  const Icono = ICONOS[a.tipo]
                  return (
                    <li
                      key={a.id}
                      className="flex items-start gap-3 px-4 py-3.5 transition hover:bg-white/3"
                    >
                      <span
                        className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${COLORES[a.color]}`}
                      >
                        <Icono size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-200">{a.titulo}</p>
                        <p className="mt-0.5 truncate text-[11px] text-slate-500">
                          {a.detalle}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] text-slate-600">
                        {tiempoRelativo(a.fecha)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </Card>

        {/* ------------------------- Distribucion ------------------------- */}
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Talento por region"
              subtitle="Concentracion geografica del talento registrado."
              icon={<MapPin size={16} />}
            />
            <div className="space-y-3 p-5">
              {metricas?.topRegiones.map((r, i) => {
                const max = metricas.topRegiones[0]?.jugadores || 1
                const esCaribe = ['Barranquilla', 'Cartagena', 'Santa Marta'].includes(
                  r.region,
                )
                return (
                  <div key={r.region}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-slate-300">
                        {r.region}
                        {esCaribe && (
                          <Badge tono="cian" className="!px-1.5 !py-0 !text-[9px]">
                            Caribe
                          </Badge>
                        )}
                      </span>
                      <span className="font-mono text-slate-400">{r.jugadores}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500"
                        style={{ width: `${(r.jugadores / max) * 100}%` }}
                      />
                    </div>
                    {i === 0 && (
                      <p className="mt-1 text-[10px] text-slate-600">
                        Mayor concentracion del Caribe colombiano, la region objetivo
                        del proyecto.
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Juegos con mayor presencia"
              icon={<Trophy size={16} />}
            />
            <div className="space-y-2 p-5">
              {metricas?.distribucionPorJuego.map((j) => (
                <div
                  key={j.juego}
                  className="flex items-center justify-between rounded-lg border border-white/6 bg-white/3 px-3 py-2"
                >
                  <span className="text-xs text-slate-300">{j.juego}</span>
                  <Badge tono="neutro">{j.jugadores} registros</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <SectionTitle
        title="Principio de la plataforma"
        subtitle="Por que ProPlay cambia la forma de hacer scouting"
      />
      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            t: 'Asimetria de informacion',
            d: 'Cuando el comprador no puede verificar la calidad, el mercado degrada hacia la seleccion adversa. La API oficial rompe ese bloqueo.',
          },
          {
            t: 'Senales costosas de falsificar',
            d: 'Una estadistica escrita en un formulario no informa. Una estadistica traida de la API del juego, si.',
          },
          {
            t: 'Marketplace de dos lados',
            d: 'El valor crece con los dos lados: jugadores registrados y equipos buscando. El matching resuelve el emparejamiento.',
          },
        ].map((c) => (
          <Card key={c.t} className="p-5">
            <h4 className="text-sm font-semibold text-slate-100">{c.t}</h4>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">{c.d}</p>
          </Card>
        ))}
      </div>
    </div>
  )
}
