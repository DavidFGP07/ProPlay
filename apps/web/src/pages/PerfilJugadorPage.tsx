import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import axios from 'axios'
import {
  BadgeCheck,
  BarChart3,
  Gamepad2,
  MapPin,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UserX,
} from 'lucide-react'
import {
  MACROREGION_POR_DEPARTAMENTO,
  type PerfilJugadorPublico,
} from '@proplay/shared'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  SectionTitle,
} from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { esNoEncontrado, usePerfilPublico } from '@/api/perfiles'
import { es } from '@/i18n/es'
import { lugar } from '@/lib/ubicacion'

const t = es.perfilPublico

const formatoFecha = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long' })

/**
 * Durante el piloto los perfiles no deben aparecer en buscadores: la vista
 * añade `noindex` mientras está montada (React 18 no gestiona el <head>).
 */
function useNoIndexar() {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])
}

// RF-05 · Perfil público del jugador: compartible y sin sesión, sólo con los
// campos de la lista blanca de GET /api/v1/perfiles/:id.
export default function PerfilJugadorPage() {
  const { id } = useParams<{ id: string }>()
  const consulta = usePerfilPublico(id)
  useNoIndexar()

  if (consulta.isPending) {
    return (
      <div aria-busy="true" aria-label={t.cargando} className="space-y-4">
        <div className="skeleton h-44 rounded-2xl" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="skeleton h-56 rounded-2xl lg:col-span-2" />
          <div className="skeleton h-56 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (consulta.isError) {
    return esNoEncontrado(consulta.error) ? (
      <NoEncontrado />
    ) : (
      <ErrorCarga error={consulta.error} onReintentar={() => void consulta.refetch()} />
    )
  }

  return <Perfil perfil={consulta.data} />
}

function Perfil({ perfil }: { perfil: PerfilJugadorPublico }) {
  const riot = perfil.cuentasVerificadas.some((cuenta) => cuenta.plataforma === 'RIOT')

  return (
    <div className="space-y-6">
      {/* ----------------------------- Cabecera ----------------------------- */}
      <Card className="relative overflow-hidden">
        <div className="grid-bg absolute inset-0 opacity-30" aria-hidden />
        <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:p-6">
          {perfil.avatarUrl ? (
            <img
              src={perfil.avatarUrl}
              alt=""
              className="size-24 shrink-0 rounded-full object-cover"
            />
          ) : (
            <Avatar nombre={perfil.nombre} size="xl" />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight break-words text-slate-50">
              {perfil.nombre}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {riot ? (
                <Badge tono="verde">
                  <ShieldCheck size={11} aria-hidden />
                  {t.riotVerificada}
                </Badge>
              ) : (
                <Badge>{t.sinRiot}</Badge>
              )}
              {perfil.departamento && (
                <Badge tono="cian">
                  {es.macrorregion[MACROREGION_POR_DEPARTAMENTO[perfil.departamento]]}
                </Badge>
              )}
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
              <MapPin size={13} aria-hidden />
              {perfil.pais ? lugar(perfil.pais, perfil.departamento) : t.sinUbicacion}
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed whitespace-pre-line text-slate-300">
              {perfil.bio ?? <span className="text-slate-500">{t.sinBio}</span>}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader
              title={t.estadisticasTitulo}
              subtitle={t.estadisticasSubtitulo}
              icon={<BarChart3 size={16} />}
            />
            <EmptyState
              icono={<Gamepad2 size={22} />}
              titulo={t.sinEstadisticas}
              descripcion={t.sinEstadisticasDetalle}
            />
          </Card>
          <Card>
            <CardHeader
              title={t.habilidadesTitulo}
              subtitle={t.habilidadesSubtitulo}
              icon={<Sparkles size={16} />}
            />
            <EmptyState
              icono={<Sparkles size={22} />}
              titulo={t.habilidadesProximamente}
              descripcion={t.habilidadesProximamenteDetalle}
            />
          </Card>
        </div>

        <Card className="self-start">
          <CardHeader
            title={t.cuentasTitulo}
            subtitle={t.cuentasSubtitulo}
            icon={<BadgeCheck size={16} />}
          />
          {perfil.cuentasVerificadas.length === 0 ? (
            <EmptyState
              icono={<ShieldCheck size={22} />}
              titulo={t.sinCuentas}
              descripcion={t.sinCuentasDetalle}
            />
          ) : (
            <ul className="space-y-2 p-5">
              {perfil.cuentasVerificadas.map((cuenta) => (
                <li
                  key={cuenta.plataforma}
                  className="flex items-start gap-3 rounded-xl border border-white/8 bg-white/3 px-3.5 py-3"
                >
                  <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-300" aria-hidden />
                  <div>
                    <p className="text-sm font-medium text-slate-100">
                      {t.plataforma[cuenta.plataforma]}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {t.verificadaEl(formatoFecha.format(cuenta.verificadaEn))}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <SectionTitle title={t.comoTitulo} subtitle={t.comoSubtitulo} />
      <Card className="p-5">
        <ol className="grid gap-4 md:grid-cols-4">
          {t.pasos.map((paso) => (
            <li key={paso.n} className="rounded-xl border border-white/8 bg-white/3 p-4">
              <span className="font-mono text-xs text-brand-400" aria-hidden>
                {paso.n}
              </span>
              <p className="mt-1.5 text-sm font-semibold text-slate-100">{paso.titulo}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{paso.detalle}</p>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  )
}

function NoEncontrado() {
  const { usuario } = useAuth()
  return (
    <Card>
      <EmptyState
        icono={<UserX size={22} />}
        titulo={t.noEncontrado}
        descripcion={t.noEncontradoDetalle}
        action={
          <Link
            to={usuario ? '/' : '/login'}
            className="inline-flex items-center rounded-lg border border-white/12 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-brand-500/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
          >
            {usuario ? t.irInicio : t.irIngreso}
          </Link>
        }
      />
    </Card>
  )
}

function ErrorCarga({ error, onReintentar }: { error: Error; onReintentar: () => void }) {
  const limitado = axios.isAxiosError(error) && error.response?.status === 429
  return (
    <Card>
      <div role="alert">
        <EmptyState
          icono={<RotateCcw size={22} />}
          titulo={limitado ? t.demasiadasConsultas : t.error}
          descripcion={limitado ? undefined : t.errorDetalle}
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
