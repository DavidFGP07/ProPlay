import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import {
  BarChart3,
  Clock,
  Gamepad2,
  Link2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Unlink,
} from 'lucide-react'
import {
  MINUTOS_DESAFIO_VERIFICACION,
  SERVIDORES_LOL,
  SERVIDOR_LOL_POR_DEFECTO,
  vincularCuentaRiotSchema,
  type CuentaGaming,
  type DesafioVerificacionRiot,
  type ServidorLol,
} from '@proplay/shared'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorCampo,
  Field,
  Input,
  SectionTitle,
  Select,
} from '@/components/ui'
import { mensajeDeError } from '@/api/client'
import {
  codigoDeError,
  useCuentasGaming,
  useDesvincularPlataforma,
  useIniciarVinculacionRiot,
  useVerificarCuentaRiot,
} from '@/api/cuentasGaming'
import { useSincronizarEstadisticas } from '@/api/estadisticas'
import { es } from '@/i18n/es'

const t = es.cuentasVinculadas

const formatoFecha = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeStyle: 'short' })

const esServidor = (valor: string | null): valor is ServidorLol =>
  (SERVIDORES_LOL as readonly string[]).includes(valor ?? '')

// RF-02 · RF-03 · Cuentas vinculadas: vincular la cuenta de Riot (verificada
// por icono), sincronizar sus estadisticas y desvincularla. API real.
export default function CuentasVinculadasPage() {
  const cuentas = useCuentasGaming()

  return (
    <div className="space-y-6">
      <SectionTitle title={t.titulo} subtitle={t.subtitulo} />

      {cuentas.isPending ? (
        <div aria-busy="true" aria-label={t.cargando} className="skeleton h-72 rounded-2xl" />
      ) : cuentas.isError ? (
        <Card>
          <div role="alert">
            <EmptyState
              icono={<RotateCcw size={22} />}
              titulo={t.errorCarga}
              descripcion={mensajeDeError(cuentas.error)}
              action={
                <Button variante="secundario" onClick={() => void cuentas.refetch()}>
                  <RotateCcw size={13} aria-hidden />
                  {es.comun.reintentar}
                </Button>
              }
            />
          </div>
        </Card>
      ) : (
        <TarjetaRiot cuenta={cuentas.data.find((c) => c.plataforma === 'RIOT' && c.verificadaEn)} />
      )}

      <AvisoDatos />
    </div>
  )
}

function TarjetaRiot({ cuenta }: { cuenta: CuentaGaming | undefined }) {
  return (
    <Card>
      <CardHeader
        icon={<Gamepad2 size={18} />}
        title={t.riotTitulo}
        subtitle={t.riotSubtitulo}
        action={
          cuenta ? (
            <Badge tono="verde">
              <ShieldCheck size={11} aria-hidden />
              {t.verificada}
            </Badge>
          ) : undefined
        }
      />
      <div className="p-5">{cuenta ? <CuentaVerificada cuenta={cuenta} /> : <Vinculacion />}</div>
    </Card>
  )
}

/* ----------------------------- Cuenta verificada ---------------------------- */

function CuentaVerificada({ cuenta }: { cuenta: CuentaGaming }) {
  const sincronizar = useSincronizarEstadisticas()
  const desvincular = useDesvincularPlataforma()
  const [confirmando, setConfirmando] = useState(false)

  const servidor = esServidor(cuenta.servidor) ? es.servidor[cuenta.servidor] : cuenta.servidor

  return (
    <div className="space-y-5">
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Dato etiqueta={t.riotId} valor={cuenta.handle ?? '—'} />
        <Dato etiqueta={t.servidor} valor={servidor ?? '—'} />
        <Dato
          etiqueta={t.verificadaEl}
          valor={cuenta.verificadaEn ? formatoFecha.format(cuenta.verificadaEn) : '—'}
        />
        <Dato
          etiqueta={t.ultimaSincronizacion}
          valor={
            cuenta.sincronizadaEn ? formatoFecha.format(cuenta.sincronizadaEn) : t.nuncaSincronizada
          }
        />
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button cargando={sincronizar.isPending} onClick={() => sincronizar.mutate()}>
          <RefreshCw size={14} aria-hidden />
          {t.sincronizar}
        </Button>
        <Link
          to="/mis-estadisticas"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/12 bg-white/5 px-4 text-sm font-medium text-slate-200 transition hover:border-brand-500/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
        >
          <BarChart3 size={14} aria-hidden />
          {t.verEstadisticas}
        </Link>
        {!confirmando && (
          <Button variante="fantasma" onClick={() => setConfirmando(true)}>
            <Unlink size={14} aria-hidden />
            {t.desvincular}
          </Button>
        )}
      </div>

      {sincronizar.isSuccess && (
        <p role="status" className="text-xs text-emerald-300">
          {sincronizar.data.hayDatosNuevos ? t.sincronizadaNueva : t.sincronizadaSinCambios}
        </p>
      )}
      {sincronizar.isError && <ErrorAccion error={sincronizar.error} />}

      {confirmando && (
        <div
          role="alertdialog"
          aria-label={t.desvincular}
          className="space-y-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-4"
        >
          <p className="text-xs text-rose-200">{t.avisoDesvincular}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variante="peligro"
              tamano="sm"
              cargando={desvincular.isPending}
              onClick={() => desvincular.mutate('RIOT')}
            >
              {t.confirmarDesvincular}
            </Button>
            <Button variante="secundario" tamano="sm" onClick={() => setConfirmando(false)}>
              {t.cancelar}
            </Button>
          </div>
          {desvincular.isError && <ErrorAccion error={desvincular.error} />}
        </div>
      )}
    </div>
  )
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-white/4 p-3">
      <dt className="text-[11px] font-medium text-slate-500">{etiqueta}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-slate-100">{valor}</dd>
    </div>
  )
}

