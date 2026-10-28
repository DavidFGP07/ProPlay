import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { MapPin, Save } from 'lucide-react'
import {
  DEPARTAMENTOS,
  PAIS_CON_DEPARTAMENTO,
  PAISES,
  perfilJugadorSchema,
  type PerfilJugadorRespuesta,
} from '@proplay/shared'
import {
  Button,
  ErrorCampo,
  EstadoEnvio,
  Field,
  Input,
  Select,
  Textarea,
} from '@/components/ui'
import { aplicarErrorApi } from '@/api/errores'
import { useActualizarPerfilJugador } from '@/api/perfiles'
import { useToast } from '@/context/ToastContext'
import { es } from '@/i18n/es'
import { nombrePais } from '@/lib/ubicacion'

const t = es.miPerfil

/** Límite de la presentación en el contrato; el contador lo muestra. */
const MAXIMO_BIO = 1000

/**
 * Los campos trabajan con cadenas ("" = sin dato); al enviar se convierten al
 * contrato y se validan con el esquema compartido, que es el que pone las
 * reglas (departamento obligatorio en Colombia, rango de horas, etc.).
 */
const esquemaFormulario = z
  .object({
    bio: z.string(),
    disponibilidadHoras: z.string(),
    pais: z.string(),
    departamento: z.string(),
    dispuestoRelocalizar: z.boolean(),
  })
  .transform((valor) => ({
    bio: valor.bio,
    // Vacío no se envía: la API no admite borrar la disponibilidad.
    disponibilidadHoras:
      valor.disponibilidadHoras.trim() === '' ? undefined : Number(valor.disponibilidadHoras),
    pais: valor.pais === '' ? null : valor.pais,
    departamento:
      valor.pais === PAIS_CON_DEPARTAMENTO && valor.departamento !== ''
        ? valor.departamento
        : null,
    dispuestoRelocalizar: valor.dispuestoRelocalizar,
  }))
  .pipe(perfilJugadorSchema)

type FormularioPerfil = z.input<typeof esquemaFormulario>

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

function valoresDe(perfil: PerfilJugadorRespuesta): FormularioPerfil {
  return {
    bio: perfil.bio ?? '',
    disponibilidadHoras:
      perfil.disponibilidadHoras === null ? '' : String(perfil.disponibilidadHoras),
    pais: perfil.pais ?? '',
    departamento: perfil.departamento ?? '',
    dispuestoRelocalizar: perfil.dispuestoRelocalizar,
  }
}

// RF-05 · RF-09 · Datos profesionales del jugador: presentación, disponibilidad
// y ubicación (insumo de la dimensión geográfica del matching). API real:
// PATCH /api/v1/perfiles/jugador.
export function DatosProfesionales({ perfil }: { perfil: PerfilJugadorRespuesta }) {
  const { notificar } = useToast()
  const actualizacion = useActualizarPerfilJugador()
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
  } = useForm<FormularioPerfil>({
    // raw: el resolver solo valida y entrega los valores del formulario; la
    // conversion al contrato se hace al enviar, con su tipo.
    resolver: zodResolver(esquemaFormulario, undefined, { raw: true }),
    defaultValues: valoresDe(perfil),
  })
  const enColombia = watch('pais') === PAIS_CON_DEPARTAMENTO
  const largoBio = watch('bio').length

  const enviar = handleSubmit(async (valores) => {
    const datos = esquemaFormulario.parse(valores)
    setErrorGeneral('')
    setExito(false)
    try {
      const respuesta = await actualizacion.mutateAsync(datos)
      if (respuesta.tipo === 'JUGADOR') reset(valoresDe(respuesta.perfil))
      setExito(true)
      notificar(t.exito)
    } catch (e) {
      setErrorGeneral(aplicarErrorApi(e, setError))
    }
  })

  const limpiarExito = { onChange: () => setExito(false) }

  return (
    <form onSubmit={enviar} noValidate className="space-y-5">
      <Field label={t.bio} hint={t.bioPista(largoBio, MAXIMO_BIO)}>
        <Textarea
          rows={4}
          maxLength={MAXIMO_BIO}
          placeholder={t.bioPlaceholder}
          aria-invalid={Boolean(errors.bio)}
          {...register('bio', limpiarExito)}
        />
        <ErrorCampo mensaje={errors.bio?.message} />
      </Field>

      <Field label={t.horas} hint={t.horasPista} className="sm:max-w-xs">
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          max={80}
          step={1}
          aria-invalid={Boolean(errors.disponibilidadHoras)}
          {...register('disponibilidadHoras', limpiarExito)}
        />
        <ErrorCampo mensaje={errors.disponibilidadHoras?.message} />
      </Field>

      <fieldset className="space-y-4 rounded-xl border border-white/8 bg-white/3 p-4">
        <legend className="flex items-center gap-1.5 px-1 text-xs font-semibold text-slate-200">
          <MapPin size={13} aria-hidden />
          {es.ubicacion.titulo}
        </legend>
        <p className="text-[11px] leading-relaxed text-slate-400">{es.ubicacion.subtitulo}</p>

        {perfil.pais === null && (
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
      </fieldset>

      <EstadoEnvio
        exito={exito ? t.exito : ''}
        error={errorGeneral}
        onReintentar={() => void enviar()}
      />

      <div className="flex justify-end">
        <Button type="submit" cargando={actualizacion.isPending} disabled={!isDirty}>
          <Save size={14} aria-hidden />
          {t.guardar}
        </Button>
      </div>

      <p className="text-[11px] leading-relaxed text-slate-400">{t.notaEvidencia}</p>
    </form>
  )
}
