import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Briefcase, Globe, MapPin, Weight } from 'lucide-react'
import {
  MODALIDADES,
  PAIS_CON_DEPARTAMENTO,
  POSICIONES_LOL,
  RANGOS_LOL,
  actualizarOfertaSchema,
  crearOfertaSchema,
  type Oferta,
} from '@proplay/shared'
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorCampo,
  EstadoEnvio,
  EstadoError,
  EstadoSinPermiso,
  Field,
  Input,
  SectionTitle,
  Select,
  Textarea,
} from '@/components/ui'
import { DeslizadoresPesos, PORCENTAJES_POR_DEFECTO } from '@/components/DeslizadoresPesos'
import { aplicarErrorApi } from '@/api/errores'
import { esNoEncontrado, usePerfilPropio } from '@/api/perfiles'
import { useActualizarOferta, useCrearOferta, useOferta } from '@/api/ofertas'
import { useToast } from '@/context/ToastContext'
import { es } from '@/i18n/es'
import { aFracciones, aPorcentajes, type Porcentajes } from '@/lib/pesos'
import { OPCIONES_DEPARTAMENTO, opcionesPais } from '@/lib/ubicacion'

const t = es.formularioOferta

/** Límite de la descripción en el contrato; el contador lo muestra. */
const MAXIMO_DESCRIPCION = 5000

const claseEnlace =
  'inline-flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400'

/**
 * Los campos trabajan con cadenas ("" = sin dato). Al validar se convierten al
 * contrato y pasan por `actualizarOfertaSchema`, que con todos los campos
 * presentes aplica las mismas reglas que la creación (título, posición,
 * modalidad y ubicación). Una oferta remota no envía ubicación.
 */
const esquemaFormulario = z
  .object({
    titulo: z.string(),
    rol: z.string(),
    rangoMinimo: z.string(),
    modalidad: z.string(),
    pais: z.string(),
    departamento: z.string(),
    horasSemana: z.string(),
    descripcion: z.string(),
  })
  .transform((v) => {
    const remota = v.modalidad === 'REMOTA'
    return {
      titulo: v.titulo,
      rol: v.rol,
      rangoMinimo: v.rangoMinimo === '' ? null : v.rangoMinimo,
      modalidad: v.modalidad,
      pais: remota || v.pais === '' ? null : v.pais,
      departamento:
        !remota && v.pais === PAIS_CON_DEPARTAMENTO && v.departamento !== '' ? v.departamento : null,
      horasSemana: v.horasSemana.trim() === '' ? null : Number(v.horasSemana),
      descripcion: v.descripcion,
    }
  })
  .pipe(actualizarOfertaSchema)

type FormularioOferta = z.input<typeof esquemaFormulario>

const VACIO: FormularioOferta = {
  titulo: '',
  rol: '',
  rangoMinimo: '',
  modalidad: 'PRESENCIAL',
  pais: PAIS_CON_DEPARTAMENTO,
  departamento: '',
  horasSemana: '',
  descripcion: '',
}

function valoresDe(oferta: Oferta): FormularioOferta {
  return {
    titulo: oferta.titulo,
    rol: oferta.rol,
    rangoMinimo: oferta.rangoMinimo ?? '',
    modalidad: oferta.modalidad,
    pais: oferta.pais ?? '',
    departamento: oferta.departamento ?? '',
    horasSemana: oferta.horasSemana === null ? '' : String(oferta.horasSemana),
    descripcion: oferta.descripcion,
  }
}

// RF-07 · RF-09 · Crear oferta con el ajuste de los pesos de las
// dimensiones (POST /api/v1/ofertas) y editarla (PATCH /api/v1/ofertas/:id).
// Sólo el rol EQUIPO llega aquí (área `gestionOfertas` del enrutador).
export default function OfertaFormularioPage() {
  const { id } = useParams<{ id: string }>()
  return id ? <Edicion id={id} /> : <Formulario />
}

