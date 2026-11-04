import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Briefcase, CheckCircle2, Send, Sigma, Weight } from 'lucide-react'
import {
  DIMENSIONES_MATCHING,
  crearPostulacionSchema,
  type CrearPostulacionInput,
  type Oferta,
} from '@proplay/shared'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorCampo,
  EstadoEnvio,
  EstadoError,
  Field,
  Modal,
  Progress,
  Textarea,
} from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { esNoEncontrado, usePerfilPropio } from '@/api/perfiles'
import { GestionOferta } from '@/components/GestionOferta'
import { PostulacionesRecibidas } from '@/components/PostulacionesRecibidas'
import { aplicarErrorApi, codigoError } from '@/api/errores'
import { useMisPostulaciones, useOferta, usePostular } from '@/api/ofertas'
import { es } from '@/i18n/es'
import { lugarOferta } from '@/lib/ubicacion'

const t = es.ofertaDetalle

const formatoFecha = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long' })

const TONO_ESTADO_OFERTA = {
  BORRADOR: 'ambar',
  ABIERTA: 'verde',
  CUBIERTA: 'azul',
  CERRADA: 'neutro',
} as const satisfies Record<Oferta['estado'], string>

const claseEnlace =
  'inline-flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400'

// RF-07 · RF-10 · Detalle de la oferta y postulación: datos reales de
// GET /api/v1/ofertas/:id y POST /api/v1/ofertas/:id/postulaciones. El equipo
// dueño la gestiona desde aquí y ve las postulaciones recibidas; el scout las
// consulta. El ranking de candidatos y su explicación son otra vista (motor de
// matching).
export default function OfertaDetallePage() {
  const { id } = useParams<{ id: string }>()
  const consulta = useOferta(id)

  if (consulta.isPending) {
    return (
      <div aria-busy="true" aria-label={t.cargando} className="space-y-4">
        <div className="skeleton h-56 rounded-2xl" />
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="skeleton h-48 rounded-2xl" />
          <div className="skeleton h-48 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (consulta.isError) {
    return (
      <div className="space-y-4">
        <Volver />
        <Card>
          {esNoEncontrado(consulta.error) ? (
            <EmptyState
              icono={<Briefcase size={22} />}
              titulo={t.noEncontrada}
              descripcion={t.noEncontradaDetalle}
            />
          ) : (
            <EstadoError titulo={t.error} onReintentar={() => void consulta.refetch()} />
          )}
        </Card>
      </div>
    )
  }

  return <Detalle oferta={consulta.data} />
}

function Volver() {
  return (
    <Link to="/vacantes" className={claseEnlace}>
      <ArrowLeft size={14} aria-hidden />
      {t.volver}
    </Link>
  )
}

function Detalle({ oferta }: { oferta: Oferta }) {
  const { usuario } = useAuth()
  const rol = usuario?.rol
  const propio = usePerfilPropio(rol === 'EQUIPO')
  const esPropia =
    propio.data?.tipo === 'EQUIPO' && propio.data.perfil.id === oferta.equipo.id
  // El equipo ve las de sus ofertas; el scout y el administrador, las de cualquiera publicada.
  const veRecibidas = oferta.estado !== 'BORRADOR' && (esPropia || rol === 'SCOUT' || rol === 'ADMIN')
  const ficha: [string, string][] = [
    [t.posicion, es.posicionLol[oferta.rol]],
    [t.rangoMinimo, oferta.rangoMinimo ?? t.sinRango],
    [t.modalidad, es.modalidad[oferta.modalidad]],
    [t.ubicacion, lugarOferta(oferta)],
    [t.horas, oferta.horasSemana === null ? t.sinHoras : es.ofertas.horas(oferta.horasSemana)],
    ...(oferta.publicadaEn
      ? [[t.publicada, formatoFecha.format(oferta.publicadaEn)] as [string, string]]
      : []),
  ]

  return (
    <div className="space-y-6">
      <Volver />

      {/* ---------------------------- Cabecera ---------------------------- */}
      <Card className="relative overflow-hidden">
        <div className="grid-bg absolute inset-0 opacity-30" aria-hidden />
        <div className="relative flex flex-col gap-6 p-5 sm:p-6 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tono="cian">{es.posicionLol[oferta.rol]}</Badge>
              <Badge tono="violeta">{es.modalidad[oferta.modalidad]}</Badge>
              <Badge tono={TONO_ESTADO_OFERTA[oferta.estado]}>
                {es.estadoOferta[oferta.estado]}
              </Badge>
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight break-words text-slate-50">
              {oferta.titulo}
            </h1>
            <div className="mt-2 flex items-center gap-2 text-sm text-slate-400">
              <Avatar nombre={oferta.equipo.nombreOrg} size="sm" />
              <span className="min-w-0 truncate">
                {oferta.equipo.nombreOrg} · {oferta.juego}
              </span>
            </div>
            <h2 className="sr-only">{t.descripcion}</h2>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed whitespace-pre-line text-slate-300">
              {oferta.descripcion}
            </p>
          </div>
          <div className="w-full shrink-0 lg:w-72">
            {esPropia ? <GestionOferta oferta={oferta} /> : <AccionPostulacion oferta={oferta} />}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="min-w-0">
          <CardHeader title={t.requisitos} icon={<Briefcase size={16} />} />
          <dl className="grid gap-4 p-5 sm:grid-cols-2">
            {ficha.map(([etiqueta, valor]) => (
              <div key={etiqueta} className="min-w-0">
                <dt className="text-[11px] tracking-wide text-slate-400 uppercase">{etiqueta}</dt>
                <dd className="mt-1 text-sm break-words text-slate-100">{valor}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card className="min-w-0">
          <CardHeader title={t.pesosTitulo} subtitle={t.pesosSubtitulo} icon={<Weight size={16} />} />
          <dl className="space-y-3.5 p-5">
            {DIMENSIONES_MATCHING.map((dimension) => (
              <div key={dimension}>
                <div className="flex items-center justify-between text-xs">
                  <dt className="text-slate-300">{es.dimension[dimension]}</dt>
                  <dd className="font-mono text-brand-300">
                    {Math.round(oferta.pesos[dimension] * 100)} %
                  </dd>
                </div>
                <Progress valor={oferta.pesos[dimension]} className="mt-1.5" />
              </div>
            ))}
          </dl>
        </Card>
      </div>

      {veRecibidas && <PostulacionesRecibidas oferta={oferta} gestiona={esPropia} />}

      <Card>
        <CardHeader title={t.metodologiaTitulo} icon={<Sigma size={16} />} />
        <p className="p-5 text-sm leading-relaxed text-slate-400">{t.metodologia}</p>
      </Card>
    </div>
  )
}

/** Qué puede hacer con la oferta quien la mira: el jugador, postularse. */
function AccionPostulacion({ oferta }: { oferta: Oferta }) {
  const { usuario } = useAuth()
  const esJugador = usuario?.rol === 'JUGADOR'
  const mias = useMisPostulaciones(esJugador)
  const [abierto, setAbierto] = useState(false)

  if (!esJugador) {
    return (
      <p className="rounded-xl border border-white/8 bg-surface-900/60 px-4 py-3 text-xs leading-relaxed text-slate-400">
        {usuario?.rol === 'EQUIPO' ? t.vistaEquipo : t.vistaScout}
      </p>
    )
  }

  if (mias.isPending) return <div className="skeleton h-20 rounded-xl" aria-hidden />

  const mia = mias.data?.find((p) => p.oferta.id === oferta.id)
  if (mia) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/8 px-4 py-3">
        <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-300">
          <CheckCircle2 size={14} aria-hidden />
          {t.postulacionEnviada}
        </p>
        <p className="mt-1 text-xs text-slate-300">
          {t.estadoActual(es.estadoPostulacion[mia.estado])}
        </p>
        <Link
          to="/mi-perfil?pestana=postulaciones"
          className="mt-2 inline-flex text-xs font-medium text-brand-300 hover:text-brand-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
        >
          {t.verMisPostulaciones}
        </Link>
      </div>
    )
  }

  if (oferta.estado !== 'ABIERTA') {
    return (
      <p className="rounded-xl border border-white/8 bg-surface-900/60 px-4 py-3 text-xs text-slate-400">
        {t.noAbierta}
      </p>
    )
  }

  return (
    <>
      <Button className="w-full" onClick={() => setAbierto(true)}>
        <Send size={14} aria-hidden />
        {t.postularme}
      </Button>
      <Modal abierto={abierto} onCerrar={() => setAbierto(false)} titulo={t.modalTitulo}>
        <FormularioPostulacion oferta={oferta} onEnviada={() => setAbierto(false)} />
      </Modal>
    </>
  )
}

function FormularioPostulacion({ oferta, onEnviada }: { oferta: Oferta; onEnviada: () => void }) {
  const { notificar } = useToast()
  const postulacion = usePostular()
  const [errorGeneral, setErrorGeneral] = useState('')
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CrearPostulacionInput>({
    resolver: zodResolver(crearPostulacionSchema),
    defaultValues: { mensaje: '' },
  })

  const enviar = handleSubmit(async (datos) => {
    setErrorGeneral('')
    try {
      await postulacion.mutateAsync({ ofertaId: oferta.id, ...datos })
      notificar(t.exito)
      onEnviada()
    } catch (e) {
      // Los 409 del contrato tienen su mensaje; el resto, el traductor común.
      const codigo = codigoError(e)
      if (codigo === 'POSTULACION_DUPLICADA') setErrorGeneral(t.duplicada)
      else if (codigo === 'OFERTA_NO_ABIERTA') setErrorGeneral(t.cerrada)
      else setErrorGeneral(aplicarErrorApi(e, setError))
    }
  })

  return (
    <form onSubmit={enviar} noValidate className="space-y-4">
      <div className="rounded-lg border border-white/8 bg-white/3 p-3 text-xs text-slate-400">
        <p className="font-medium text-slate-200">{oferta.titulo}</p>
        <p className="mt-1">{oferta.equipo.nombreOrg}</p>
      </div>
      <Field label={t.mensaje} hint={t.mensajeAyuda}>
        <Textarea rows={5} aria-invalid={Boolean(errors.mensaje)} {...register('mensaje')} />
        <ErrorCampo mensaje={errors.mensaje?.message} />
      </Field>
      <EstadoEnvio exito="" error={errorGeneral} onReintentar={() => void enviar()} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button variante="fantasma" onClick={onEnviada}>
          {t.cancelar}
        </Button>
        <Button type="submit" cargando={postulacion.isPending}>
          {t.enviar}
        </Button>
      </div>
    </form>
  )
}
