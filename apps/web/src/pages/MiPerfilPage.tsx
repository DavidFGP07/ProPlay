import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BadgeCheck,
  Briefcase,
  Clock,
  Eye,
  EyeOff,
  Gamepad2,
  Link2,
  Lock,
  MapPin,
  Plane,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
} from 'lucide-react'
import { MACROREGION_POR_DEPARTAMENTO, type PerfilJugadorRespuesta } from '@proplay/shared'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  Progress,
  Select,
  Sparkline,
  Tabs,
  cn,
} from '@/components/ui'
import { MarcaDatosDemo } from '@/components/AvisoDatosDemo'
import { DatosProfesionales } from '@/components/DatosProfesionales'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useIdentidad } from '@/api/identidad'
import { useMarcarTodasLeidas, useNotificaciones } from '@/api/notificaciones'
import { useMisPostulaciones, type PostulacionConOferta } from '@/api/ofertas'
import {
  useActualizarPrivacidad,
  useDesvincularCuenta,
  useEliminarHabilidad,
  useHabilidades,
  usePerfil,
  usePerfilPropio,
  usePrivacidad,
  useRegistrarHabilidad,
  useVincularCuenta,
} from '@/api/perfiles'
import { es } from '@/i18n/es'
import { lugar } from '@/lib/ubicacion'
import type {
  ConfiguracionPrivacidad,
  CuentaGaming,
  Endorsement,
  Estadistica,
  Habilidad,
  HabilidadJugador,
  PerfilJugador,
  PlataformaJuego,
  Postulacion,
} from '@/mocks/modelos'

const t = es.miPerfil

type Pestana = 'datos' | 'cuentas' | 'habilidades' | 'portafolio' | 'postulaciones' | 'privacidad'

// RF-05 · Mi perfil. La cabecera y los datos profesionales son reales
// (GET /perfiles/me y PATCH /perfiles/jugador). Cuentas, habilidades,
// portafolio, postulaciones, privacidad y los laterales dependen de otros
// modulos: siguen simulados, cada seccion con su marca de demostracion, y
// desaparecen con el puente apagado.
export default function MiPerfilPage() {
  const { usuario } = useAuth()
  const propio = usePerfilPropio()

  if (!usuario) return null

  if (propio.isPending) {
    return (
      <div aria-busy="true" aria-label={t.cargando} className="space-y-4">
        <div className="skeleton h-40 rounded-2xl" />
        <div className="skeleton h-96 rounded-2xl" />
      </div>
    )
  }

  if (propio.isError) {
    return (
      <Card>
        <div role="alert">
          <EmptyState
            icono={<RotateCcw size={22} />}
            titulo={t.errorCarga}
            descripcion={t.errorCargaDetalle}
            action={
              <Button variante="secundario" onClick={() => void propio.refetch()}>
                <RotateCcw size={13} aria-hidden />
                {es.comun.reintentar}
              </Button>
            }
          />
        </div>
      </Card>
    )
  }

  if (propio.data.tipo !== 'JUGADOR') {
    return (
      <Card>
        <EmptyState
          icono={<Gamepad2 size={22} />}
          titulo={t.sinPerfil}
          descripcion={t.sinPerfilDetalle}
        />
      </Card>
    )
  }

  return <Perfil nombre={usuario.nombre} perfil={propio.data.perfil} />
}

