import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Briefcase,
  CheckCircle2,
  Clock,
  Plus,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  UserPlus,
  XCircle,
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
  Modal,
  ScoreRing,
  SectionTitle,
  Select,
  Stat,
  Textarea,
  cn,
} from '@/components/ui'
import { es } from '@/i18n/es'
import { MarcaDatosDemo } from '@/components/AvisoDatosDemo'
import { DatosOrganizacion } from '@/components/DatosOrganizacion'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useIdentidad } from '@/api/identidad'
import { useCandidatos, useJugadores } from '@/api/matching'
import {
  useActualizarEstadoPostulacion,
  useCerrarOferta,
  useCrearOferta,
  usePostulaciones,
  useVacantes,
} from '@/api/ofertas'
import { useEquipos, usePerfilPropio } from '@/api/perfiles'
import { PESOS_POR_DEFECTO } from '@/lib/matching'
import type { Oferta, Postulacion } from '@/mocks/modelos'

const JUEGOS = [
  'League of Legends',
  'Valorant',
  'Counter-Strike 2',
  'Rocket League',
  'Dota 2',
] as const
const REGIONES = [
  'Cualquiera',
  'Barranquilla',
  'Cartagena',
  'Santa Marta',
  'Bogotá',
  'Medellín',
  'Cali',
  'Bucaramanga',
] as const
const RANGOS = [
  'Oro I',
  'Platino I',
  'Diamante I',
  'Ascendente I',
  'Inmortal I',
  'Global Elite',
  'Champions II',
] as const
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
  'Portero',
  'Carry',
  'Flex',
] as const

const ESTADOS: { v: Postulacion['estado']; l: string }[] = (
  ['ENVIADA', 'EN_REVISION', 'ENTREVISTA', 'ACEPTADA', 'RECHAZADA'] as const
).map((v) => ({ v, l: es.estadoPostulacion[v] }))

