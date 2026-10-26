import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  loginSchema,
  registerSchema,
  type LoginInput,
  type Rol,
  type RolRegistrable,
} from '@proplay/shared'
import {
  Database,
  Fingerprint,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button, Field, Input, Select, cn } from '@/components/ui'
import { mensajeDeError } from '@/api/client'
import { CUENTAS_SEMILLA, PASSWORD_SEMILLA } from '@/api/cuentasSemilla'
import { config } from '@/lib/env'
import { es } from '@/i18n/es'

const CUENTAS_DEMO: { rol: Rol; descripcion: string }[] = [
  { rol: 'JUGADOR', descripcion: 'Perfil, postulaciones y endoses' },
  { rol: 'EQUIPO', descripcion: 'Publica vacantes y usa el matching' },
  { rol: 'SCOUT', descripcion: 'Busca y evalua talento' },
  { rol: 'ADMIN', descripcion: 'Gestion, metricas y auditoria' },
]

/**
 * El aviso de privacidad es requisito del registro (RNF-05). El contrato de
 * la API aun no lo recibe, asi que se valida aqui sobre el esquema compartido.
 */
const esquemaRegistro = registerSchema.extend({
  aceptaPrivacidad: z.literal(true, {
    errorMap: () => ({
      message: 'Debes aceptar el aviso de privacidad para continuar (Ley 1581 de 2012).',
    }),
  }),
})
type FormularioRegistro = z.input<typeof esquemaRegistro>

type Modo = 'entrar' | 'registrar'