function ErrorAccion({ error }: { error: Error }) {
  return (
    <p role="alert" className="text-xs text-rose-300">
      {mensajeDeError(error)}
    </p>
  )
}

/* -------------------------------- Vinculacion ------------------------------- */

type EntradaRiot = z.input<typeof vincularCuentaRiotSchema>

function Vinculacion() {
  const iniciar = useIniciarVinculacionRiot()
  const [desafio, setDesafio] = useState<DesafioVerificacionRiot | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EntradaRiot>({
    resolver: zodResolver(vincularCuentaRiotSchema),
    defaultValues: { gameName: '', tagLine: '', servidor: SERVIDOR_LOL_POR_DEFECTO },
  })

  // zodResolver entrega los valores ya transformados por el esquema (sin «#»).
  const buscar = handleSubmit((datos) => {
    iniciar.mutate(
      { ...datos, servidor: datos.servidor ?? SERVIDOR_LOL_POR_DEFECTO },
      { onSuccess: setDesafio },
    )
  })

  if (desafio) {
    return (
      <Desafio
        desafio={desafio}
        onReiniciar={() => {
          iniciar.reset()
          setDesafio(null)
        }}
      />
    )
  }

  return (
    <form onSubmit={buscar} noValidate className="space-y-4">
      <h4 className="text-sm font-semibold text-slate-100">{t.formTitulo}</h4>
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr_2fr]">
        <Field label={t.gameName}>
          <Input
            autoComplete="off"
            placeholder={t.gameNamePlaceholder}
            aria-invalid={Boolean(errors.gameName)}
            {...register('gameName')}
          />
          <ErrorCampo mensaje={errors.gameName?.message} />
        </Field>
        <Field label={t.tagLine} hint={t.tagLinePista}>
          <Input
            autoComplete="off"
            placeholder={t.tagLinePlaceholder}
            aria-invalid={Boolean(errors.tagLine)}
            {...register('tagLine')}
          />
          <ErrorCampo mensaje={errors.tagLine?.message} />
        </Field>
        <Field label={t.servidor}>
          <Select {...register('servidor')}>
            {SERVIDORES_LOL.map((servidor) => (
              <option key={servidor} value={servidor}>
                {es.servidor[servidor]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Button type="submit" cargando={iniciar.isPending}>
        <Search size={14} aria-hidden />
        {t.buscar}
      </Button>
      {iniciar.isError && <ErrorAccion error={iniciar.error} />}
    </form>
  )
}

function Desafio({
  desafio,
  onReiniciar,
}: {
  desafio: DesafioVerificacionRiot
  onReiniciar: () => void
}) {
  const verificar = useVerificarCuentaRiot()
  const pendiente = codigoDeError(verificar.error) === 'VERIFICACION_PENDIENTE'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold text-slate-100">{t.desafioTitulo}</h4>
        <Badge tono="cian">{desafio.riotId}</Badge>
        <Badge>{es.servidor[desafio.servidor]}</Badge>
        <Badge>{t.nivel(desafio.nivelInvocador)}</Badge>
      </div>

      <div className="grid gap-5 md:grid-cols-[auto_1fr] md:items-start">
        <figure className="flex flex-col items-center gap-2 rounded-xl border border-brand-500/40 bg-brand-500/10 p-4">
          <img
            src={desafio.iconoRequeridoUrl}
            alt={t.iconoAlt(desafio.iconoRequerido)}
            width={96}
            height={96}
            className="size-24 rounded-xl"
          />
          <figcaption className="text-center text-xs text-brand-200">
            {t.iconoRequerido}
            <span className="block text-[11px] text-slate-400">
              {t.iconoActual}: #{desafio.iconoActual}
            </span>
          </figcaption>
        </figure>

        <div className="space-y-4">
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-300">
            {t.desafioPasos(MINUTOS_DESAFIO_VERIFICACION).map((paso) => (
              <li key={paso}>{paso}</li>
            ))}
          </ol>
          <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Clock size={12} aria-hidden />
            {t.expira(formatoFecha.format(desafio.expiraEn))}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              cargando={verificar.isPending}
              onClick={() => verificar.mutate({ tokenDesafio: desafio.tokenDesafio })}
            >
              <Link2 size={14} aria-hidden />
              {t.verificar}
            </Button>
            <Button variante="fantasma" onClick={onReiniciar}>
              {t.empezarDeNuevo}
            </Button>
          </div>
          {verificar.isError && (
            <p role="alert" className={pendiente ? 'text-xs text-amber-300' : 'text-xs text-rose-300'}>
              {mensajeDeError(verificar.error)}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------- Aviso ----------------------------------- */

// RNF-05 · Ley 1581: aviso claro de que datos se leen y para que (tarea 2.8)
function AvisoDatos() {
  return (
    <Card className="p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
        <ShieldCheck size={15} className="text-emerald-400" aria-hidden />
        {t.avisoTitulo}
      </h3>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-relaxed text-slate-400">
        {t.avisoDatos.map((dato) => (
          <li key={dato}>{dato}</li>
        ))}
      </ul>
      <p className="mt-3 text-xs leading-relaxed text-slate-400">{t.avisoFinalidad}</p>
    </Card>
  )
}
