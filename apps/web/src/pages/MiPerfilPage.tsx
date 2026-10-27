import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BadgeCheck,
  Briefcase,
  Eye,
  EyeOff,
  Gamepad2,
  Link2,
  Lock,
  MapPin,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
} from 'lucide-react'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Progress,
  ScoreRing,
  Select,
  Sparkline,
  Tabs,
  Textarea,
  cn,
} from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { TarjetaUbicacion } from '@/components/TarjetaUbicacion'
import { useIdentidad } from '@/api/identidad'
import { useMarcarTodasLeidas, useNotificaciones } from '@/api/notificaciones'
import { useMisPostulaciones, type PostulacionConOferta } from '@/api/ofertas'
import {
  useActualizarPerfil,
  useActualizarPrivacidad,
  useDesvincularCuenta,
  useEliminarHabilidad,
  useHabilidades,
  usePerfil,
  usePrivacidad,
  useRegistrarHabilidad,
  type CamposPerfil,
  useVincularCuenta,
} from '@/api/perfiles'
import { es } from '@/i18n/es'
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

const ROLES = [
  'Top lane',
  'Jungle',
  'Mid lane',
  'Bot lane',
  'Support',
  'Duelista',
  'Iniciador',
  'Controlador',
  'Sentinel',
  'AWPer',
  'IGL',
  'Supporto',
  'Portero',
  'Carry',
  'Flex',
] as const

type Pestana = 'datos' | 'cuentas' | 'habilidades' | 'portafolio' | 'postulaciones' | 'privacidad'