// RF-01 · Ingreso y registro (misma pantalla, dos modos)
export default function LoginPage() {
  const { entrar, registrar } = useAuth()
  const navegar = useNavigate()
  const [modo, setModo] = useState<Modo>('entrar')
  const [error, setError] = useState<string | null>(null)

  const formEntrar = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })
  const formRegistro = useForm<FormularioRegistro>({
    resolver: zodResolver(esquemaRegistro),
    defaultValues: { nombre: '', email: '', password: '', rol: 'JUGADOR' },
  })
  const form = modo === 'entrar' ? formEntrar : formRegistro
  const errores = form.formState.errors
  const cargando = form.formState.isSubmitting
  const email = formEntrar.watch('email')

  const alEntrar = formEntrar.handleSubmit(async (datos) => {
    setError(null)
    try {
      await entrar(datos)
      navegar('/')
    } catch (e) {
      setError(mensajeDeError(e, 'No pudimos iniciar tu sesion.'))
    }
  })

  const alRegistrar = formRegistro.handleSubmit(async (datos) => {
    setError(null)
    try {
      const { nombre, email, password, rol } = esquemaRegistro.parse(datos)
      await registrar({ nombre, email, password, rol })
      navegar('/')
    } catch (e) {
      setError(mensajeDeError(e, 'No pudimos crear tu cuenta.'))
    }
  })

  const usarCuenta = (correo: string) => {
    formEntrar.setValue('email', correo)
    formEntrar.setValue('password', PASSWORD_SEMILLA)
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* ------------------------------ Marca ------------------------------ */}
      <div className="relative hidden overflow-hidden border-r border-white/8 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="grid-bg absolute inset-0 opacity-60" />
        <div className="absolute -left-32 top-1/3 size-[30rem] rounded-full bg-brand-600/18 blur-[110px]" />
        <div className="absolute -right-24 bottom-0 size-[26rem] rounded-full bg-accent-600/14 blur-[110px]" />

        <div className="relative">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="" className="size-11 rounded-xl" />
            <div>
              <p className="text-xl font-bold leading-none tracking-tight text-slate-50">
                Pro<span className="gradient-text">Play</span>
              </p>
              <p className="text-xs text-slate-500">
                Plataforma Web para el Scouting de Talento en eSports
              </p>
            </div>
          </div>
        </div>

        <div className="relative max-w-lg">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-slate-50">
            De la{' '}
            <span className="gradient-text">declaracion sin verificar</span> a la
            evidencia comprobable.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            ProPlay convierte las senales no verificables del scouting de eSports en
            rankings de compatibilidad trazables, ingiriendo las estadisticas
            directamente desde las APIs oficiales de los juegos.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              { icono: Database, titulo: 'Ingesta directa', texto: 'OAuth 2.0 + API oficial' },
              { icono: Sparkles, titulo: 'Matching hibrido', texto: 'pgvector + Transformer' },
              { icono: ShieldCheck, titulo: 'Trazable', texto: 'Ranking explicable' },
            ].map((f) => (
              <div key={f.titulo} className="card p-3.5">
                <f.icono size={16} className="text-brand-400" />
                <p className="mt-2 text-xs font-semibold text-slate-200">{f.titulo}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{f.texto}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-[11px] text-slate-600">
          Universidad del Norte · Departamento de Ingenieria de Sistemas · 2026
        </p>
      </div>

      {/* ------------------------------ Formulario ------------------------------ */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2.5">
              <img src="/logo.svg" alt="" className="size-9 rounded-lg" />
              <p className="text-lg font-bold text-slate-50">
                Pro<span className="gradient-text">Play</span>
              </p>
            </div>
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-slate-50">
            {modo === 'entrar' ? 'Iniciar sesion' : 'Crear cuenta'}
          </h2>
          <p className="mt-1.5 text-sm text-slate-500">
            {modo === 'entrar'
              ? 'Accede a tu espacio de trabajo segun tu rol.'
              : 'Registra tu perfil y empieza a construir evidencia verificable.'}
          </p>

          {/* Selector de modo */}
          <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl border border-white/8 bg-white/3 p-1">
            {[
              { id: 'entrar' as const, l: 'Iniciar sesion' },
              { id: 'registrar' as const, l: 'Crear cuenta' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setModo(t.id)
                  setError(null)
                }}
                className={cn(
                  'rounded-lg px-3 py-2 text-xs font-medium transition',
                  modo === t.id
                    ? 'bg-brand-500/20 text-brand-200'
                    : 'text-slate-500 hover:text-slate-300',
                )}
              >
                {t.l}
              </button>
            ))}
          </div>

          <form
            key={modo}
            onSubmit={modo === 'entrar' ? alEntrar : alRegistrar}
            className="mt-5 space-y-4"
            noValidate
          >
            {modo === 'registrar' && (
              <Field label="Nombre completo">
                <Input
                  placeholder="Daniel Ocoro"
                  autoComplete="name"
                  aria-invalid={Boolean(formRegistro.formState.errors.nombre)}
                  {...formRegistro.register('nombre')}
                />
                <ErrorCampo mensaje={formRegistro.formState.errors.nombre?.message} />
              </Field>
            )}

            <Field label="Correo electronico">
              <Input
                type="email"
                placeholder="tucorreo@dominio.com"
                autoComplete="email"
                aria-invalid={Boolean(errores.email)}
                {...(modo === 'entrar'
                  ? formEntrar.register('email')
                  : formRegistro.register('email'))}
              />
              <ErrorCampo mensaje={errores.email?.message} />
            </Field>

            <Field label="Contraseña">
              <Input
                type="password"
                placeholder="••••••••"
                autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
                aria-invalid={Boolean(errores.password)}
                {...(modo === 'entrar'
                  ? formEntrar.register('password')
                  : formRegistro.register('password'))}
              />
              <ErrorCampo mensaje={errores.password?.message} />
            </Field>

            {modo === 'registrar' && (
              <Field label="Rol en la plataforma">
                <Select {...formRegistro.register('rol')}>
                  {(['JUGADOR', 'EQUIPO', 'SCOUT'] satisfies RolRegistrable[]).map((r) => (
                    <option key={r} value={r}>
                      {es.rol[r]}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            {modo === 'registrar' && (
              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/8 bg-white/3 px-3.5 py-3">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 accent-[#7c4df5]"
                  {...formRegistro.register('aceptaPrivacidad')}
                />
                <span className="text-[11px] leading-relaxed text-slate-400">
                  He leido y acepto el aviso de privacidad de ProPlay, el
                  tratamiento de mis datos personales conforme a la Ley 1581 de
                  2012 y el tratamiento de mis estadisticas de juego para construir
                  mi perfil profesional.
                </span>
              </label>
            )}
            {modo === 'registrar' && (
              <ErrorCampo mensaje={formRegistro.formState.errors.aceptaPrivacidad?.message} />
            )}

            {error && (
              <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                {error}
              </p>
            )}

            <Button
              type="submit"
              tamano="lg"
              cargando={cargando}
              className="w-full"
            >
              {!cargando &&
                (modo === 'entrar' ? <Lock size={16} /> : <UserPlus size={16} />)}
              {modo === 'entrar' ? 'Entrar a ProPlay' : 'Crear mi cuenta'}
            </Button>
          </form>

          {modo === 'entrar' && config.esDesarrollo && (
            <>
              <div className="my-7 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/8" />
                <span className="text-[11px] uppercase tracking-wider text-slate-600">
                  Cuentas de demostracion
                </span>
                <div className="h-px flex-1 bg-white/8" />
              </div>

              <div className="space-y-2">
                {CUENTAS_DEMO.map((c) => {
                  const usuario = CUENTAS_SEMILLA.find((u) => u.rol === c.rol)
                  if (!usuario) return null
                  return (
                    <button
                      key={c.rol}
                      type="button"
                      onClick={() => usarCuenta(usuario.email)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl border border-white/8 bg-white/3 p-3 text-left transition',
                        'hover:border-brand-500/40 hover:bg-white/6',
                        email === usuario.email && 'border-brand-500/50 bg-brand-500/8',
                      )}
                    >
                      <Fingerprint size={17} className="shrink-0 text-brand-400" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-slate-200">
                          {usuario.nombre}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">
                          {c.descripcion}
                        </p>
                      </div>
                      <Users size={14} className="shrink-0 text-slate-600" />
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {cargando && (
            <p className="mt-5 flex items-center justify-center gap-2 text-[11px] text-slate-500">
              <Loader2 size={13} className="animate-spin" />
              {modo === 'entrar'
                ? 'Verificando credenciales...'
                : 'Creando tu cuenta...'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function ErrorCampo({ mensaje }: { mensaje?: string }) {
  if (!mensaje) return null
  return (
    <span role="alert" className="mt-1 block text-[11px] text-rose-300">
      {mensaje}
    </span>
  )
}