// RF-13 · Panel del equipo. «Datos de la organización» es real (RF-07); las
// vacantes, procesos, indicadores y recomendaciones siguen simulados, cada
// seccion con su marca de demostracion.
export default function PanelEquipoPage() {
  const { usuario } = useAuth()
  const { notificar } = useToast()
  const { data: ofertas = [] } = useVacantes()
  const { data: postulaciones = [] } = usePostulaciones()
  const { data: jugadores = [] } = useJugadores()
  const { data: perfilesEquipo = [] } = useEquipos()
  const { data: identidad } = useIdentidad()
  const creacion = useCrearOferta()
  const cierre = useCerrarOferta()
  const cambioEstado = useActualizarEstadoPostulacion()
  const [modal, setModal] = useState(false)
  const enviando = creacion.isPending
  const [form, setForm] = useState({
    equipoId: 'e-01-team',
    juego: 'League of Legends' as Oferta['juego'],
    rol: 'Mid lane',
    rangoMinimo: 'Platino I',
    experienciaMinima: 2,
    regionPreferida: 'Cualquiera' as Oferta['regionPreferida'],
    horasSemanales: 24,
    descripcion: '',
    salario: '',
    requisitos: '',
  })

  // El scout consulta los procesos pero no contrata: puede publicar y
  // avanzar estados unicamente la organizacion o el administrador.
  const esScout = usuario?.rol === 'SCOUT'
  const esEquipo = usuario?.rol === 'EQUIPO'
  const puedeGestionar = esEquipo || usuario?.rol === 'ADMIN'
  // Nombre real de la organizacion para el subtitulo; solo el equipo tiene perfil.
  const { data: propio } = usePerfilPropio(esEquipo)
  const nombreOrg = propio?.tipo === 'EQUIPO' ? propio.perfil.nombreOrg : null

  const miEquipo = perfilesEquipo.find((e) => e.id === identidad?.perfilEquipoId)
  const misOfertas = miEquipo
    ? ofertas.filter((o) => o.equipoId === miEquipo.id)
    : ofertas
  const postulacionesDeMisOfertas = postulaciones.filter((p) =>
    misOfertas.some((o) => o.id === p.ofertaId),
  )

  /** Vacante abierta sobre la que se calcula el resumen de recomendaciones. */
  const abiertaPrincipal = misOfertas.find((o) => o.estado === 'ABIERTA')

  // Ranking de la primera vacante abierta de la organizacion, para mostrar
  // los candidatos mejor posicionados sin abrir el detalle.
  const ranking = useCandidatos(abiertaPrincipal?.id, PESOS_POR_DEFECTO)
  const resultadosRanking = abiertaPrincipal ? ranking.data?.resultados : []
  const trazaRanking = abiertaPrincipal ? ranking.data?.traza : null

  const jugadorDe = (id: string) => jugadores.find((j) => j.id === id)

  const publicar = async () => {
    if (!usuario) return
    try {
      await creacion.mutateAsync({
        equipoId: form.equipoId,
        juego: form.juego,
        rol: form.rol,
        rangoMinimo: form.rangoMinimo,
        experienciaMinima: form.experienciaMinima,
        regionPreferida: form.regionPreferida,
        horasSemanales: form.horasSemanales,
        descripcion: form.descripcion || 'Vacante publicada desde el panel de equipo.',
        salario: form.salario || undefined,
        requisitos: form.requisitos
          .split('\n')
          .map((r) => r.trim())
          .filter(Boolean),
      })
      setModal(false)
      notificar('Vacante publicada. El motor de matching ya la incluye en el pool.')
    } catch (e) {
      notificar(
        e instanceof Error ? e.message : 'No se pudo publicar la vacante.',
        'error',
      )
    }
  }

  const cambiarEstado = async (
    id: string,
    estado: Postulacion['estado'],
  ) => {
    if (!usuario) return
    try {
      await cambioEstado.mutateAsync({ id, estado })
      notificar('Estado de la postulacion actualizado.')
    } catch (e) {
      notificar(
        e instanceof Error ? e.message : 'No se pudo actualizar el proceso.',
        'error',
      )
    }
  }

  const cerrar = async (id: string) => {
    if (!usuario) return
    try {
      await cierre.mutateAsync(id)
      notificar('Vacante cerrada.', 'info')
    } catch (e) {
      notificar(
        e instanceof Error ? e.message : 'No se pudo cerrar la vacante.',
        'error',
      )
    }
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        title={esScout ? 'Panel de scouting' : 'Panel de equipo'}
        subtitle={
          nombreOrg
            ? nombreOrg
            : esScout
              ? 'Consulta de vacantes y procesos de seleccion del ecosistema.'
              : 'Gestion de vacantes y procesos de seleccion.'
        }
        action={
          puedeGestionar ? (
            <Button variante="primario" tamano="sm" onClick={() => setModal(true)}>
              <Plus size={14} />
              Publicar vacante
            </Button>
          ) : undefined
        }
      />

      {esScout && (
        <Card className="border-accent-500/25 bg-accent-500/5 p-4">
          <p className="flex items-start gap-2.5 text-xs leading-relaxed text-slate-300">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-accent-400" />
            <span>
              Tu rol de <strong>scout</strong> tiene las mismas capacidades de
              consulta que el equipo: puedes revisar vacantes, procesos y
              rankings de compatibilidad. No puedes publicar oportunidades ni
              avanzar el estado de una postulacion, porque esa facultad
              corresponde a la organizacion que contrata.
            </span>
          </p>
        </Card>
      )}

      {esEquipo && <DatosOrganizacion />}

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

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ---------------------------- Vacantes ---------------------------- */}
        <Card className="min-w-0">
          <CardHeader
            title={esScout ? 'Vacantes del ecosistema' : 'Mis vacantes'}
            subtitle="Ciclo de vida de la oportunidad publicada."
            icon={<Briefcase size={16} />}
          />
          <MarcaDatosDemo className="mx-5 mt-4" />
          {misOfertas.length === 0 ? (
            <EmptyState
              icono={<Briefcase size={22} />}
              titulo="Sin vacantes publicadas"
              descripcion="Publica tu primera oportunidad para activar el motor de matching."
            />
          ) : (
            <ul className="divide-y divide-white/5">
              {misOfertas.map((o) => {
                const n = postulaciones.filter((p) => p.ofertaId === o.id).length
                return (
                  <li
                    key={o.id}
                    className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-100">
                        {o.rol} · {o.juego}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {n} postulaciones · publicada el {o.publicadaEn}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <Badge
                        tono={
                          o.estado === 'ABIERTA'
                            ? 'verde'
                            : o.estado === 'BORRADOR'
                              ? 'ambar'
                              : 'neutro'
                        }
                      >
                        {es.estadoOferta[o.estado]}
                      </Badge>
                      <Link to={`/vacantes/${o.id}`}>
                        <Button variante="secundario" tamano="sm">
                          <Sparkles size={12} />
                          Ranking
                        </Button>
                      </Link>
                      {o.estado === 'ABIERTA' && puedeGestionar && (
                        <Button
                          variante="fantasma"
                          tamano="sm"
                          onClick={() => cerrar(o.id)}
                          title="Cerrar vacante"
                        >
                          <XCircle size={14} />
                        </Button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        {/* ------------------------- Postulaciones ------------------------- */}
        <Card className="min-w-0">
          <CardHeader
            title={esScout ? 'Procesos de las vacantes' : 'Procesos de seleccion'}
            subtitle={
              esScout
                ? 'Candidatos que se postularon. Solo la organizacion puede avanzar el estado.'
                : 'Candidatos que se postularon a tus vacantes.'
            }
            icon={<UserPlus size={16} />}
          />
          <MarcaDatosDemo className="mx-5 mt-4" />
          {postulacionesDeMisOfertas.length === 0 ? (
            <EmptyState
              icono={<UserPlus size={22} />}
              titulo="Sin postulaciones"
              descripcion="Cuando un jugador se postule a una de tus vacantes, aparecera aqui."
            />
          ) : (
            <ul className="divide-y divide-white/5">
              {postulacionesDeMisOfertas.map((p) => {
                const jugador = jugadorDe(p.perfilId)
                const oferta = misOfertas.find((o) => o.id === p.ofertaId)
                return (
                  <li key={p.id} className="px-5 py-3.5">
                    <div className="flex items-start gap-3">
                      {jugador && <Avatar nombre={jugador.nombre} size="sm" />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-100">
                          {jugador?.nombre ?? p.perfilId}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-slate-500">
                          {oferta?.rol} · {oferta?.juego} · {p.fecha}
                        </p>
                        <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-slate-400">
                          "{p.mensaje}"
                        </p>
                      </div>
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2 pl-12">
                      {puedeGestionar ? (
                        ESTADOS.map((e) => (
                          <button
                            key={e.v}
                            type="button"
                            onClick={() => cambiarEstado(p.id, e.v)}
                            className={cn(
                              'rounded-md px-2 py-1 text-[10px] font-medium transition',
                              p.estado === e.v
                                ? 'bg-brand-500/25 text-brand-200'
                                : 'bg-white/5 text-slate-500 hover:bg-white/10 hover:text-slate-300',
                            )}
                          >
                            {e.l}
                          </button>
                        ))
                      ) : (
                        <Badge tono="cian">{es.estadoPostulacion[p.estado]}</Badge>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
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

      {/* ------------------------------ Modal ------------------------------ */}
      <Modal
        abierto={modal}
        onCerrar={() => setModal(false)}
        titulo="Publicar nueva vacante"
      >
        <div className="space-y-4">
          <Field label="Equipo">
            <Select
              value={form.equipoId}
              onChange={(e) => setForm((f) => ({ ...f, equipoId: e.target.value }))}
            >
              {perfilesEquipo.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Juego">
              <Select
                value={form.juego}
                onChange={(e) =>
                  setForm((f) => ({ ...f, juego: e.target.value as Oferta['juego'] }))
                }
              >
                {JUEGOS.map((j) => (
                  <option key={j} value={j}>
                    {j}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Rol">
              <Select
                value={form.rol}
                onChange={(e) => setForm((f) => ({ ...f, rol: e.target.value }))}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Rango minimo">
              <Select
                value={form.rangoMinimo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, rangoMinimo: e.target.value }))
                }
              >
                {RANGOS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Region preferida">
              <Select
                value={form.regionPreferida}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    regionPreferida: e.target.value as Oferta['regionPreferida'],
                  }))
                }
              >
                {REGIONES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Horas semanales">
              <Input
                type="number"
                min={1}
                max={60}
                value={form.horasSemanales}
                onChange={(e) =>
                  setForm((f) => ({ ...f, horasSemanales: Number(e.target.value) }))
                }
              />
            </Field>
            <Field label="Experiencia minima (anos)">
              <Input
                type="number"
                min={0}
                max={10}
                value={form.experienciaMinima}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    experienciaMinima: Number(e.target.value),
                  }))
                }
              />
            </Field>
          </div>
          <Field label="Descripcion de la vacante">
            <Textarea
              rows={4}
              value={form.descripcion}
              onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
              placeholder="Describe el rol, los requisitos y lo que ofrece el equipo."
            />
          </Field>
          <Field label="Salario o contraprestacion (opcional)">
            <Input
              value={form.salario}
              onChange={(e) => setForm((f) => ({ ...f, salario: e.target.value }))}
              placeholder="COP 1.800.000 + bonificaciones"
            />
          </Field>
          <Field
            label="Requisitos"
            hint="Uno por linea. Se muestran como lista en la vacante."
          >
            <Textarea
              rows={4}
              value={form.requisitos}
              onChange={(e) =>
                setForm((f) => ({ ...f, requisitos: e.target.value }))
              }
              placeholder={'Ranked minimo Platino I\nWin rate sobre 55 %\nDisponibilidad para scrims'}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variante="fantasma" onClick={() => setModal(false)}>
              Cancelar
            </Button>
            <Button onClick={publicar} cargando={enviando}>
              <CheckCircle2 size={14} />
              Publicar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
