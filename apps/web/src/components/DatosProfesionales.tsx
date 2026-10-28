import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { MapPin, ShieldCheck } from 'lucide-react'
import {
  DEPARTAMENTOS,
  MACROREGION_POR_DEPARTAMENTO,
  PAIS_CON_DEPARTAMENTO,
  PAISES,
  ubicacionJugadorSchema,
  type PerfilJugadorRespuesta,
} from '@proplay/shared'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ErrorCampo,
  EstadoEnvio,
  Field,
  Select,
} from '@/components/ui'
import { datosDemoActivos } from '@/api/demo'
import { aplicarErrorApi } from '@/api/errores'
import { useActualizarUbicacion, usePerfilPropio } from '@/api/perfiles'
import { useToast } from '@/context/ToastContext'
import { es } from '@/i18n/es'
import { lugar, nombrePais } from '@/lib/ubicacion'

/**
 * Los selects trabajan con cadenas ("" = sin elegir); al enviar se convierten
 * al contrato y se validan con el esquema compartido, que es el que pone los
 * mensajes (departamento obligatorio en Colombia, etc.).
 */
const esquemaFormulario = z
  .object({
    pais: z.string(),
    departamento: z.string(),
    dispuestoRelocalizar: z.boolean(),
  })
  .transform((valor) => ({
    pais: valor.pais === '' ? null : valor.pais,
    departamento:
      valor.pais === PAIS_CON_DEPARTAMENTO && valor.departamento !== ''
        ? valor.departamento
        : null,
    dispuestoRelocalizar: valor.dispuestoRelocalizar,
  }))
  .pipe(ubicacionJugadorSchema)

type FormularioUbicacion = z.input<typeof esquemaFormulario>

