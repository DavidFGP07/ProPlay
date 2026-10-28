import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Building2, ExternalLink, Save } from 'lucide-react'
import { perfilEquipoSchema, type PerfilEquipoRespuesta } from '@proplay/shared'
import {
  Button,
  Card,
  CardHeader,
  ErrorCampo,
  EstadoEnvio,
  Field,
  Input,
  Textarea,
} from '@/components/ui'
import { aplicarErrorApi } from '@/api/errores'
import { useActualizarPerfilEquipo, usePerfilPropio } from '@/api/perfiles'
import { useToast } from '@/context/ToastContext'
import { es } from '@/i18n/es'

const t = es.organizacion

/** Límite de la descripción en el contrato; el contador lo muestra. */
const MAXIMO_DESCRIPCION = 1000

/**
 * Los campos trabajan con cadenas; al enviar, un campo opcional vacío va como
 * `null` (borrar) y el resultado se valida con el esquema compartido, que pone
 * las reglas (nombre obligatorio, sitio web sólo http/https).
 */
const esquemaFormulario = z
  .object({
    nombreOrg: z.string(),
    descripcion: z.string(),
    sitioWeb: z.string(),
  })
  .transform((valor) => ({
    nombreOrg: valor.nombreOrg,
    descripcion: valor.descripcion.trim() === '' ? null : valor.descripcion,
    sitioWeb: valor.sitioWeb.trim() === '' ? null : valor.sitioWeb,
  }))
  .pipe(perfilEquipoSchema)

type FormularioOrganizacion = z.input<typeof esquemaFormulario>

function valoresDe(perfil: PerfilEquipoRespuesta): FormularioOrganizacion {
  return {
    nombreOrg: perfil.nombreOrg,
    descripcion: perfil.descripcion ?? '',
    sitioWeb: perfil.sitioWeb ?? '',
  }
}

// RF-07 · Datos de la organización: nombre, descripción y sitio web. API real:
// GET /api/v1/perfiles/me y PATCH /api/v1/perfiles/equipo. Sólo la ve el rol
// EQUIPO; el scout no tiene perfil propio.
export function DatosOrganizacion() {
  const consulta = usePerfilPropio()

  return (
    <Card>
      <CardHeader title={t.titulo} subtitle={t.subtitulo} icon={<Building2 size={16} />} />
      <div className="p-5">
        {consulta.isPending ? (
          <div aria-busy="true" aria-label={t.cargando} className="space-y-3">
            <div className="skeleton h-10 rounded-lg" />
            <div className="skeleton h-24 rounded-lg" />
            <div className="skeleton h-10 rounded-lg" />
          </div>
        ) : consulta.isError ? (
          <EstadoEnvio exito="" error={t.errorCarga} onReintentar={() => void consulta.refetch()} />
        ) : consulta.data.tipo === 'EQUIPO' ? (
          <Formulario perfil={consulta.data.perfil} />
        ) : null}
      </div>
    </Card>
  )
}

function Formulario({ perfil }: { perfil: PerfilEquipoRespuesta }) {
  const { notificar } = useToast()
  const actualizacion = useActualizarPerfilEquipo()
  const [errorGeneral, setErrorGeneral] = useState('')
  const [exito, setExito] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormularioOrganizacion>({
    // raw: el resolver solo valida y entrega los valores del formulario; la
    // conversion al contrato se hace al enviar, con su tipo.
    resolver: zodResolver(esquemaFormulario, undefined, { raw: true }),
    defaultValues: valoresDe(perfil),
  })
  const largoDescripcion = watch('descripcion').length

  const enviar = handleSubmit(async (valores) => {
    const datos = esquemaFormulario.parse(valores)
    setErrorGeneral('')
    setExito(false)
    try {
      const respuesta = await actualizacion.mutateAsync(datos)
      if (respuesta.tipo === 'EQUIPO') reset(valoresDe(respuesta.perfil))
      setExito(true)
      notificar(t.exito)
    } catch (e) {
      setErrorGeneral(aplicarErrorApi(e, setError))
    }
  })

  const limpiarExito = { onChange: () => setExito(false) }

  return (
    <form onSubmit={enviar} noValidate className="space-y-5">
      {perfil.sitioWeb && (
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
          {t.sitioWebActual}
          <a
            href={perfil.sitioWeb}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-w-0 items-center gap-1 break-all text-brand-300 underline-offset-2 hover:text-brand-200 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
          >
            {perfil.sitioWeb}
            <ExternalLink size={12} className="shrink-0" aria-hidden />
            <span className="sr-only"> {es.enlaceExterno}</span>
          </a>
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.nombre}>
          <Input
            autoComplete="organization"
            aria-invalid={Boolean(errors.nombreOrg)}
            {...register('nombreOrg', limpiarExito)}
          />
          <ErrorCampo mensaje={errors.nombreOrg?.message} />
        </Field>
        <Field label={t.sitioWeb} hint={t.sitioWebPista}>
          <Input
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="https://"
            aria-invalid={Boolean(errors.sitioWeb)}
            {...register('sitioWeb', limpiarExito)}
          />
          <ErrorCampo mensaje={errors.sitioWeb?.message} />
        </Field>
      </div>

      <Field
        label={t.descripcion}
        hint={t.descripcionPista(largoDescripcion, MAXIMO_DESCRIPCION)}
      >
        <Textarea
          rows={4}
          maxLength={MAXIMO_DESCRIPCION}
          placeholder={t.descripcionPlaceholder}
          aria-invalid={Boolean(errors.descripcion)}
          {...register('descripcion', limpiarExito)}
        />
        <ErrorCampo mensaje={errors.descripcion?.message} />
      </Field>

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
    </form>
  )
}