function Perfil({ nombre, perfil }: { nombre: string; perfil: PerfilJugadorRespuesta }) {
  const { notificar } = useToast()
  const [pestana, setPestana] = useState<Pestana>('datos')

  // Secciones simuladas: con el puente apagado, la consulta no corre o
  // devuelve null y la vista se queda solo con lo real.
  const identidad = useIdentidad()
  const demoId = identidad.data?.perfilJugadorId
  const { data: demo = null } = usePerfil(demoId)
  const { data: catalogo = [] } = useHabilidades()
  const { data: postulaciones = [] } = useMisPostulaciones(demoId)
  const { data: config = null } = usePrivacidad()
  const { data: notificaciones = [] } = useNotificaciones()
  const privacidad = useActualizarPrivacidad()
  const marcarTodas = useMarcarTodasLeidas()

  const tabs: { id: Pestana; label: string; badge?: number }[] = [
    { id: 'datos', label: t.pestanaDatos },
    ...(demo
      ? [
          { id: 'cuentas' as const, label: 'Cuentas de juego', badge: demo.cuentas.length },
          { id: 'habilidades' as const, label: 'Habilidades', badge: demo.skills.length },
          { id: 'portafolio' as const, label: 'Portafolio', badge: demo.perfil.portafolio.length },
          { id: 'postulaciones' as const, label: 'Postulaciones', badge: postulaciones.length },
          { id: 'privacidad' as const, label: 'Privacidad' },
        ]
      : []),
  ]
  const activa = tabs.some((tab) => tab.id === pestana) ? pestana : 'datos'

  return (
    <div className="space-y-6">
      {/* ------------------------------ Cabecera ------------------------------ */}
      <Card className="relative overflow-hidden">
        <div className="grid-bg absolute inset-0 opacity-30" aria-hidden />
        <div
          className="absolute -left-16 -top-20 size-64 rounded-full bg-brand-600/20 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
          {perfil.avatarUrl ? (
            <img
              src={perfil.avatarUrl}
              alt=""
              className="size-24 shrink-0 rounded-full object-cover"
            />
          ) : (
            <Avatar nombre={nombre} size="xl" />
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight break-words text-slate-50">
                {nombre}
              </h1>
              <Badge tono="violeta">
                <BadgeCheck size={11} aria-hidden />
                {t.perfilProfesional}
              </Badge>
              {perfil.departamento && (
                <Badge tono="cian">
                  {es.macrorregion[MACROREGION_POR_DEPARTAMENTO[perfil.departamento]]}
                </Badge>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <MapPin size={13} className="text-slate-500" aria-hidden />
                {perfil.pais ? lugar(perfil.pais, perfil.departamento) : t.sinUbicacion}
              </span>
              {perfil.disponibilidadHoras !== null && (
                <span className="flex items-center gap-1.5">
                  <Clock size={13} className="text-slate-500" aria-hidden />
                  {t.horasSemana(perfil.disponibilidadHoras)}
                </span>
              )}
              {perfil.dispuestoRelocalizar && (
                <span className="flex items-center gap-1.5">
                  <Plane size={13} className="text-slate-500" aria-hidden />
                  {t.relocalizable}
                </span>
              )}
            </div>
          </div>

          <Link
            to={`/jugador/${perfil.id}`}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 self-start rounded-lg border border-white/12 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-brand-500/50 hover:bg-white/8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 sm:self-center"
          >
            <Eye size={13} aria-hidden />
            {t.verPublico}
          </Link>
        </div>
      </Card>

      <div className={cn('grid gap-6', demo && 'lg:grid-cols-[1fr_320px]')}>
        <div className="min-w-0 space-y-6">
          <Card>
            {tabs.length > 1 ? (
              <Tabs tabs={tabs} activa={activa} onChange={(id) => setPestana(id as Pestana)} />
            ) : (
              <CardHeader title={t.pestanaDatos} subtitle={t.datosSubtitulo} />
            )}

            <div className="p-5">
              {activa === 'datos' && <DatosProfesionales perfil={perfil} />}

              {demo && activa !== 'datos' && <MarcaDatosDemo />}

              {demo && activa === 'cuentas' && (
                <CuentasPanel
                  perfilId={demo.perfil.id}
                  cuentas={demo.cuentas}
                  onCambio={() => notificar('Cuentas de juego actualizadas.')}
                />
              )}

              {demo && activa === 'habilidades' && (
                <HabilidadesPanel
                  perfilId={demo.perfil.id}
                  skills={demo.skills}
                  endoses={demo.endoses}
                  catalogo={catalogo}
                  onCambio={() => notificar('Habilidades actualizadas.')}
                />
              )}

              {demo && activa === 'portafolio' && (
                <PortafolioPanel perfil={demo.perfil} stats={demo.stats} />
              )}

              {demo && activa === 'postulaciones' && (
                <PostulacionesPanel postulaciones={postulaciones} />
              )}

              {demo && activa === 'privacidad' && config && (
                <PrivacidadPanel
                  config={config}
                  onCambio={async (cambios) => {
                    await privacidad.mutateAsync(cambios)
                    notificar('Preferencias de privacidad guardadas.')
                  }}
                />
              )}
            </div>
          </Card>
        </div>

        {/* ------------------------- Lateral simulado ------------------------- */}
        {demo && (
          <div className="space-y-6">
            <ResumenEvidencia stats={demo.stats} skills={demo.skills} cuentas={demo.cuentas} />

            <Card>
              <CardHeader
                title="Notificaciones"
                subtitle={`${notificaciones.filter((n) => !n.leida).length} sin leer`}
                icon={<TrendingUp size={16} />}
              />
              <div className="space-y-2 p-3">
                <MarcaDatosDemo />
                {notificaciones.length === 0 ? (
                  <p className="px-2 py-4 text-center text-xs text-slate-500">
                    Sin eventos por ahora.
                  </p>
                ) : (
                  notificaciones.slice(0, 6).map((n) => (
                    <div
                      key={n.id}
                      className={cn(
                        'rounded-lg border px-3 py-2.5',
                        n.leida
                          ? 'border-white/6 bg-white/3'
                          : 'border-brand-500/25 bg-brand-500/8',
                      )}
                    >
                      <p className="text-[11px] font-medium text-slate-200">{n.titulo}</p>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
                        {n.detalle}
                      </p>
                    </div>
                  ))
                )}
                {notificaciones.some((n) => !n.leida) && (
                  <div className="flex justify-end">
                    <Button variante="fantasma" tamano="sm" onClick={() => marcarTodas.mutate()}>
                      Marcar leidas
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

/* =========================== Lateral: evidencia =========================== */

function ResumenEvidencia({
  stats,
  skills,
  cuentas,
}: {
  stats: Estadistica[]
  skills: HabilidadJugador[]
  cuentas: CuentaGaming[]
}) {
  const confiabilidad = stats.length
    ? stats.filter((s) => s.fuente.startsWith('api-')).length / stats.length
    : 0
  const validadas = skills.filter((s) => s.verificada).length

  return (
    <Card>
      <CardHeader
        title="Resumen de evidencia"
        subtitle="Que parte de tu perfil es verificable."
        icon={<ShieldCheck size={16} />}
      />
      <div className="space-y-4 p-5">
        <MarcaDatosDemo />
        <div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Datos de la API oficial</span>
            <span className="font-mono text-slate-200">{Math.round(confiabilidad * 100)}%</span>
          </div>
          <Progress valor={confiabilidad} className="mt-1.5" />
        </div>
        <div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Habilidades validadas</span>
            <span className="font-mono text-slate-200">
              {validadas}/{skills.length}
            </span>
          </div>
          <Progress
            valor={skills.length ? validadas / skills.length : 0}
            className="mt-1.5"
            barClassName="bg-gradient-to-r from-emerald-500 to-accent-500"
          />
        </div>
        <div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Cuentas vinculadas</span>
            <span className="font-mono text-slate-200">{cuentas.length}/2</span>
          </div>
          <Progress
            valor={cuentas.length / 2}
            className="mt-1.5"
            barClassName="bg-gradient-to-r from-cyan-500 to-blue-500"
          />
        </div>
      </div>
    </Card>
  )
}

/* ============================ Pestaña: cuentas ============================ */

function CuentasPanel({
  perfilId,
  cuentas,
  onCambio,
}: {
  perfilId: string
  cuentas: CuentaGaming[]
  onCambio: () => void
}) {
  const [plataforma, setPlataforma] = useState<PlataformaJuego>('RIOT')
  const [identificador, setIdentificador] = useState('')
  const [error, setError] = useState<string | null>(null)
  const vinculacion = useVincularCuenta()
  const desvinculacion = useDesvincularCuenta()
  const guardando = vinculacion.isPending

  const vinculado = cuentas.some((c) => c.plataforma === plataforma)

  const vincular = async () => {
    setError(null)
    try {
      await vinculacion.mutateAsync({ perfilId, plataforma, identificador })
      setIdentificador('')
      onCambio()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo vincular la cuenta.')
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-brand-500/20 bg-brand-500/6 p-4">
        <p className="text-xs leading-relaxed text-slate-300">
          La vinculacion se realiza mediante <strong>OAuth 2.0</strong> contra la
          API oficial del juego. El token de acceso se almacena cifrado con
          AES-256-GCM y nunca se expone en el cliente: el worker de ingesta es
          el unico que consulta la API con esas credenciales.
        </p>
      </div>

      <div className="space-y-3">
        {cuentas.length === 0 ? (
          <EmptyState
            icono={<Link2 size={22} />}
            titulo="Sin cuentas vinculadas"
            descripcion="Sin una cuenta verificada, tu perfil no puede exhibir estadisticas obtained por ingesta directa y el motor lo penaliza en la dimension tecnica."
          />
        ) : (
          cuentas.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/3 p-4"
            >
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-lg bg-emerald-500/12 text-emerald-300">
                  <Link2 size={16} />
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-100">{es.plataforma[c.plataforma]}</p>
                  <p className="font-mono text-[11px] text-slate-500">
                    {c.identificadorExterno} · verificada el{' '}
                    {c.fechaVerificacion}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tono="verde">
                  <BadgeCheck size={10} />
                  Verificada
                </Badge>
                <Button
                  variante="peligro"
                  tamano="sm"
                  onClick={async () => {
                    await desvinculacion.mutateAsync(c.id)
                    onCambio()
                  }}
                >
                  <Trash2 size={13} />
                  Desvincular
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="rounded-xl border border-white/8 bg-white/3 p-4">
        <p className="mb-3 text-xs font-medium text-slate-300">
          Vincular una nueva cuenta
        </p>
        <div className="grid gap-3 sm:grid-cols-[200px_1fr_auto]">
          <Select
            value={plataforma}
            onChange={(e) =>
              setPlataforma(e.target.value as PlataformaJuego)
            }
          >
            <option value="RIOT">{es.plataforma.RIOT}</option>
            <option value="STEAM">{es.plataforma.STEAM}</option>
          </Select>
          <Input
            value={identificador}
            onChange={(e) => setIdentificador(e.target.value)}
            placeholder={
              plataforma === 'RIOT' ? 'Jugador#TAG' : '76561198...'
            }
            disabled={vinculado}
          />
          <Button
            onClick={vincular}
            cargando={guardando}
            disabled={vinculado || !identificador.trim()}
          >
            <Plus size={14} />
            {vinculado ? 'Ya vinculado' : 'Vincular'}
          </Button>
        </div>
        {error && (
          <p className="mt-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
            {error}
          </p>
        )}
        <p className="mt-2 text-[11px] text-slate-600">
          {plataforma === 'RIOT'
            ? 'En el flujo real, este paso redirige al formulario de consentimiento de Riot Games y vuelve con un token de alcance restringido.'
            : 'En el flujo real, este paso redirige a la autorizacion de Steam Web y vuelve con el identificador de la cuenta y sus credenciales de lectura de estadisticas.'}
        </p>
      </div>
    </div>
  )
}

/* ========================== Pestaña: habilidades ========================== */

function HabilidadesPanel({
  perfilId,
  skills,
  endoses,
  catalogo,
  onCambio,
}: {
  perfilId: string
  skills: HabilidadJugador[]
  endoses: Endorsement[]
  catalogo: Habilidad[]
  onCambio: () => void
}) {
  const [habilidadId, setHabilidadId] = useState('')
  const [nivel, setNivel] = useState(3)
  const [error, setError] = useState<string | null>(null)
  const registro = useRegistrarHabilidad()
  const eliminacion = useEliminarHabilidad()
  const guardando = registro.isPending

  const disponibles = catalogo.filter(
    (h) => !skills.some((s) => s.habilidadId === h.id),
  )

  const nombreDe = (id: string) => catalogo.find((h) => h.id === id)?.nombre ?? 'Habilidad'

  const agregar = async () => {
    if (!habilidadId) return
    setError(null)
    try {
      await registro.mutateAsync({ perfilId, habilidadId, nivel })
      setHabilidadId('')
      setNivel(3)
      onCambio()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar la habilidad.')
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-xs leading-relaxed text-slate-500">
        Las habilidades se declaran por el jugador, pero solo se convierten en
        evidencia cuando un tercero las valida con un endorsement. Sin
        validacion, la dimension de habilidades blandas del matching no las
        computa.
      </p>

      <div className="space-y-3">
        {skills.length === 0 ? (
          <EmptyState
            icono={<BadgeCheck size={22} />}
            titulo="Sin habilidades registradas"
            descripcion="Registra tus competencias tecnicas y blandas para que los equipos puedan validarlas."
          />
        ) : (
          skills.map((s) => {
            const endo = endoses.find((e) => e.habilidadJugadorId === s.id)
            return (
              <div
                key={s.id}
                className="rounded-xl border border-white/8 bg-white/3 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {s.verificada ? (
                      <BadgeCheck size={15} className="text-emerald-400" />
                    ) : (
                      <Lock size={14} className="text-slate-600" />
                    )}
                    <span className="text-sm font-medium text-slate-100">
                      {nombreDe(s.habilidadId)}
                    </span>
                    <Badge tono={s.verificada ? 'verde' : 'ambar'}>
                      {s.verificada ? 'Validada' : 'Sin validar'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[11px] text-slate-500">
                      nivel {s.nivel}/5
                    </span>
                    <Button
                      variante="fantasma"
                      tamano="sm"
                      onClick={async () => {
                        await eliminacion.mutateAsync(s.id)
                        onCambio()
                      }}
                      title="Eliminar habilidad"
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>
                <Progress
                  valor={s.nivel / 5}
                  className="mt-2"
                  barClassName={
                    s.verificada
                      ? 'bg-gradient-to-r from-emerald-500 to-accent-500'
                      : 'from-slate-600 to-slate-500'
                  }
                />
                {endo && (
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                    "{endo.comentario}" — {endo.autorNombre}, {endo.fecha}
                  </p>
                )}
              </div>
            )
          })
        )}
      </div>

      <div className="rounded-xl border border-white/8 bg-white/3 p-4">
        <p className="mb-3 text-xs font-medium text-slate-300">
          Registrar una habilidad
        </p>
        <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto]">
          <Select value={habilidadId} onChange={(e) => setHabilidadId(e.target.value)}>
            <option value="">Selecciona una habilidad...</option>
            {disponibles.map((h) => (
              <option key={h.id} value={h.id}>
                {h.nombre} ({h.categoria})
              </option>
            ))}
          </Select>
          <Select value={nivel} onChange={(e) => setNivel(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                Nivel {n}
              </option>
            ))}
          </Select>
          <Button onClick={agregar} cargando={guardando} disabled={!habilidadId}>
            <Plus size={14} />
            Agregar
          </Button>
        </div>
        {error && (
          <p className="mt-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
            {error}
          </p>
        )}
        {disponibles.length === 0 && skills.length > 0 && (
          <p className="mt-2 text-[11px] text-slate-600">
            Ya registraste todas las habilidades del catalogo disponible.
          </p>
        )}
      </div>
    </div>
  )
}

/* ========================== Pestaña: portafolio =========================== */

function PortafolioPanel({
  perfil,
  stats,
}: {
  perfil: PerfilJugador
  stats: Estadistica[]
}) {
  const statPrincipal = stats[0]

  return (
    <div className="space-y-5">
      {statPrincipal && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-white/8 bg-white/3 p-4">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">
              Win rate
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-50">
              {Math.round(statPrincipal.winRate * 100)}%
            </p>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/3 p-4">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">
              KDA promedio
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-50">
              {statPrincipal.kda.toFixed(2)}
            </p>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/3 p-4">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">
              Partidas analizadas
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-50">
              {statPrincipal.partidas.toLocaleString('es-CO')}
            </p>
          </div>
        </div>
      )}

      {statPrincipal && (
        <div className="rounded-xl border border-white/8 bg-white/3 p-4">
          <p className="mb-2 text-[10px] uppercase tracking-wide text-slate-500">
            Ultimas 10 partidas
          </p>
          <Sparkline datos={statPrincipal.tendencia} alto={40} />
        </div>
      )}

      {perfil.portafolio.length === 0 ? (
        <EmptyState
          icono={<Gamepad2 size={22} />}
          titulo="Portafolio vacio"
          descripcion="El portafolio se construye automaticamente con las partidas registradas por la ingesta directa."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/8 text-[10px] uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2.5 font-medium">Fecha</th>
                <th className="px-3 py-2.5 font-medium">Juego</th>
                <th className="px-3 py-2.5 font-medium">Mapa</th>
                <th className="px-3 py-2.5 font-medium">Resultado</th>
                <th className="px-3 py-2.5 font-medium">Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {perfil.portafolio.map((p) => (
                <tr key={p.id} className="transition hover:bg-white/3">
                  <td className="px-3 py-2.5 font-mono text-slate-500">
                    {p.fecha}
                  </td>
                  <td className="px-3 py-2.5 text-slate-300">{p.juego}</td>
                  <td className="px-3 py-2.5 text-slate-400">{p.mapa}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <Badge tono={p.resultado === 'victoria' ? 'verde' : 'rojo'}>
                        {p.resultado}
                      </Badge>
                      {p.mvp && <Badge tono="ambar">MVP</Badge>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-slate-300">
                    {p.rating.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ========================= Pestaña: postulaciones ========================= */

function PostulacionesPanel({
  postulaciones,
}: {
  postulaciones: PostulacionConOferta[]
}) {
  const ETIQUETA: Record<Postulacion['estado'], { t: string; tono: 'neutro' | 'violeta' | 'cian' | 'verde' | 'ambar' | 'rojo' }> = {
    ENVIADA: { t: 'Recibida', tono: 'neutro' },
    EN_REVISION: { t: 'En revision', tono: 'cian' },
    ENTREVISTA: { t: 'Entrevista', tono: 'violeta' },
    ACEPTADA: { t: 'Aceptada', tono: 'verde' },
    RECHAZADA: { t: 'Rechazada', tono: 'rojo' },
  }

  return (
    <div className="space-y-4">
      {postulaciones.length === 0 ? (
        <EmptyState
          icono={<Briefcase size={22} />}
          titulo="Sin postulaciones"
          descripcion="Cuando te postules a una vacante, podras seguir aqui el estado del proceso."
          action={
            <Link to="/vacantes">
              <Button variante="secundario" tamano="sm">
                Ver vacantes abiertas
              </Button>
            </Link>
          }
        />
      ) : (
        postulaciones.map(({ postulacion, oferta }) => {
          const estado = ETIQUETA[postulacion.estado]
          return (
            <div
              key={postulacion.id}
              className="rounded-xl border border-white/8 bg-white/3 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-100">
                    {oferta.rol} · {oferta.juego}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Postulado el {postulacion.fecha}
                  </p>
                </div>
                <Badge tono={estado.tono}>{estado.t}</Badge>
              </div>
              <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-slate-400">
                "{postulacion.mensaje}"
              </p>
              <Link
                to={`/vacantes/${oferta.id}`}
                className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-brand-300 transition hover:text-brand-200"
              >
                <Sparkles size={12} />
                Ver elMatching de esta vacante
              </Link>
            </div>
          )
        })
      )}
    </div>
  )
}

/* ========================== Pestaña: privacidad ========================== */

function PrivacidadPanel({
  config,
  onCambio,
}: {
  config: ConfiguracionPrivacidad
  onCambio: (cambios: Partial<Omit<ConfiguracionPrivacidad, 'usuarioId'>>) => Promise<void>
}) {
  const [visibilidad, setVisibilidad] = useState(config.visibilidadPerfil)
  const [estadisticas, setEstadisticas] = useState(config.mostrarEstadisticas)
  const [portafolio, setPortafolio] = useState(config.mostrarPortafolio)
  const [contacto, setContacto] = useState(config.mostrarContacto)
  const [aceptado, setAceptado] = useState(config.avisoPrivacidadAceptado)

  const cambios = useMemo(
    () => ({
      visibilidadPerfil: visibilidad,
      mostrarEstadisticas: estadisticas,
      mostrarPortafolio: portafolio,
      mostrarContacto: contacto,
      avisoPrivacidadAceptado: aceptado,
    }),
    [visibilidad, estadisticas, portafolio, contacto, aceptado],
  )

  const guardar = async () => {
    await onCambio(cambios)
  }

  const opciones: {
    v: ConfiguracionPrivacidad['visibilidadPerfil']
    t: string
    d: string
    icono: typeof Eye
  }[] = [
    {
      v: 'publico',
      t: 'Publico',
      d: 'Cualquier usuario de ProPlay puede ver tu perfil completo.',
      icono: Eye,
    },
    {
      v: 'equipos',
      t: 'Solo equipos y scouts',
      d: 'Los equipos y scouts veran tu perfil; otros usuarios no.',
      icono: EyeOff,
    },
    {
      v: 'privado',
      t: 'Privado',
      d: 'Solo tu ves el perfil. No apareces en el directorio de talento.',
      icono: Lock,
    },
  ]

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-white/8 bg-white/3 p-4">
        <p className="mb-3 text-xs font-medium text-slate-300">
          Visibilidad del perfil
        </p>
        <div className="space-y-2">
          {opciones.map((o) => (
            <label
              key={o.v}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 transition',
                visibilidad === o.v
                  ? 'border-brand-500/40 bg-brand-500/8'
                  : 'border-white/8 bg-white/3 hover:border-white/15',
              )}
            >
              <input
                type="radio"
                name="visibilidad"
                checked={visibilidad === o.v}
                onChange={() => setVisibilidad(o.v)}
                className="mt-0.5 size-4 accent-[#7c4df5]"
              />
              <o.icono size={15} className="mt-0.5 shrink-0 text-slate-400" />
              <span>
                <span className="block text-xs font-medium text-slate-200">
                  {o.t}
                </span>
                <span className="mt-0.5 block text-[11px] text-slate-500">
                  {o.d}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {[
          {
            l: 'Mostrar mis estadisticas verificadas',
            d: 'Si lo desactivas, el motor no podrá evaluar tu dimension tecnica y tu perfil pierde visibilidad en el directorio.',
            v: estadisticas,
            set: setEstadisticas,
          },
          {
            l: 'Mostrar mi portafolio de partidas',
            d: 'El portafolio se construye con los resultados de la ingesta directa.',
            v: portafolio,
            set: setPortafolio,
          },
          {
            l: 'Permitir contacto directo de equipos y scouts',
            d: 'Si lo desactivas, solo puedes ser contactado a traves de postulaciones.',
            v: contacto,
            set: setContacto,
          },
        ].map((o) => (
          <label
            key={o.l}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/8 bg-white/3 px-4 py-3"
          >
            <input
              type="checkbox"
              checked={o.v}
              onChange={(e) => o.set(e.target.checked)}
              className="mt-0.5 size-4 accent-[#7c4df5]"
            />
            <span>
              <span className="block text-xs font-medium text-slate-200">
                {o.l}
              </span>
              <span className="mt-0.5 block text-[11px] text-slate-500">
                {o.d}
              </span>
            </span>
          </label>
        ))}
      </div>

      <div
        className={cn(
          'rounded-xl border p-4',
          aceptado
            ? 'border-emerald-500/25 bg-emerald-500/6'
            : 'border-amber-500/30 bg-amber-500/6',
        )}
      >
        <p className="flex items-center gap-2 text-xs font-medium text-slate-200">
          <ShieldCheck size={14} />
          Aviso de privacidad — Ley 1581 de 2012
        </p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
          ProPlay trata tus datos personales conforme a la Ley 1581 de 2012 y su
          Decreto reglamentario 1074 de 2015. Tienes derecho a conocer, actualizar
          y suprimir tus datos, y a revocar la autorizacion de tratamiento en
          cualquier momento. Las estadisticas de juego se almacenan cifradas y
          solo se utilizan para construir tu perfil profesional.
        </p>
        <label className="mt-3 flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={aceptado}
            onChange={(e) => setAceptado(e.target.checked)}
            className="size-4 accent-[#7c4df5]"
          />
          <span className="text-[11px] text-slate-300">
            Acepto el aviso de privacidad y el tratamiento de mis datos
          </span>
        </label>
        {config.fechaAceptacion && (
          <p className="mt-2 font-mono text-[10px] text-slate-600">
            Aceptado el {config.fechaAceptacion.slice(0, 10)}
          </p>
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={guardar}>
          <Save size={14} />
          Guardar preferencias
        </Button>
      </div>
    </div>
  )
}