/** Colombia primero (el piloto); el resto, por nombre en español. */
function opcionesPais(): { codigo: string; nombre: string }[] {
  const resto = PAISES.filter((codigo) => codigo !== PAIS_CON_DEPARTAMENTO)
    .map((codigo) => ({ codigo, nombre: nombrePais(codigo) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  return [{ codigo: PAIS_CON_DEPARTAMENTO, nombre: nombrePais(PAIS_CON_DEPARTAMENTO) }, ...resto]
}

const opcionesDepartamento = [...DEPARTAMENTOS].sort((a, b) =>
  es.departamento[a].localeCompare(es.departamento[b], 'es'),
)

function valoresDe(perfil: PerfilJugadorRespuesta): FormularioUbicacion {
  return {
    pais: perfil.pais ?? '',
    departamento: perfil.departamento ?? '',
    dispuestoRelocalizar: perfil.dispuestoRelocalizar,
  }
}

// RF-05 · RF-09 · Ubicacion del jugador: dato real de la cuenta, insumo de la
// dimension geografica del matching. Convive con los datos de demostracion de
// /mi-perfil hasta que la vista entera se conecte con la API.
export function TarjetaUbicacion() {
  const consulta = usePerfilPropio()

  return (
    <Card className="border-emerald-500/30">
      <CardHeader
        title={es.ubicacion.titulo}
        subtitle={es.ubicacion.subtitulo}
        icon={<MapPin size={16} />}
      />
      <div className="space-y-4 p-5">
        {/* En el cuerpo y no en la cabecera: a 375 px la insignia estrechaba el subtitulo. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Badge tono="verde">
            <ShieldCheck size={11} aria-hidden />
            {es.ubicacion.datoReal}
          </Badge>
          {datosDemoActivos && (
            <p className="text-[11px] leading-relaxed text-slate-400">
              {es.ubicacion.datoRealDetalle}
            </p>
          )}
        </div>
        {consulta.isPending ? (
          <div aria-busy="true" aria-label={es.ubicacion.cargando} className="space-y-3">
            <div className="skeleton h-10 rounded-lg" />
            <div className="skeleton h-10 rounded-lg" />
          </div>
        ) : consulta.isError ? (
          <EstadoEnvio
            exito=""
            error={es.ubicacion.errorCarga}
            onReintentar={() => void consulta.refetch()}
          />
        ) : consulta.data.tipo === 'JUGADOR' ? (
          <Formulario perfil={consulta.data.perfil} />
        ) : null}
      </div>
    </Card>
  )
}

function Formulario({ perfil }: { perfil: PerfilJugadorRespuesta }) {
  const { notificar } = useToast()
  const actualizacion = useActualizarUbicacion()
  const [errorGeneral, setErrorGeneral] = useState('')
  const [exito, setExito] = useState(false)
  const paises = useMemo(opcionesPais, [])
  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormularioUbicacion>({
    // raw: el resolver solo valida y entrega los valores del formulario; la
    // conversion al contrato se hace al enviar, con su tipo.
    resolver: zodResolver(esquemaFormulario, undefined, { raw: true }),
    defaultValues: valoresDe(perfil),
  })
  const enColombia = watch('pais') === PAIS_CON_DEPARTAMENTO

  const enviar = handleSubmit(async (valores) => {
    const datos = esquemaFormulario.parse(valores)
    setErrorGeneral('')
    setExito(false)
    try {
      const respuesta = await actualizacion.mutateAsync(datos)
      if (respuesta.tipo === 'JUGADOR') reset(valoresDe(respuesta.perfil))
      setExito(true)
      notificar(es.ubicacion.exito)
    } catch (e) {
      setErrorGeneral(aplicarErrorApi(e, setError))
    }
  })

  const limpiarExito = { onChange: () => setExito(false) }

  return (
    <form onSubmit={enviar} noValidate className="space-y-4">
      {perfil.pais === null ? (
        <div
          role="note"
          className="flex items-start gap-2.5 rounded-xl border border-brand-500/40 bg-brand-500/10 px-3.5 py-2.5"
        >
          <MapPin size={15} className="mt-0.5 shrink-0 text-brand-300" aria-hidden />
          <p className="text-xs leading-relaxed text-slate-300">
            <strong className="font-semibold text-brand-200">
              {es.ubicacion.completaTitulo}
            </strong>
            {' · '}
            {es.ubicacion.completaDetalle}
          </p>
        </div>
      ) : (
        <p className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
          {es.ubicacion.actual(lugar(perfil.pais, perfil.departamento))}
          {perfil.departamento && (
            <Badge tono="cian">
              {es.macrorregion[MACROREGION_POR_DEPARTAMENTO[perfil.departamento]]}
            </Badge>
          )}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={es.ubicacion.pais}>
          <Select
            autoComplete="country"
            aria-invalid={Boolean(errors.pais)}
            {...register('pais', limpiarExito)}
          >
            <option value="">{es.ubicacion.seleccionaPais}</option>
            {paises.map(({ codigo, nombre }) => (
              <option key={codigo} value={codigo}>
                {nombre}
              </option>
            ))}
          </Select>
          <ErrorCampo mensaje={errors.pais?.message} />
        </Field>
        <Field
          label={es.ubicacion.departamento}
          hint={enColombia ? undefined : es.ubicacion.pistaDepartamento}
        >
          <Select
            disabled={!enColombia}
            aria-invalid={Boolean(errors.departamento)}
            {...register('departamento', limpiarExito)}
          >
            <option value="">{es.ubicacion.seleccionaDepartamento}</option>
            {opcionesDepartamento.map((departamento) => (
              <option key={departamento} value={departamento}>
                {es.departamento[departamento]}
              </option>
            ))}
          </Select>
          <ErrorCampo mensaje={errors.departamento?.message} />
        </Field>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/8 bg-white/3 px-4 py-3">
        <input
          type="checkbox"
          className="mt-0.5 size-4 accent-brand-500"
          {...register('dispuestoRelocalizar', limpiarExito)}
        />
        <span>
          <span className="block text-xs font-medium text-slate-200">
            {es.ubicacion.relocalizar}
          </span>
          <span className="mt-0.5 block text-[11px] text-slate-400">
            {es.ubicacion.relocalizarDetalle}
          </span>
        </span>
      </label>

      <EstadoEnvio
        exito={exito ? es.ubicacion.exito : ''}
        error={errorGeneral}
        onReintentar={() => void enviar()}
      />

      <div className="flex justify-end">
        <Button type="submit" cargando={actualizacion.isPending} disabled={!isDirty}>
          {es.ubicacion.guardar}
        </Button>
      </div>
    </form>
  )
}
