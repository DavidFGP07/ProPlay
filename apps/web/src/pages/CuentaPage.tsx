import { useState } from 'react'
import { useForm, type FieldValues, type Path, type UseFormSetError } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import axios from 'axios'
import { CheckCircle2, KeyRound, RotateCcw, UserRound } from 'lucide-react'
import {
  actualizarUsuarioSchema,
  cambioContrasenaSchema,
  type ActualizarUsuarioInput,
  type ErrorResponse,
  type UsuarioPublico,
} from '@proplay/shared'
import { Button, Card, CardHeader, ErrorCampo, Field, Input, SectionTitle } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useActualizarCuenta, useCambiarContrasena } from '@/api/cuenta'
import { es } from '@/i18n/es'

/**
 * La confirmacion es solo de interfaz: la API recibe el esquema compartido.
 */
const esquemaContrasena = cambioContrasenaSchema
  .and(z.object({ confirmacion: z.string() }))
  .refine((valor) => valor.confirmacion === valor.contrasenaNueva, {
    message: es.cuenta.errores.confirmacion,
    path: ['confirmacion'],
  })
type FormularioContrasena = z.input<typeof esquemaContrasena>

/**
 * Lleva los errores de la API al formulario: los de validacion (422) a su
 * campo y el resto a un mensaje general. Devuelve ese mensaje, si lo hay.
 */
function aplicarErrorApi<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  porCodigo: Partial<Record<string, { campo: Path<T>; mensaje: string }>> = {},
): string {
  if (!axios.isAxiosError<ErrorResponse>(error) || !error.response) {
    return es.cuenta.errores.generico
  }
  const { status, data } = error.response
  const especifico = data?.error?.code ? porCodigo[data.error.code] : undefined
  if (especifico) {
    setError(especifico.campo, { message: especifico.mensaje })
    return ''
  }
  const campos = (data?.error?.details as { campos?: { campo: string; mensaje: string }[] })
    ?.campos
  if (status === 422 && campos?.length) {
    for (const { campo, mensaje } of campos) setError(campo as Path<T>, { message: mensaje })
    return ''
  }
  if (status === 429) return es.cuenta.errores.demasiadosIntentos
  return es.cuenta.errores.generico
}

// RF-01 · RNF-05 · Ajustes de cuenta: nombre y contraseña, para los cuatro roles
export default function CuentaPage() {
  const { usuario } = useAuth()
  if (!usuario) return null

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <SectionTitle title={es.cuenta.titulo} subtitle={es.cuenta.subtitulo} />
      <DatosCuenta usuario={usuario} />
      <CambioContrasena />
    </div>
  )
}

function DatosCuenta({ usuario }: { usuario: UsuarioPublico }) {
  const { notificar } = useToast()
  const actualizacion = useActualizarCuenta()
  const [errorGeneral, setErrorGeneral] = useState('')
  const [exito, setExito] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm<ActualizarUsuarioInput>({
    resolver: zodResolver(actualizarUsuarioSchema),
    defaultValues: { nombre: usuario.nombre },
  })

  const enviar = handleSubmit(async (datos) => {
    setErrorGeneral('')
    setExito(false)
    try {
      const actualizado = await actualizacion.mutateAsync(datos)
      reset({ nombre: actualizado.nombre })
      setExito(true)
      notificar(es.cuenta.datos.exito)
    } catch (e) {
      setErrorGeneral(aplicarErrorApi(e, setError))
    }
  })

  return (
    <Card>
      <CardHeader
        title={es.cuenta.datos.titulo}
        subtitle={es.cuenta.datos.subtitulo}
        icon={<UserRound size={16} />}
      />
      <form onSubmit={enviar} noValidate className="space-y-4 p-5">
        <Field label={es.cuenta.datos.nombre}>
          <Input
            autoComplete="name"
            aria-invalid={Boolean(errors.nombre)}
            {...register('nombre', { onChange: () => setExito(false) })}
          />
          <ErrorCampo mensaje={errors.nombre?.message} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={es.cuenta.datos.correo}>
            <Input value={usuario.email} readOnly aria-readonly className="opacity-70" />
          </Field>
          <Field label={es.cuenta.datos.rol}>
            <Input value={es.rol[usuario.rol]} readOnly aria-readonly className="opacity-70" />
          </Field>
        </div>

        <Estado
          exito={exito ? es.cuenta.datos.exito : ''}
          error={errorGeneral}
          onReintentar={() => void enviar()}
        />

        <div className="flex justify-end">
          <Button type="submit" cargando={actualizacion.isPending} disabled={!isDirty}>
            {es.cuenta.datos.guardar}
          </Button>
        </div>
      </form>
    </Card>
  )
}