function Edicion({ id }: { id: string }) {
  const consulta = useOferta(id)
  const propio = usePerfilPropio()

  if (consulta.isPending || propio.isPending) {
    return (
      <div aria-busy="true" aria-label={t.cargando} className="space-y-4">
        <div className="skeleton h-16 rounded-2xl" />
        <div className="skeleton h-96 rounded-2xl" />
      </div>
    )
  }
  if (consulta.isError || propio.isError) {
    const noExiste = consulta.isError && esNoEncontrado(consulta.error)
    return (
      <Card>
        {noExiste ? (
          <EmptyState
            icono={<Briefcase size={22} />}
            titulo={es.ofertaDetalle.noEncontrada}
            descripcion={es.ofertaDetalle.noEncontradaDetalle}
          />
        ) : (
          <EstadoError
            onReintentar={() => {
              void consulta.refetch()
              void propio.refetch()
            }}
          />
        )}
      </Card>
    )
  }

  const oferta = consulta.data
  const esPropia = propio.data.tipo === 'EQUIPO' && propio.data.perfil.id === oferta.equipo.id
  const finalizada = oferta.estado === 'CUBIERTA' || oferta.estado === 'CERRADA'
  if (!esPropia || finalizada) {
    return (
      <Card>
        <EstadoSinPermiso
          titulo={t.noEditable}
          descripcion={finalizada && esPropia ? t.finalizada : t.noEditableDetalle}
        />
      </Card>
    )
  }
  return <Formulario oferta={oferta} />
}

