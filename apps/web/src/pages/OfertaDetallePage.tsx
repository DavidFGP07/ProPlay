import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowUpDown,
  BadgeCheck,
  Banknote,
  BookOpen,
  Bot,
  Brain,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  MapPin,
  Search,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  Users,
  Weight,
} from 'lucide-react'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Modal,
  Progress,
  ScoreRing,
  SectionTitle,
  Textarea,
  cn,
} from '@/components/ui'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/context/AuthContext'
import { useIdentidad } from '@/api/identidad'
import { useCandidatos, useExplicarMatching, useJugadores } from '@/api/matching'
import { usePostulaciones, usePostular, useVacante } from '@/api/ofertas'
import { DIMENSIONES, PESOS_POR_DEFECTO } from '@/lib/matching'
import type { ExplicacionMatching, Pesos } from '@/types'

type Orden = 'puntaje' | 'vectorial' | 'tecnica' | 'experiencia'

export default function OfertaDetallePage() {
  const { id } = useParams<{ id: string }>()
  const { usuario } = useAuth()
  const { notificar } = useToast()

  const [pesos, setPesos] = useState<Pesos>({ ...PESOS_POR_DEFECTO })
  const [pesosConsulta, setPesosConsulta] = useState<Pesos>(pesos)
  const [orden, setOrden] = useState<Orden>('puntaje')
  const [seleccionado, setSeleccionado] = useState<string | null>(null)
  const [explicacion, setExplicacion] = useState<ExplicacionMatching | null>(null)
  const [modalPostular, setModalPostular] = useState(false)
  const [mensajePostulacion, setMensajePostulacion] = useState('')

  // El ranking se recalcula cuando el usuario deja de mover los pesos.
  useEffect(() => {
    const t = window.setTimeout(() => setPesosConsulta(pesos), 150)
    return () => window.clearTimeout(t)
  }, [pesos])

  const vacante = useVacante(id)
  const candidatos = useCandidatos(id, pesosConsulta)
  const { data: postulaciones = [] } = usePostulaciones()
  // Catalogo de perfiles para resolver nombres en el ranking.
  const { data: perfiles = [] } = useJugadores()
  const { data: identidad } = useIdentidad()
  const explicar = useExplicarMatching()
  const postulacion = usePostular()

  const oferta = vacante.data?.oferta ?? null
  const equipo = vacante.data?.equipo ?? null
  const resultados = useMemo(() => candidatos.data?.resultados ?? [], [candidatos.data])
  const traza = candidatos.data?.traza ?? null
  const cargando = vacante.isLoading || candidatos.isLoading
  const generando = explicar.isPending

  const perfilDe = (perfilId: string) => perfiles.find((p) => p.id === perfilId)

  /** Postulacion del usuario en sesion sobre esta vacante, si existe. */
  const miPerfilId = identidad?.perfilJugadorId
  const miPostulacion = miPerfilId
    ? postulaciones.find(
        (p) => p.ofertaId === id && p.perfilId === miPerfilId,
      )
    : undefined

  const ordenados = useMemo(() => {
    const copia = [...resultados]
    if (orden === 'puntaje') copia.sort((a, b) => b.puntaje - a.puntaje)
    if (orden === 'vectorial') copia.sort((a, b) => b.similitudVectorial - a.similitudVectorial)
    if (orden === 'tecnica')
      copia.sort(
        (a, b) =>
          (b.desglose.find((d) => d.key === 'tecnica')?.valor ?? 0) -
          (a.desglose.find((d) => d.key === 'tecnica')?.valor ?? 0),
      )
    if (orden === 'experiencia')
      copia.sort(
        (a, b) =>
          (b.desglose.find((d) => d.key === 'experiencia')?.valor ?? 0) -
          (a.desglose.find((d) => d.key === 'experiencia')?.valor ?? 0),
      )
    return copia
  }, [resultados, orden])

  const detalle = useMemo(
    () => resultados.find((r) => r.perfilId === seleccionado) ?? null,
    [resultados, seleccionado],
  )

  const generarExplicacion = async (perfilId: string) => {
    setExplicacion(null)
    try {
      const exp = await explicar.mutateAsync({ ofertaId: id!, perfilId, resultados })
      setExplicacion(exp)
    } catch (e) {
      notificar(
        e instanceof Error ? e.message : 'No se pudo generar la explicacion.',
        'error',
      )
    }
  }

  const enviarPostulacion = async () => {
    if (!usuario || !id) return
    try {
      await postulacion.mutateAsync({ ofertaId: id, mensaje: mensajePostulacion })
      setModalPostular(false)
      setMensajePostulacion('')
      notificar('Postulacion enviada. El equipo ya puede revisarla.')
    } catch (e) {
      notificar(
        e instanceof Error ? e.message : 'No se pudo enviar la postulacion.',
        'error',
      )
    }
  }

  if (cargando) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-40 rounded-2xl" />
        <div className="skeleton h-96 rounded-2xl" />
      </div>
    )
  }

  if (!oferta) {
    return (
      <EmptyState
        icono={<Users size={22} />}
        titulo="Vacante no encontrada"
        descripcion="La vacante solicitada no existe o fue eliminada."
      />
    )
  }

  return (
    <div className="space-y-6">
      <Link
        to="/vacantes"
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-slate-300"
      >
        <ArrowLeft size={14} />
        Volver a las vacantes
      </Link>

      {/* ---------------------------- Cabecera ---------------------------- */}
      <Card className="relative overflow-hidden">
        <div className="grid-bg absolute inset-0 opacity-30" />
        <div className="absolute -right-16 -top-24 size-72 rounded-full bg-brand-600/20 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-6 p-6">
          <div className="min-w-[18rem] flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tono="violeta">
                <Sparkles size={11} />
                {oferta.juego}
              </Badge>
              <Badge tono="cian">{oferta.rol}</Badge>
              <Badge tono={oferta.estado === 'abierta' ? 'verde' : 'neutro'}>
                {oferta.estado}
              </Badge>
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-50">
              {oferta.rol} · {oferta.juego}
            </h1>
            <p className="mt-1.5 text-sm text-slate-400">
              {equipo?.nombre ?? 'Equipo'} — {equipo?.region}
            </p>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-300">
              {oferta.descripcion}
            </p>

            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <TrendingUp size={13} />
                Rank minimo {oferta.rangoMinimo}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock size={13} />
                {oferta.horasSemanales} h/semana
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin size={13} />
                {oferta.regionPreferida}
              </span>
              <span className="flex items-center gap-1.5">
                <Users size={13} />
                {postulaciones.filter((p) => p.ofertaId === oferta.id).length}{' '}
                postulaciones
              </span>
              {oferta.salario && (
                <span className="flex items-center gap-1.5 text-emerald-300">
                  <Banknote size={13} />
                  {oferta.salario}
                </span>
              )}
            </div>

            {oferta.requisitos && oferta.requisitos.length > 0 && (
              <div className="mt-4 rounded-xl border border-white/8 bg-white/3 p-4">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">
                  Requisitos de la plaza
                </p>
                <ul className="mt-2 space-y-1.5">
                  {oferta.requisitos.map((r) => (
                    <li
                      key={r}
                      className="flex gap-2 text-[11px] leading-relaxed text-slate-300"
                    >
                      <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-brand-400" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-3">
            <div className="rounded-xl border border-white/8 bg-surface-900/60 px-4 py-3 text-right">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">
                Candidatos evaluados
              </p>
              <p className="text-2xl font-bold text-slate-50">{resultados.length}</p>
            </div>
            {usuario?.rol === 'jugador' ? (
              miPostulacion ? (
                <div className="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/8 px-4 py-3 text-center">
                  <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-emerald-300">
                    <CheckCircle2 size={13} />
                    Postulacion enviada
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Estado actual: {miPostulacion.estado}
                  </p>
                </div>
              ) : (
                <Button
                  variante="primario"
                  onClick={() => setModalPostular(true)}
                  disabled={oferta.estado !== 'abierta'}
                >
                  Postularme
                </Button>
              )
            ) : (
              <p className="max-w-[14rem] text-right text-[11px] leading-relaxed text-slate-500">
                {usuario?.rol === 'equipo' || usuario?.rol === 'admin'
                  ? 'Estas viendo la vacante como organización. Puedes gestionar candidatos desde el panel de equipo.'
                  : 'Estas viendo la vacante como scout. Puedes consultar el ranking, pero la postulación la realiza el jugador.'}
              </p>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* --------------------------- Pesos --------------------------- */}
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Pesos del matching"
              subtitle="Configurables por el equipo que publica la oferta."
              icon={<Weight size={16} />}
            />
            <div className="space-y-4 p-5">
              {DIMENSIONES.map((d) => (
                <div key={d.key}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">{d.label}</span>
                    <span className="font-mono text-brand-300">
                      {Math.round(pesos[d.key] * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={Math.round(pesos[d.key] * 100)}
                    onChange={(e) =>
                      setPesos((p) => ({
                        ...p,
                        [d.key]: Number(e.target.value) / 100,
                      }))
                    }
                    className="mt-2 w-full accent-[#7c4df5]"
                  />
                  <p className="mt-0.5 text-[10px] leading-relaxed text-slate-600">
                    {d.descripcion}
                  </p>
                </div>
              ))}
              <Button
                variante="fantasma"
                tamano="sm"
                className="w-full"
                onClick={() => setPesos({ ...PESOS_POR_DEFECTO })}
              >
                Restaurar pesos por defecto
              </Button>
            </div>
          </Card>

          {/* --------------------------- Traza --------------------------- */}
          {traza && (
            <Card>
              <CardHeader
                title="Traza de la consulta"
                subtitle="Evidencia tecnica del recorrido del motor."
                icon={<Cpu size={16} />}
              />
              <div className="space-y-3 p-5">
                {[
                  {
                    l: 'Indice consultado',
                    v: traza.indice,
                    i: <Database size={12} />,
                  },
                  {
                    l: 'Perfiles en la plataforma',
                    v: `${traza.totalPerfiles}`,
                    i: <Users size={12} />,
                  },
                  {
                    l: 'Recuperados por contenido',
                    v: `${traza.recuperadosPorContenido} (top-K)`,
                    i: <Search size={12} />,
                  },
                  {
                    l: 'Coincidencias vectoriales',
                    v: `${traza.coincidenciasVectoriales}`,
                    i: <BadgeCheck size={12} />,
                  },
                  {
                    l: 'Peso colaborativo',
                    v:
                      traza.pesoColaborativo > 0
                        ? `${Math.round(traza.pesoColaborativo * 100)} % (hibrido)`
                        : '0 % (contenido puro)',
                    i: <Brain size={12} />,
                  },
                  {
                    l: 'Latencia',
                    v: `${traza.latenciaMs} ms`,
                    i: <Clock size={12} />,
                  },
                ].map((f) => (
                  <div
                    key={f.l}
                    className="flex items-center justify-between gap-2 rounded-lg border border-white/6 bg-white/3 px-3 py-2"
                  >
                    <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      {f.i}
                      {f.l}
                    </span>
                    <span className="font-mono text-[11px] text-slate-200">{f.v}</span>
                  </div>
                ))}
                <p className="text-[10px] leading-relaxed text-slate-600">
                  El recuperador por contenido resuelve una consulta de similitud
                  sobre el indice vectorial, de modo que evita cargar la totalidad
                  de los perfiles en memoria. El componente colaborativo mantiene
                  peso cero mientras el historial de interacciones del equipo sea
                  insuficiente: es la respuesta prevista al arranque en frio.
                </p>
              </div>
            </Card>
          )}
        </div>

        {/* --------------------------- Ranking --------------------------- */}
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Ranking de compatibilidad"
              subtitle="Puntaje S(j, o) = promedio ponderado de las cinco dimensiones."
              icon={<ArrowUpDown size={16} />}
              action={
                <select
                  value={orden}
                  onChange={(e) => setOrden(e.target.value as Orden)}
                  className="rounded-lg border border-white/10 bg-surface-900/70 px-2.5 py-1.5 text-[11px] text-slate-300 focus:border-brand-500/60 focus:outline-none"
                >
                  <option value="puntaje">Ordenar por puntaje</option>
                  <option value="vectorial">Ordenar por similitud vectorial</option>
                  <option value="tecnica">Ordenar por dimension tecnica</option>
                  <option value="experiencia">Ordenar por experiencia</option>
                </select>
              }
            />

            {ordenados.length === 0 ? (
              <EmptyState
                icono={<Users size={22} />}
                titulo="Sin candidatos en el pool"
                descripcion="No hay perfiles que coincidan con los criterios de recuperacion por contenido."
              />
            ) : (
              <ul className="divide-y divide-white/5">
                {ordenados.map((r, i) => {
                  const perfil = perfilDe(r.perfilId)
                  const tecnica = r.desglose.find((d) => d.key === 'tecnica')
                  return (
                    <li key={r.perfilId}>
                      <button
                        onClick={() => {
                          setSeleccionado(r.perfilId)
                          setExplicacion(null)
                        }}
                        className={cn(
                          'flex w-full items-center gap-4 px-5 py-3.5 text-left transition',
                          seleccionado === r.perfilId
                            ? 'bg-brand-500/10'
                            : 'hover:bg-white/3',
                        )}
                      >
                        <span
                          className={cn(
                            'w-6 shrink-0 text-center font-mono text-xs',
                            i === 0
                              ? 'text-brand-300'
                              : i < 3
                                ? 'text-accent-400'
                                : 'text-slate-600',
                          )}
                        >
                          {i + 1}
                        </span>

                        {perfil && <Avatar nombre={perfil.nombre} size="sm" />}

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-100">
                            {perfil?.nombre ?? r.perfilId}
                            {perfil && (
                              <BadgeCheck
                                size={13}
                                className="ml-1.5 inline text-emerald-400"
                              />
                            )}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                            {perfil && <span>{perfil.region}</span>}
                            {perfil && (
                              <span>{perfil.rolesPreferidos[0]}</span>
                            )}
                            <span>Sim. vectorial {Math.round(r.similitudVectorial * 100)}%</span>
                            {tecnica && (
                              <span>Tecnica {Math.round(tecnica.valor * 100)}%</span>
                            )}
                            {r.modo === 'hibrido' && (
                              <Badge tono="cian" className="!py-0 !text-[10px]">
                                Hibrido
                              </Badge>
                            )}
                          </div>
                        </div>

                        <Progress
                          valor={r.puntaje}
                          className="hidden w-28 sm:block"
                        />

                        <ScoreRing
                          valor={r.puntaje}
                          tamano={52}
                          grosor={5}
                        />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          {/* ------------------------ Desglose ------------------------ */}
          {detalle && perfilDe(detalle.perfilId) && (
            <Card>
              <CardHeader
                title={`Desglose de compatibilidad · ${perfilDe(detalle.perfilId)!.nombre}`}
                subtitle="Contribucion de cada dimension al puntaje final."
                icon={<ArrowUpDown size={16} />}
                action={
                  <Button
                    variante="primario"
                    tamano="sm"
                    onClick={() => generarExplicacion(detalle.perfilId)}
                    cargando={generando}
                  >
                    <Bot size={14} />
                    Explicar con IA
                  </Button>
                }
              />
              <div className="space-y-4 p-5">
                {detalle.desglose.map((d) => {
                  const def = DIMENSIONES.find((x) => x.key === d.key)!
                  return (
                    <div key={d.key}>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-medium text-slate-200">
                          {def.label}
                          <span className="ml-2 font-mono text-[10px] text-slate-500">
                            peso {Math.round(d.peso * 100)}%
                          </span>
                        </span>
                        <span className="font-mono text-slate-300">
                          {Math.round(d.valor * 100)}% →{' '}
                          <span className="text-brand-300">
                            +{Math.round(d.contribucion * 1000) / 1000}
                          </span>
                        </span>
                      </div>
                      <Progress valor={d.valor} className="mt-1.5" />
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                        {d.detalle}
                      </p>
                    </div>
                  )
                })}

                <div className="flex items-center justify-between rounded-xl border border-brand-500/25 bg-brand-500/8 px-4 py-3">
                  <span className="text-sm font-semibold text-slate-100">
                    Puntaje de compatibilidad
                  </span>
                  <span className="text-xl font-bold gradient-text">
                    {Math.round(detalle.puntaje * 100)}%
                  </span>
                </div>

                <Link to={`/jugador/${detalle.perfilId}`}>
                  <Button variante="secundario" tamano="sm" className="w-full">
                    Ver perfil completo del jugador
                  </Button>
                </Link>
              </div>
            </Card>
          )}

          {/* ------------------------ Explicacion ------------------------ */}
          {(generando || explicacion) && (
            <Card className="border-brand-500/25">
              <CardHeader
                title="Explicacion en lenguaje natural"
                subtitle="Generada por un modelo Transformer anclado en fuentes recuperadas en tiempo real."
                icon={<Bot size={16} />}
                action={
                  explicacion && (
                    <Badge tono="violeta">
                      <BookOpen size={10} />
                      Grounding verificado
                    </Badge>
                  )
                }
              />
              <div className="p-5">
                {generando ? (
                  <div className="space-y-3">
                    <div className="skeleton h-4 w-full rounded" />
                    <div className="skeleton h-4 w-11/12 rounded" />
                    <div className="skeleton h-4 w-9/12 rounded" />
                    <div className="skeleton h-24 w-full rounded-xl" />
                    <p className="flex items-center gap-2 pt-1 text-[11px] text-slate-500">
                      <Cpu size={12} className="animate-pulse" />
                      Recuperando fuentes externas y redactando la justificacion...
                    </p>
                  </div>
                ) : (
                  explicacion && (
                    <div className="space-y-5">
                      <p className="text-sm leading-relaxed text-slate-300">
                        {explicacion.resumen}
                      </p>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                            <CheckCircle2 size={13} />
                            Fortalezas
                          </p>
                          <ul className="space-y-1.5">
                            {explicacion.fortalezas.map((f, i) => (
                              <li
                                key={i}
                                className="flex gap-2 text-[11px] leading-relaxed text-slate-400"
                              >
                                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-emerald-400" />
                                {f}
                              </li>
                            ))}
                            {explicacion.fortalezas.length === 0 && (
                              <li className="text-[11px] text-slate-500">
                                Sin fortalezas destacables.
                              </li>
                            )}
                          </ul>
                        </div>
                        <div>
                          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                            <TriangleAlert size={13} />
                            Riesgos y limitantes
                          </p>
                          <ul className="space-y-1.5">
                            {explicacion.riesgos.map((f, i) => (
                              <li
                                key={i}
                                className="flex gap-2 text-[11px] leading-relaxed text-slate-400"
                              >
                                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-amber-400" />
                                {f}
                              </li>
                            ))}
                            {explicacion.riesgos.length === 0 && (
                              <li className="text-[11px] text-slate-500">
                                Sin riesgos relevantes detectados.
                              </li>
                            )}
                          </ul>
                        </div>
                      </div>

                      <div>
                        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                          <BookOpen size={13} />
                          Fuentes consultadas (grounding)
                        </p>
                        <div className="space-y-2">
                          {explicacion.grounding.map((g) => (
                            <div
                              key={g.url}
                              className="rounded-lg border border-white/8 bg-white/3 p-3"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[11px] font-medium text-accent-400">
                                  {g.etiqueta}
                                </p>
                                <a
                                  href={g.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="truncate font-mono text-[10px] text-slate-600 underline-offset-2 hover:text-brand-300 hover:underline"
                                >
                                  {g.url}
                                </a>
                              </div>
                              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                                {g.detalle}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <p className="border-t border-white/6 pt-3 font-mono text-[10px] text-slate-600">
                        {explicacion.modelo} · generado{' '}
                        {new Date(explicacion.generadoEn).toLocaleTimeString('es-CO')} ·
                        latencia {explicacion.latenciaMs} ms · calculo numerico
                        delegado al sandbox de Python
                      </p>
                    </div>
                  )
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      <SectionTitle
        title="Metodologia del puntaje"
        subtitle="Como se interpreta el ranking"
      />
      <Card className="p-5">
        <p className="text-sm leading-relaxed text-slate-400">
          El puntaje de compatibilidad entre un jugador j y una oferta o se calcula
          como el promedio ponderado de cinco dimensiones normalizadas en el
          intervalo [0, 1]:{' '}
          <span className="font-mono text-brand-300">
            S(j, o) = Σ wk · dk(j, o), con Σ wk = 1
          </span>
          . Los pesos los configura el equipo que publica la vacante, de modo que
          cada organizacion puede priorizar las dimensiones segun su estrategia de
          reclutamiento.
        </p>
      </Card>

      <Modal
        abierto={modalPostular}
        onCerrar={() => setModalPostular(false)}
        titulo="Postular a la vacante"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-white/8 bg-white/3 p-3 text-xs text-slate-400">
            <p className="font-medium text-slate-200">{oferta.rol} · {oferta.juego}</p>
            <p className="mt-1">{equipo?.nombre}</p>
          </div>
          <Textarea
            rows={5}
            value={mensajePostulacion}
            onChange={(e) => setMensajePostulacion(e.target.value)}
            placeholder="Cuentanos por que encajas en este rol. El equipo vera las estadisticas verificadas de tu perfil junto a este mensaje."
          />
          <div className="flex justify-end gap-2">
            <Button variante="fantasma" onClick={() => setModalPostular(false)}>
              Cancelar
            </Button>
            <Button onClick={enviarPostulacion}>Enviar postulacion</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