function CambioContrasena() {
  const { notificar } = useToast()
  const cambio = useCambiarContrasena()
  const [errorGeneral, setErrorGeneral] = useState('')
  const [exito, setExito] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormularioContrasena>({
    resolver: zodResolver(esquemaContrasena),
    defaultValues: { contrasenaActual: '', contrasenaNueva: '', confirmacion: '' },
  })

  const enviar = handleSubmit(async ({ contrasenaActual, contrasenaNueva }) => {
    setErrorGeneral('')
    setExito(false)
    try {
      await cambio.mutateAsync({ contrasenaActual, contrasenaNueva })
      reset()
      setExito(true)
      notificar(es.cuenta.contrasena.exito)
    } catch (e) {
      setErrorGeneral(
        aplicarErrorApi(e, setError, {
          CONTRASENA_ACTUAL_INVALIDA: {
            campo: 'contrasenaActual',
            mensaje: es.cuenta.errores.actualInvalida,
          },
        }),
      )
    }
  })

  return (
    <Card>
      <CardHeader
        title={es.cuenta.contrasena.titulo}
        subtitle={es.cuenta.contrasena.subtitulo}
        icon={<KeyRound size={16} />}
      />
      <form onSubmit={enviar} noValidate className="space-y-4 p-5">
        <Field label={es.cuenta.contrasena.actual}>
          <Input
            type="password"
            autoComplete="current-password"
            aria-invalid={Boolean(errors.contrasenaActual)}
            {...register('contrasenaActual')}
          />
          <ErrorCampo mensaje={errors.contrasenaActual?.message} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={es.cuenta.contrasena.nueva} hint={es.cuenta.contrasena.pista}>
            <Input
              type="password"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.contrasenaNueva)}
              {...register('contrasenaNueva')}
            />
            <ErrorCampo mensaje={errors.contrasenaNueva?.message} />
          </Field>
          <Field label={es.cuenta.contrasena.confirmacion}>
            <Input
              type="password"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.confirmacion)}
              {...register('confirmacion')}
            />
            <ErrorCampo mensaje={errors.confirmacion?.message} />
          </Field>
        </div>

        <Estado
          exito={exito ? es.cuenta.contrasena.exito : ''}
          error={errorGeneral}
          onReintentar={() => void enviar()}
        />

        <div className="flex justify-end">
          <Button type="submit" cargando={cambio.isPending}>
            {es.cuenta.contrasena.guardar}
          </Button>
        </div>
      </form>
    </Card>
  )
}

/** Resultado del ultimo envio: exito o error general con reintento. */
function Estado({
  exito,
  error,
  onReintentar,
}: {
  exito: string
  error: string
  onReintentar: () => void
}) {
  if (error) {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2"
      >
        <p className="text-xs text-rose-300">{error}</p>
        <Button variante="secundario" tamano="sm" onClick={onReintentar}>
          <RotateCcw size={13} aria-hidden />
          {es.cuenta.reintentar}
        </Button>
      </div>
    )
  }
  if (exito) {
    return (
      <p
        role="status"
        className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300"
      >
        <CheckCircle2 size={14} aria-hidden />
        {exito}
      </p>
    )
  }
  return null
}
