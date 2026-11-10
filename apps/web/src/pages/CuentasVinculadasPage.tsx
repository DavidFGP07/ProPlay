import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import {
  BarChart3,
  Clock,
  Gamepad2,
  Hourglass,
  Link2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Unlink,
} from 'lucide-react'
import {
  SEGUNDOS_COMPROBACION_AUTOMATICA,
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
  useCancelarDesafioRiot,
  useCuentasGaming,
  useDesafioRiot,
  useDesvincularPlataforma,
  useIniciarVinculacionRiot,
  useRegenerarDesafioRiot,
  useVerificarCuentaRiot,
} from '@/api/cuentasGaming'
import { SincronizacionRiot } from '@/components/SincronizacionRiot'
import { es } from '@/i18n/es'

const t = es.cuentasVinculadas

const formatoFecha = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeStyle: 'short' })
const formatoHora = new Intl.DateTimeFormat('es-CO', { timeStyle: 'medium' })

/** «mm:ss» de los milisegundos que quedan. */
function cuentaAtras(ms: number): string {
  const segundos = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`
}

/** Hora actual que se renueva cada segundo (cuenta atras y comprobacion automatica). */
function useAhora(): number {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setAhora(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  return ahora
}

/** Si la pestaña se ve: la comprobacion automatica se pausa cuando no. */
function usePestanaVisible(): boolean {
  const [visible, setVisible] = useState(() => document.visibilityState !== 'hidden')
  useEffect(() => {
    const alCambiar = () => setVisible(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', alCambiar)
    return () => document.removeEventListener('visibilitychange', alCambiar)
  }, [])
  return visible
}

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

      <div className="flex flex-wrap items-start gap-2">
        <SincronizacionRiot etiqueta={t.sincronizar} />
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

/** Codigos que son una espera (sin cupo en Riot, Riot no disponible), no un fallo. */
const CODIGOS_DE_ESPERA = ['MUCHA_DEMANDA', 'RIOT_NO_DISPONIBLE']

function ErrorAccion({ error }: { error: Error }) {
  // RF-02 · Sin cupo o sin Riot no es culpa del jugador: aviso, no error rojo.
  if (CODIGOS_DE_ESPERA.includes(codigoDeError(error) ?? '')) {
    return (
      <p role="status" className="text-xs text-amber-300">
        {mensajeDeError(error)}
      </p>
    )
  }
  return (
    <p role="alert" className="text-xs text-rose-300">
      {mensajeDeError(error)}
    </p>
  )
}

/* -------------------------------- Vinculacion ------------------------------- */

type EntradaRiot = z.input<typeof vincularCuentaRiotSchema>

// RF-02 · El desafio activo lo guarda la API: al volver a la vista, recargar o
// abrir otra pestaña se muestra el mismo icono con el tiempo que le queda.
function Vinculacion() {
  const desafio = useDesafioRiot()

  if (desafio.isPending) {
    return <div aria-busy="true" aria-label={t.cargandoDesafio} className="skeleton h-48 rounded-xl" />
  }
  if (desafio.isError) {
    return (
      <div role="alert" className="space-y-3">
        <p className="text-xs text-rose-300">{mensajeDeError(desafio.error)}</p>
        <Button variante="secundario" tamano="sm" onClick={() => void desafio.refetch()}>
          <RotateCcw size={13} aria-hidden />
          {es.comun.reintentar}
        </Button>
      </div>
    )
  }
  return desafio.data.desafio ? (
    <Desafio key={desafio.data.desafio.tokenDesafio} desafio={desafio.data.desafio} />
  ) : (
    <FormularioRiotId />
  )
}

function FormularioRiotId() {
  const iniciar = useIniciarVinculacionRiot()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EntradaRiot>({
    resolver: zodResolver(vincularCuentaRiotSchema),
    defaultValues: { gameName: '', tagLine: '', servidor: SERVIDOR_LOL_POR_DEFECTO },
  })

  // zodResolver entrega los valores ya transformados por el esquema (sin «#»).
  // Al responder, el hook guarda el desafio y Vinculacion pasa a mostrarlo.
  const buscar = handleSubmit((datos) => {
    iniciar.mutate({ ...datos, servidor: datos.servidor ?? SERVIDOR_LOL_POR_DEFECTO })
  })

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

const MS_COMPROBACION_AUTOMATICA = SEGUNDOS_COMPROBACION_AUTOMATICA * 1000

function Desafio({ desafio }: { desafio: DesafioVerificacionRiot }) {
  const verificar = useVerificarCuentaRiot()
  const regenerar = useRegenerarDesafioRiot()
  const cancelar = useCancelarDesafioRiot()
  const ahora = useAhora()
  const visible = usePestanaVisible()
  // Ultimo intento lanzado desde esta pestaña, aunque fallara: evita repetirlo
  // cada segundo si la API o Riot responden con error.
  const ultimoIntento = useRef(0)

  const restante = desafio.expiraEn.getTime() - ahora
  const caducado = restante <= 0
  const sinComprobaciones = desafio.comprobacionesRestantes === 0
  const codigo = codigoDeError(verificar.error)
  const bloqueada = codigo === 'COMPROBACIONES_AGOTADAS' || sinComprobaciones

  // RF-02 · Comprobacion automatica: cada 45 s como minimo mientras la vista
  // esta abierta y visible, hasta que el desafio caduque o se verifique. Cuenta
  // desde la ultima comprobacion guardada en la API (de cualquier pestaña).
  const base = Math.max(
    desafio.ultimaComprobacionEn?.getTime() ?? desafio.creadoEn.getTime(),
    ultimoIntento.current,
  )
  const tocaComprobar =
    visible && !caducado && !bloqueada && !verificar.isPending && ahora - base >= MS_COMPROBACION_AUTOMATICA
  const { mutate } = verificar
  useEffect(() => {
    if (!tocaComprobar) return
    ultimoIntento.current = Date.now()
    mutate({ tokenDesafio: desafio.tokenDesafio })
  }, [tocaComprobar, mutate, desafio.tokenDesafio])

  const comprobarAhora = () => {
    ultimoIntento.current = Date.now()
    verificar.mutate({ tokenDesafio: desafio.tokenDesafio })
  }

  // Al caducar, la consulta del desafio vuelve vacia y se muestra el formulario.
  const { refetch } = useDesafioRiot()
  useEffect(() => {
    if (caducado) void refetch()
  }, [caducado, refetch])

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
              {t.iconoActual}: #{desafio.iconoVisto ?? desafio.iconoActual}
            </span>
          </figcaption>
        </figure>

        <div className="space-y-4">
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-300">
            {t.desafioPasos(SEGUNDOS_COMPROBACION_AUTOMATICA).map((paso) => (
              <li key={paso}>{paso}</li>
            ))}
          </ol>
          <p className="flex items-start gap-1.5 text-xs text-accent-400">
            <Hourglass size={13} className="mt-px shrink-0" aria-hidden />
            {t.demoraRiot}
          </p>
          <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Clock size={12} aria-hidden />
            <span>
              {t.caducaEn(cuentaAtras(restante))}
              <span className="sr-only"> ({t.expira(formatoFecha.format(desafio.expiraEn))})</span>
            </span>
          </p>

          <div className="flex flex-wrap gap-2">
            <Button cargando={verificar.isPending} disabled={bloqueada || caducado} onClick={comprobarAhora}>
              <Link2 size={14} aria-hidden />
              {t.verificar}
            </Button>
            <Button
              variante="secundario"
              cargando={regenerar.isPending}
              onClick={() => regenerar.mutate()}
            >
              <RefreshCw size={14} aria-hidden />
              {t.generarOtroIcono}
            </Button>
            <Button variante="fantasma" cargando={cancelar.isPending} onClick={() => cancelar.mutate()}>
              {t.empezarDeNuevo}
            </Button>
          </div>

          <EstadoComprobacion
            desafio={desafio}
            muchaDemanda={verificar.data?.estado === 'PENDIENTE' && verificar.data.motivo === 'MUCHA_DEMANDA'}
            comprobando={verificar.isPending}
            agotadas={bloqueada}
            error={verificar.isError && codigo !== 'COMPROBACIONES_AGOTADAS' ? verificar.error : null}
          />
          {regenerar.isError && <ErrorAccion error={regenerar.error} />}
          {cancelar.isError && <ErrorAccion error={cancelar.error} />}
        </div>
      </div>
    </div>
  )
}

/**
 * Resultado de la ultima comprobacion. Que Riot aun no muestre el icono no es
 * un error (tarda unos minutos): aviso informativo, no rojo, con la hora.
 */
function EstadoComprobacion({
  desafio,
  muchaDemanda,
  comprobando,
  agotadas,
  error,
}: {
  desafio: DesafioVerificacionRiot
  /** La ultima comprobacion no llego a Riot por falta de cupo: se reintenta sola. */
  muchaDemanda: boolean
  comprobando: boolean
  agotadas: boolean
  error: Error | null
}) {
  if (error) return <ErrorAccion error={error} />
  if (agotadas) {
    return (
      <p role="status" className="text-xs text-amber-300">
        {t.comprobacionesAgotadas}
      </p>
    )
  }
  if (comprobando) {
    return (
      <p role="status" className="text-xs text-slate-400">
        {t.comprobando}
      </p>
    )
  }
  if (muchaDemanda) {
    return (
      <p role="status" className="text-xs text-amber-300">
        {t.muchaDemanda}
      </p>
    )
  }
  if (!desafio.ultimaComprobacionEn) {
    return (
      <p role="status" className="text-xs text-slate-500">
        {t.comprobacionAutomatica(SEGUNDOS_COMPROBACION_AUTOMATICA)}
      </p>
    )
  }
  return (
    <div role="status" className="space-y-1 rounded-lg border border-accent-500/30 bg-accent-500/10 p-3">
      <p className="text-xs text-slate-100">{t.aunNoVemosElCambio}</p>
      <p className="text-[11px] text-slate-400">
        {t.ultimaComprobacion(formatoHora.format(desafio.ultimaComprobacionEn))}
      </p>
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
