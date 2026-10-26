import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BadgeCheck,
  Calendar,
  CheckCircle2,
  Clock,
  Gamepad2,
  Link2,
  MapPin,
  MessageSquarePlus,
  ShieldCheck,
  Sparkles,
  Trophy,
} from 'lucide-react'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Modal,
  Progress,
  ScoreRing,
  SectionTitle,
  Sparkline,
  Textarea,
  cn,
} from '@/components/ui'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/context/AuthContext'
import { useIdentidad } from '@/api/identidad'
import { useEndosarHabilidad, useHabilidades, usePerfil } from '@/api/perfiles'
import { DIMENSIONES } from '@/lib/matching'
import type { HabilidadJugador } from '@/types'

export default function PerfilJugadorPage() {
  const { id } = useParams<{ id: string }>()
  const { notificar } = useToast()
  const { usuario } = useAuth()
  const navegar = useNavigate()
  const consulta = usePerfil(id)
  const { data: catalogo = [] } = useHabilidades()
  const { data: identidad } = useIdentidad()
  const endoso = useEndosarHabilidad()
  const [endorsement, setEndorsement] = useState<HabilidadJugador | null>(null)
  const [comentario, setComentario] = useState('')
  const datos = consulta.data ?? null
  const cargando = consulta.isLoading
  const enviando = endoso.isPending

  /** Un usuario no puede endosar sus propias habilidades (unicidad por autor). */
  const esPropio = identidad?.perfilJugadorId === id
  const puedeEndosar = Boolean(usuario) && !esPropio

  const enviarEndorsement = async () => {
    if (!usuario || !endorsement) return
    try {
      await endoso.mutateAsync({ habilidadJugadorId: endorsement.id, comentario })
      setEndorsement(null)
      setComentario('')
      notificar('Endorsement registrado. La habilidad queda validada.')
    } catch (e) {
      notificar(
        e instanceof Error ? e.message : 'No se pudo registrar el endorsement.',
        'error',
      )
    }
  }

  if (cargando) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-44 rounded-2xl" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="skeleton h-72 rounded-2xl lg:col-span-2" />
          <div className="skeleton h-72 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!datos) {
    return (
      <EmptyState
        icono={<Gamepad2 size={22} />}
        titulo="Perfil no encontrado"
        descripcion="El jugador solicitado no existe o dejo de estar disponible."
      />
    )
  }

  const { perfil, stats, cuentas, skills, endoses, visibilidad } = datos

  const statPrincipal = stats[0]
  const promedioWinRate =
    stats.length > 0
      ? stats.reduce((a, s) => a + s.winRate, 0) / stats.length
      : 0
  const partidasTotales = stats.reduce((a, s) => a + s.partidas, 0)

  // Indice de confiabilidad de la evidencia: que proporcion de sus datos
  // provienen de la API oficial frente a lo autodeclarado.
  const datosVerificados = stats.filter((s) => s.fuente.startsWith('api-')).length
  const confiabilidad = stats.length ? datosVerificados / stats.length : 0

  const habilidadesDe = (hj: HabilidadJugador) =>
    catalogo.find((h) => h.id === hj.habilidadId)

  return (
    <div className="space-y-6">
      <Link
        to="/explorar"
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-slate-300"
      >
        <ArrowLeft size={14} />
        Volver al directorio de talento
      </Link>

      {/* ----------------------------- Cabecera ----------------------------- */}
      <Card className="relative overflow-hidden">
        <div className="grid-bg absolute inset-0 opacity-30" />
        <div className="absolute -left-16 -top-16 size-64 rounded-full bg-brand-600/20 blur-3xl" />
        <div className="relative flex flex-wrap items-start gap-6 p-6">
          <Avatar nombre={perfil.nombre} size="xl" />

          <div className="min-w-[16rem] flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-50">
                {perfil.nombre}
              </h1>
              <Badge tono="violeta">
                <BadgeCheck size={11} />
                Perfil verificable
              </Badge>
              {perfil.esCaribe && <Badge tono="cian">Caribe colombiano</Badge>}
            </div>
            <p className="mt-1 font-mono text-sm text-slate-400">@{perfil.handle}</p>

            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <MapPin size={13} className="text-slate-500" />
                {perfil.region}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock size={13} className="text-slate-500" />
                {perfil.horasDisponibles} h disponibles por semana
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar size={13} className="text-slate-500" />
                {perfil.aniosExperiencia} anos de experiencia
              </span>
              <span className="flex items-center gap-1.5">
                <Gamepad2 size={13} className="text-slate-500" />
                {perfil.rolesPreferidos.join(' · ')}
              </span>
            </div>

            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-300">
              {perfil.biografia}
            </p>

            {cuentas.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {cuentas.map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/8 px-2.5 py-1 text-[11px] text-emerald-300"
                  >
                    <Link2 size={12} />
                    {c.plataforma}
                    <span className="font-mono text-emerald-400/70">{c.identificadorExterno}</span>
                    <CheckCircle2 size={12} />
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-center gap-3">
            <ScoreRing valor={confiabilidad} tamano={92} grosor={8} etiqueta="verificacion" />
            {visibilidad.mostrarContacto && (
              <Button
                variante="secundario"
                tamano="sm"
                onClick={() => {
                  if (!perfil) return
                  navegar(`/mensajes?con=${perfil.usuarioId}`)
                }}
              >
                Contactar
              </Button>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <div className="space-y-6">
          {/* --------------------- Estadisticas verificadas --------------------- */}
          {visibilidad.mostrarEstadisticas && (
            <Card>
              <CardHeader
                title="Estadisticas de juego (ingesta directa)"
                subtitle="Datos obtenidos de la API oficial del juego, no declarados por el jugador."
                icon={<ShieldCheck size={16} />}
              />
            <div className="p-5">
              {stats.length === 0 ? (
                <EmptyState
                  icono={<Gamepad2 size={22} />}
                  titulo="Sin estadisticas sincronizadas"
                  descripcion="Este jugador aun no ha vinculado una cuenta de juego verificada."
                />
              ) : (
                <div className="space-y-4">
                  {stats.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-xl border border-white/8 bg-white/3 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="grid size-9 place-items-center rounded-lg bg-brand-500/12 text-brand-300">
                            <Gamepad2 size={16} />
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-slate-100">
                              {s.juego}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {s.rol} · Rango {s.rango}
                            </p>
                          </div>
                        </div>
                        <Badge tono="verde">
                          <ShieldCheck size={10} />
                          {s.fuente === 'api-riot' ? 'Riot Games API' : 'Steam API'}
                        </Badge>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                        {[
                          { l: 'Win rate', v: `${Math.round(s.winRate * 100)}%` },
                          { l: 'KDA', v: s.kda.toFixed(2) },
                          { l: 'Partidas', v: s.partidas.toLocaleString('es-CO') },
                          { l: 'Victorias', v: s.victorias.toLocaleString('es-CO') },
                        ].map((m) => (
                          <div key={m.l}>
                            <p className="text-[10px] uppercase tracking-wide text-slate-500">
                              {m.l}
                            </p>
                            <p className="mt-0.5 text-lg font-bold text-slate-50">
                              {m.v}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3">
                        <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">
                          Ultimas 10 partidas
                        </p>
                        <Sparkline datos={s.tendencia} alto={26} />
                      </div>

                      <p className="mt-2 text-[10px] text-slate-600">
                        Sincronizado el {s.ultimaSync.slice(0, 10)} · worker de
                        ingesta
                      </p>
                    </div>
                  ))}
                </div>
              )}
              </div>
            </Card>
          )}

          {/* --------------------------- Portafolio --------------------------- */}
          {visibilidad.mostrarPortafolio && perfil.portafolio.length > 0 && (
            <Card>
              <CardHeader
                title="Portafolio de partidas"
                subtitle="Ultimas partidas registradas por la ingesta directa."
                icon={<Gamepad2 size={16} />}
              />
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/8 text-[10px] uppercase tracking-wide text-slate-500">
                      <th className="px-5 py-2.5 font-medium">Fecha</th>
                      <th className="px-5 py-2.5 font-medium">Mapa</th>
                      <th className="px-5 py-2.5 font-medium">Resultado</th>
                      <th className="px-5 py-2.5 font-medium">Rating</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {perfil.portafolio.map((p) => (
                      <tr key={p.id} className="transition hover:bg-white/3">
                        <td className="px-5 py-2.5 font-mono text-slate-500">
                          {p.fecha}
                        </td>
                        <td className="px-5 py-2.5 text-slate-300">{p.mapa}</td>
                        <td className="px-5 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <Badge tono={p.resultado === 'victoria' ? 'verde' : 'rojo'}>
                              {p.resultado}
                            </Badge>
                            {p.mvp && <Badge tono="ambar">MVP</Badge>}
                          </div>
                        </td>
                        <td className="px-5 py-2.5 font-mono text-slate-300">
                          {p.rating.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* ---------------------------- Logros ---------------------------- */}
          {perfil.logros.length > 0 && (
            <Card>
              <CardHeader
                title="Logros y trayectoria competitiva"
                icon={<Trophy size={16} />}
              />
              <div className="grid gap-3 p-5 sm:grid-cols-2">
                {perfil.logros.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-start gap-3 rounded-xl border border-white/8 bg-white/3 p-3.5"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-500/12 text-amber-300">
                      <Trophy size={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-100">{l.titulo}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {l.juego} · {l.lugar} · {l.anio}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* --------------------------- Historial --------------------------- */}
          <Card>
            <CardHeader
              title="Equipos anteriores"
              subtitle="Historial competitivo registrado en la plataforma."
              icon={<Gamepad2 size={16} />}
            />
            <div className="p-5">
              {perfil.equiposAnteriores.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Primer projeto profesional en la plataforma.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {perfil.equiposAnteriores.map((e) => (
                    <Badge key={e} tono="neutro">
                      {e}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* --------------------------- Columna lateral --------------------------- */}
        <div className="space-y-6">
          {/* --------------------- Habilidades validadas --------------------- */}
          <Card>
            <CardHeader
              title="Habilidades y endoses"
              subtitle="Validacion por terceros: la unica senal de habilidades blandas que no se autodeclara."
              icon={<BadgeCheck size={16} />}
            />
            <div className="space-y-4 p-5">
              {skills.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Este jugador aun no ha registrado habilidades.
                </p>
              ) : (
                skills.map((s) => {
                  const h = habilidadesDe(s)
                  const endo = endoses.find((e) => e.habilidadJugadorId === s.id)
                  return (
                    <div key={s.id}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-xs text-slate-300">
                          {s.verificada ? (
                            <BadgeCheck size={13} className="text-emerald-400" />
                          ) : (
                            <Clock size={13} className="text-slate-600" />
                          )}
                          {h?.nombre ?? 'Habilidad'}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500">
                          nivel {s.nivel}/5
                        </span>
                      </div>
                      <Progress
                        valor={s.nivel / 5}
                        className="mt-1.5"
                        barClassName={
                          s.verificada
                            ? 'bg-gradient-to-r from-emerald-500 to-accent-500'
                            : 'from-slate-600 to-slate-500'
                        }
                      />
                      {endo && (
                        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                          "{endo.comentario}" — {endo.autorNombre}
                        </p>
                      )}
                      {puedeEndosar && !endo && (
                        <button
                          type="button"
                          onClick={() => setEndorsement(s)}
                          className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-brand-300 transition hover:text-brand-200"
                        >
                          <MessageSquarePlus size={12} />
                          Endosar esta habilidad
                        </button>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </Card>

          {/* ---------------------- Indice de confianza ---------------------- */}
          <Card>
            <CardHeader
              title="Indice de confianza de la evidencia"
              subtitle="Que proporcion de los datos es verificable."
              icon={<ShieldCheck size={16} />}
            />
            <div className="space-y-4 p-5">
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Datos de la API oficial</span>
                  <span className="font-mono text-slate-200">
                    {Math.round(confiabilidad * 100)}%
                  </span>
                </div>
                <Progress valor={confiabilidad} className="mt-1.5" />
              </div>
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Promedio de win rate</span>
                  <span className="font-mono text-slate-200">
                    {Math.round(promedioWinRate * 100)}%
                  </span>
                </div>
                <Progress
                  valor={promedioWinRate}
                  className="mt-1.5"
                  barClassName="bg-gradient-to-r from-cyan-500 to-emerald-500"
                />
              </div>
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Partidas analizadas</span>
                  <span className="font-mono text-slate-200">
                    {partidasTotales.toLocaleString('es-CO')}
                  </span>
                </div>
                <Progress
                  valor={Math.min(partidasTotales / 2500, 1)}
                  className="mt-1.5"
                  barClassName="bg-gradient-to-r from-amber-500 to-rose-500"
                />
              </div>

              <p className="rounded-lg border border-white/8 bg-white/3 p-3 text-[11px] leading-relaxed text-slate-500">
                Una senal solo es informativa si resulta costosa de falsificar. Una
                estadistica escrita en un formulario no cumple esa condicion; una
                obtenida de la API oficial del juego, si.
              </p>
            </div>
          </Card>

          {/* ---------------------- Cobertura del matching ---------------------- */}
          <Card>
            <CardHeader
              title="Cobertura del matching"
              subtitle="Dimensiones del motor con datos disponibles."
              icon={<Sparkles size={16} />}
            />
            <div className="space-y-2 p-5">
              {DIMENSIONES.map((d) => {
                const disponible =
                  d.key === 'tecnica'
                    ? stats.length > 0
                    : d.key === 'experiencia'
                      ? perfil.aniosExperiencia > 0
                      : d.key === 'blandas'
                        ? skills.length > 0
                        : d.key === 'geografica'
                          ? Boolean(perfil.region)
                          : perfil.horasDisponibles > 0
                return (
                  <div
                    key={d.key}
                    className="flex items-center justify-between rounded-lg border border-white/6 bg-white/3 px-3 py-2"
                  >
                    <span className="text-xs text-slate-300">{d.label}</span>
                    {disponible ? (
                      <Badge tono="verde">
                        <CheckCircle2 size={10} />
                        Disponible
                      </Badge>
                    ) : (
                      <Badge tono="ambar">Sin datos</Badge>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>

          {statPrincipal && (
            <Card className={cn('p-5')}>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">
                Rendimiento en {statPrincipal.juego}
              </p>
              <p className="mt-1 text-3xl font-bold text-slate-50">
                {Math.round(statPrincipal.winRate * 100)}%
                <span className="ml-1 text-sm font-normal text-slate-500">win rate</span>
              </p>
              <p className="mt-2 text-[11px] text-slate-500">
                Ultima sincronizacion {statPrincipal.ultimaSync.slice(0, 10)}
              </p>
            </Card>
          )}
        </div>
      </div>

      <SectionTitle
        title="Como se construye este perfil"
        subtitle="Cadena de captura, procesamiento y salida de datos"
      />
      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { n: '01', t: 'Vinculacion OAuth 2.0', d: 'El jugador autoriza el acceso a su cuenta de Riot Games o Steam.' },
            { n: '02', t: 'Ingesta del worker', d: 'El worker consulta periodicamente la API oficial y guarda el snapshot con su marca de tiempo.' },
            { n: '03', t: 'Normalizacion', d: 'Las metricas se llevan a una escala comparable y se calculan las derivadas (KDA, win rate, tendencia).' },
            { n: '04', t: 'Vectorizacion', d: 'El perfil se convierte en un vector de 64 dimensiones indexado con pgvector para la busqueda por similitud.' },
          ].map((p) => (
            <div key={p.n} className="rounded-xl border border-white/8 bg-white/3 p-4">
              <span className="font-mono text-xs text-brand-400">{p.n}</span>
              <p className="mt-1.5 text-sm font-semibold text-slate-100">{p.t}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{p.d}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* ------------------------- Modal de endorsement ------------------------ */}
      <Modal
        abierto={Boolean(endorsement)}
        onCerrar={() => setEndorsement(null)}
        titulo="Validar una habilidad"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-white/8 bg-white/3 p-3">
            <p className="text-xs font-medium text-slate-200">
              {endorsement
                ? habilidadesDe(endorsement)?.nombre ?? 'Habilidad'
                : ''}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Tu validacion convierte esta habilidad declarada en evidencia
              verificable: pasa a computar en la dimension de habilidades blandas
              del matching.
            </p>
          </div>
          <Field label="Comentario (opcional)">
            <Textarea
              rows={4}
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Describe la evidencia concreta que respalda tu validacion."
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variante="fantasma" onClick={() => setEndorsement(null)}>
              Cancelar
            </Button>
            <Button onClick={enviarEndorsement} cargando={enviando}>
              <BadgeCheck size={14} />
              Registrar endorsement
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