export default function MiPerfilPage() {
  const { usuario } = useAuth()
  const { notificar } = useToast()

  const [pestana, setPestana] = useState<Pestana>('datos')

  const identidad = useIdentidad()
  const perfilId = identidad.data?.perfilJugadorId
  const consulta = usePerfil(perfilId)
  const { data: catalogo = [] } = useHabilidades()
  const { data: postulaciones = [] } = useMisPostulaciones(perfilId)
  const { data: config = null } = usePrivacidad()
  const { data: notificaciones = [] } = useNotificaciones()
  const edicion = useActualizarPerfil()
  const privacidad = useActualizarPrivacidad()
  const marcarTodas = useMarcarTodasLeidas()
  const datos = consulta.data ?? null
  const cargando = identidad.isLoading || consulta.isLoading

  if (!usuario) return null

  // Dato real de la cuenta: se muestra aunque el puente de demostracion este
  // apagado y la vista no tenga nada mas que ensenar.
  const ubicacion = usuario.rol === 'JUGADOR' ? <TarjetaUbicacion /> : null

  if (identidad.isLoading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-44 rounded-2xl" />
        {ubicacion}
        <div className="skeleton h-96 rounded-2xl" />
      </div>
    )
  }

  if (!perfilId) {
    if (ubicacion) return <div className="space-y-6">{ubicacion}</div>
    return (
      <Card>
        <EmptyState
          icono={<Gamepad2 size={22} />}
          titulo="Tu cuenta no tiene un perfil de jugador"
          descripcion="El perfil profesional solo aplica a cuentas de tipo jugador. Como equipo o scout, usa el panel correspondiente."
        />
      </Card>
    )
  }

  if (cargando || !datos) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-44 rounded-2xl" />
        {ubicacion}
        <div className="skeleton h-96 rounded-2xl" />
      </div>
    )
  }

  const { perfil, stats, cuentas, skills, endoses } = datos
  const statsVerificadas = stats.filter((s) => s.fuente.startsWith('api-')).length
  const confiabilidad = stats.length ? statsVerificadas / stats.length : 0
  const noLeidas = notificaciones.filter((n) => !n.leida).length

  const tabs: { id: string; label: string; badge?: number }[] = [
    { id: 'datos', label: 'Datos profesionales' },
    { id: 'cuentas', label: 'Cuentas de juego', badge: cuentas.length },
    { id: 'habilidades', label: 'Habilidades', badge: skills.length },
    { id: 'portafolio', label: 'Portafolio', badge: perfil.portafolio.length },
    { id: 'postulaciones', label: 'Postulaciones', badge: postulaciones.length },
    { id: 'privacidad', label: 'Privacidad' },
  ]

  return (
    <div className="space-y-6">
      {/* ------------------------------ Cabecera ------------------------------ */}
      <Card className="relative overflow-hidden">
        <div className="grid-bg absolute inset-0 opacity-30" />
        <div className="absolute -left-16 -top-20 size-64 rounded-full bg-brand-600/20 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-6 p-6">
          <Avatar nombre={perfil.nombre} size="xl" />

          <div className="min-w-[16rem] flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-50">
                {perfil.nombre}
              </h1>
              <Badge tono="violeta">
                <BadgeCheck size={11} />
                Perfil profesional
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
                <Gamepad2 size={13} className="text-slate-500" />
                {perfil.rolesPreferidos.join(' · ')}
              </span>
              <span className="flex items-center gap-1.5">
                <Briefcase size={13} className="text-slate-500" />
                {perfil.aniosExperiencia} anos de experiencia
              </span>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-center gap-3">
            <ScoreRing
              valor={confiabilidad}
              tamano={92}
              grosor={8}
              etiqueta="verificacion"
            />
            <Link to={`/jugador/${perfil.id}`}>
              <Button variante="secundario" tamano="sm">
                Ver como lo ven los equipos
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      {ubicacion}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <Tabs tabs={tabs} activa={pestana} onChange={(id) => setPestana(id as Pestana)} />

            <div className="p-5">
              {pestana === 'datos' && (
                <DatosPanel
                  perfil={perfil}
                  onGuardar={async (cambios) => {
                    await edicion.mutateAsync({ perfilId: perfil.id, cambios })
                    notificar('Perfil actualizado. El vector de perfil se recalculó.')
                  }}
                />
              )}

              {pestana === 'cuentas' && (
                <CuentasPanel
                  perfilId={perfil.id}
                  cuentas={cuentas}
                  onCambio={() => notificar('Cuentas de juego actualizadas.')}
                />
              )}

              {pestana === 'habilidades' && (
                <HabilidadesPanel
                  perfilId={perfil.id}
                  skills={skills}
                  endoses={endoses}
                  catalogo={catalogo}
                  onCambio={() => notificar('Habilidades actualizadas.')}
                />
              )}

              {pestana === 'portafolio' && <PortafolioPanel perfil={perfil} stats={stats} />}

              {pestana === 'postulaciones' && (
                <PostulacionesPanel postulaciones={postulaciones} />
              )}

              {pestana === 'privacidad' && config && (
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

        {/* ------------------------------ Lateral ------------------------------ */}
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Resumen de evidencia"
              subtitle="Que parte de tu perfil es verificable."
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
                  <span className="text-slate-400">Habilidades validadas</span>
                  <span className="font-mono text-slate-200">
                    {skills.filter((s) => s.verificada).length}/{skills.length}
                  </span>
                </div>
                <Progress
                  valor={skills.length ? skills.filter((s) => s.verificada).length / skills.length : 0}
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

          <Card>
            <CardHeader
              title="Notificaciones"
              subtitle={`${noLeidas} sin leer`}
              icon={<TrendingUp size={16} />}
              action={
                noLeidas > 0 ? (
                  <Button
                    variante="fantasma"
                    tamano="sm"
                    onClick={() => marcarTodas.mutate()}
                  >
                    Marcar leidas
                  </Button>
                ) : undefined
              }
            />
            <div className="space-y-2 p-3">
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
                    <p className="text-[11px] font-medium text-slate-200">
                      {n.titulo}
                    </p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
                      {n.detalle}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

/* ============================== Pestaña: datos ============================= */

function DatosPanel({
  perfil,
  onGuardar,
}: {
  perfil: PerfilJugador
  onGuardar: (cambios: CamposPerfil) => Promise<void>
}) {
  const [biografia, setBiografia] = useState(perfil.biografia)
  const [horas, setHoras] = useState(perfil.horasDisponibles)
  const [anios, setAnios] = useState(perfil.aniosExperiencia)
  const [roles, setRoles] = useState<string[]>(perfil.rolesPreferidos)
  const [equipos, setEquipos] = useState(perfil.equiposAnteriores.join(', '))
  const [guardando, setGuardando] = useState(false)

  const alternarRol = (rol: string) =>
    setRoles((r) =>
      r.includes(rol) ? r.filter((x) => x !== rol) : [...r, rol],
    )

  const guardar = async () => {
    setGuardando(true)
    try {
      await onGuardar({
        biografia: biografia.trim(),
        horasDisponibles: horas,
        aniosExperiencia: anios,
        rolesPreferidos: roles.length ? roles : ['Flex'],
        equiposAnteriores: equipos
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean),
      })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Horas disponibles por semana">
          <Input
            type="number"
            min={0}
            max={60}
            value={horas}
            onChange={(e) => setHoras(Number(e.target.value))}
          />
        </Field>
        <Field label="Anios de experiencia competitiva">
          <Input
            type="number"
            min={0}
            max={20}
            value={anios}
            onChange={(e) => setAnios(Number(e.target.value))}
          />
        </Field>
        <Field label="Equipos anteriores" hint="Separados por coma.">
          <Input
            value={equipos}
            onChange={(e) => setEquipos(e.target.value)}
            placeholder="Lobos del Caribe, Nautilus Gaming"
          />
        </Field>
      </div>

      <Field label="Biografia profesional">
        <Textarea
          rows={4}
          value={biografia}
          onChange={(e) => setBiografia(e.target.value)}
          placeholder="Describe tu trayectoria, el juego en el que compites y lo que buscas."
        />
      </Field>

      <div>
        <p className="mb-2 text-xs font-medium text-slate-400">
          Roles preferidos
        </p>
        <div className="flex flex-wrap gap-2">
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => alternarRol(r)}
              className={cn(
                'rounded-full border px-3 py-1 text-[11px] font-medium transition',
                roles.includes(r)
                  ? 'border-brand-500/50 bg-brand-500/15 text-brand-200'
                  : 'border-white/10 bg-white/4 text-slate-400 hover:border-white/20 hover:text-slate-200',
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>


      <div className="flex justify-end">
        <Button onClick={guardar} cargando={guardando}>
          <Save size={14} />
          Guardar cambios
        </Button>
      </div>

      <p className="text-[11px] leading-relaxed text-slate-600">
        Los datos declarados no alimentan el puntaje de compatibilidad como
        evidencia: el motor los usa solo como contexto, mientras que las
        estadisticas de juego provienen de la ingesta directa.
      </p>
    </div>
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