function Formulario({ oferta }: { oferta?: Oferta }) {
  const navegar = useNavigate()
  const { notificar } = useToast()
  const creacion = useCrearOferta()
  const edicion = useActualizarOferta()
  const paises = useMemo(opcionesPais, [])
  const [pesos, setPesos] = useState<Porcentajes>(
    oferta ? aPorcentajes(oferta.pesos) : PORCENTAJES_POR_DEFECTO,
  )
  const [errorGeneral, setErrorGeneral] = useState('')
  // Para que «Reintentar» repita la misma acción (publicar o guardar borrador).
  const [ultimaAccion, setUltimaAccion] = useState<'BORRADOR' | 'ABIERTA'>('ABIERTA')
  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm<FormularioOferta>({
    // raw: el resolver sólo valida; la conversión al contrato se hace al enviar.
    resolver: zodResolver(esquemaFormulario, undefined, { raw: true }),
    defaultValues: oferta ? valoresDe(oferta) : VACIO,
  })
  const remota = watch('modalidad') === 'REMOTA'
  const enColombia = watch('pais') === PAIS_CON_DEPARTAMENTO
  const largoDescripcion = watch('descripcion').length
  const enviando = creacion.isPending || edicion.isPending

  const enviar = (estado: 'BORRADOR' | 'ABIERTA') =>
    handleSubmit(async (valores) => {
      const datos = { ...esquemaFormulario.parse(valores), pesos: aFracciones(pesos) }
      setErrorGeneral('')
      setUltimaAccion(estado)
      try {
        if (oferta) {
          await edicion.mutateAsync({ id: oferta.id, ...datos })
          notificar(t.actualizada)
          navegar(`/vacantes/${oferta.id}`)
        } else {
          const creada = await creacion.mutateAsync(crearOfertaSchema.parse({ ...datos, estado }))
          notificar(estado === 'ABIERTA' ? t.publicada : t.creada)
          navegar(`/vacantes/${creada.id}`)
        }
      } catch (e) {
        setErrorGeneral(
          aplicarErrorApi(e, setError, {
            OFERTA_FINALIZADA: { campo: 'titulo', mensaje: t.finalizada },
          }),
        )
      }
    })

  return (
    <div className="space-y-6">
      <Link to={oferta ? `/vacantes/${oferta.id}` : '/panel-equipo'} className={claseEnlace}>
        <ArrowLeft size={14} aria-hidden />
        {oferta ? t.volverOferta : t.volverPanel}
      </Link>
      <SectionTitle title={oferta ? t.tituloEditar : t.tituloNueva} subtitle={t.subtitulo} />

      <form noValidate onSubmit={enviar('ABIERTA')} className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title={t.datos} icon={<Briefcase size={16} />} />
            <div className="space-y-4 p-5">
              <Field label={t.titulo} hint={t.tituloAyuda}>
                <Input aria-invalid={Boolean(errors.titulo)} {...register('titulo')} />
                <ErrorCampo mensaje={errors.titulo?.message} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t.posicion}>
                  <Select aria-invalid={Boolean(errors.rol)} {...register('rol')}>
                    <option value="">{t.seleccionaPosicion}</option>
                    {POSICIONES_LOL.map((posicion) => (
                      <option key={posicion} value={posicion}>
                        {es.posicionLol[posicion]}
                      </option>
                    ))}
                  </Select>
                  <ErrorCampo mensaje={errors.rol?.message} />
                </Field>
                <Field label={t.rangoMinimo} hint={t.rangoAyuda}>
                  <Select aria-invalid={Boolean(errors.rangoMinimo)} {...register('rangoMinimo')}>
                    <option value="">{t.sinRangoMinimo}</option>
                    {RANGOS_LOL.map((rango) => (
                      <option key={rango} value={rango}>
                        {es.rangoLol[rango]}
                      </option>
                    ))}
                  </Select>
                  <ErrorCampo mensaje={errors.rangoMinimo?.message} />
                </Field>
              </div>
              <Field label={t.horas} className="sm:max-w-xs">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={80}
                  step={1}
                  aria-invalid={Boolean(errors.horasSemana)}
                  {...register('horasSemana')}
                />
                <ErrorCampo mensaje={errors.horasSemana?.message} />
              </Field>
              <Field
                label={t.descripcion}
                hint={t.descripcionAyuda(largoDescripcion, MAXIMO_DESCRIPCION)}
              >
                <Textarea
                  rows={6}
                  maxLength={MAXIMO_DESCRIPCION}
                  aria-invalid={Boolean(errors.descripcion)}
                  {...register('descripcion')}
                />
                <ErrorCampo mensaje={errors.descripcion?.message} />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title={t.ubicacion} subtitle={t.ubicacionAyuda} icon={<MapPin size={16} />} />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label={t.modalidad} className="sm:col-span-2 sm:max-w-xs">
                <Select aria-invalid={Boolean(errors.modalidad)} {...register('modalidad')}>
                  {MODALIDADES.map((modalidad) => (
                    <option key={modalidad} value={modalidad}>
                      {es.modalidad[modalidad]}
                    </option>
                  ))}
                </Select>
                <ErrorCampo mensaje={errors.modalidad?.message} />
              </Field>
              {remota ? (
                <div
                  role="note"
                  className="flex items-start gap-2.5 rounded-xl border border-brand-500/30 bg-brand-500/8 px-3.5 py-3 sm:col-span-2"
                >
                  <Globe size={15} className="mt-0.5 shrink-0 text-brand-300" aria-hidden />
                  <p className="text-xs leading-relaxed text-slate-300">
                    <strong className="font-semibold text-brand-200">{t.remotaTitulo}</strong>
                    {' · '}
                    {t.remotaDetalle}
                  </p>
                </div>
              ) : (
                <>
                  <Field label={t.pais}>
                    <Select aria-invalid={Boolean(errors.pais)} {...register('pais')}>
                      <option value="">{t.seleccionaPais}</option>
                      {paises.map(({ codigo, nombre }) => (
                        <option key={codigo} value={codigo}>
                          {nombre}
                        </option>
                      ))}
                    </Select>
                    <ErrorCampo mensaje={errors.pais?.message} />
                  </Field>
                  <Field
                    label={t.departamento}
                    hint={enColombia ? undefined : t.pistaDepartamento}
                  >
                    <Select
                      disabled={!enColombia}
                      aria-invalid={Boolean(errors.departamento)}
                      {...register('departamento')}
                    >
                      <option value="">{t.seleccionaDepartamento}</option>
                      {OPCIONES_DEPARTAMENTO.map((departamento) => (
                        <option key={departamento} value={departamento}>
                          {es.departamento[departamento]}
                        </option>
                      ))}
                    </Select>
                    <ErrorCampo mensaje={errors.departamento?.message} />
                  </Field>
                </>
              )}
            </div>
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader title={t.pesos} subtitle={t.pesosAyuda} icon={<Weight size={16} />} />
            <div className="p-5">
              <DeslizadoresPesos valor={pesos} onCambiar={setPesos} />
            </div>
          </Card>

          <EstadoEnvio exito="" error={errorGeneral} onReintentar={() => void enviar(ultimaAccion)()} />

          <div className="flex flex-col gap-2 sm:flex-row xl:flex-col">
            {oferta ? (
              <Button type="submit" cargando={enviando} className="w-full">
                {t.guardar}
              </Button>
            ) : (
              <>
                <Button type="submit" cargando={enviando} className="w-full">
                  {t.publicar}
                </Button>
                <Button
                  variante="secundario"
                  className="w-full"
                  disabled={enviando}
                  onClick={() => void enviar('BORRADOR')()}
                >
                  {t.guardarBorrador}
                </Button>
              </>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}
