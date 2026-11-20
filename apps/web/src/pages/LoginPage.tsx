import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  loginSchema,
  registerSchema,
  type LoginInput,
  type RegisterInput,
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
import { Button, ErrorCampo, Field, Input, Select, cn } from '@/components/ui'
import { mensajeDeError } from '@/api/client'
import { CUENTAS_SEMILLA, PASSWORD_SEMILLA } from '@/api/cuentasSemilla'
import { config } from '@/lib/env'
import { es } from '@/i18n/es'
import { DESCARGO_RIOT } from '@/i18n/legal'

const t = es.login

const ROLES_DEMO: Rol[] = ['JUGADOR', 'EQUIPO', 'SCOUT', 'ADMIN']
const ICONOS_RASGOS = [Database, Sparkles, ShieldCheck]

/**
 * El registro valida con el esquema compartido, que ya exige aceptar el aviso
 * de privacidad y declarar la mayoria de edad (RNF-05).
 */
type FormularioRegistro = Omit<RegisterInput, 'aceptaPrivacidad' | 'declaraMayorEdad'> & {
  aceptaPrivacidad: boolean
  declaraMayorEdad: boolean
}

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
    resolver: zodResolver(registerSchema),
    defaultValues: {
      nombre: '',
      email: '',
      password: '',
      rol: 'JUGADOR',
      aceptaPrivacidad: false,
      declaraMayorEdad: false,
    },
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
      setError(mensajeDeError(e, t.errorEntrar))
    }
  })

  const alRegistrar = formRegistro.handleSubmit(async (datos) => {
    setError(null)
    try {
      await registrar(registerSchema.parse(datos))
      navegar('/')
    } catch (e) {
      setError(mensajeDeError(e, t.errorRegistrar))
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
              <p className="text-xs text-slate-500">{t.lema}</p>
            </div>
          </div>
        </div>

        <div className="relative max-w-lg">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-slate-50">
            {t.titularInicio} <span className="gradient-text">{t.titularResaltado}</span>{' '}
            {t.titularFin}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">{t.presentacion}</p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {t.rasgos.map((f, i) => {
              const Icono = ICONOS_RASGOS[i] ?? ShieldCheck
              return (
              <div key={f.titulo} className="card p-3.5">
                <Icono size={16} className="text-brand-400" aria-hidden />
                <p className="mt-2 text-xs font-semibold text-slate-200">{f.titulo}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{f.texto}</p>
              </div>
              )
            })}
          </div>
        </div>

        <p className="relative text-[11px] text-slate-600">
          {t.pie}
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
            {modo === 'entrar' ? t.tituloEntrar : t.tituloRegistrar}
          </h2>
          <p className="mt-1.5 text-sm text-slate-500">
            {modo === 'entrar' ? t.subtituloEntrar : t.subtituloRegistrar}
          </p>

          {/* Selector de modo */}
          <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl border border-white/8 bg-white/3 p-1">
            {[
              { id: 'entrar' as const, l: t.pestanaEntrar },
              { id: 'registrar' as const, l: t.pestanaRegistrar },
            ].map((pestana) => (
              <button
                key={pestana.id}
                type="button"
                onClick={() => {
                  setModo(pestana.id)
                  setError(null)
                }}
                className={cn(
                  'rounded-lg px-3 py-2 text-xs font-medium transition',
                  modo === pestana.id
                    ? 'bg-brand-500/20 text-brand-200'
                    : 'text-slate-500 hover:text-slate-300',
                )}
              >
                {pestana.l}
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
              <Field label={t.nombre}>
                <Input
                  placeholder={t.nombreEjemplo}
                  autoComplete="name"
                  aria-invalid={Boolean(formRegistro.formState.errors.nombre)}
                  {...formRegistro.register('nombre')}
                />
                <ErrorCampo mensaje={formRegistro.formState.errors.nombre?.message} />
              </Field>
            )}

            <Field label={t.correo}>
              <Input
                type="email"
                placeholder={t.correoEjemplo}
                autoComplete="email"
                aria-invalid={Boolean(errores.email)}
                {...(modo === 'entrar'
                  ? formEntrar.register('email')
                  : formRegistro.register('email'))}
              />
              <ErrorCampo mensaje={errores.email?.message} />
            </Field>

            <Field label={t.contrasena}>
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
              <Field label={t.rol}>
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
                  {es.registro.acepto}{' '}
                  <EnlaceLegal ancla="privacidad">{es.registro.avisoPrivacidad}</EnlaceLegal>{' '}
                  {es.registro.y}{' '}
                  <EnlaceLegal ancla="terminos">{es.registro.terminos}</EnlaceLegal>{' '}
                  {es.registro.autorizo}
                </span>
              </label>
            )}
            {modo === 'registrar' && (
              <ErrorCampo mensaje={formRegistro.formState.errors.aceptaPrivacidad?.message} />
            )}

            {modo === 'registrar' && (
              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/8 bg-white/3 px-3.5 py-3">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 accent-[#7c4df5]"
                  aria-invalid={Boolean(formRegistro.formState.errors.declaraMayorEdad)}
                  {...formRegistro.register('declaraMayorEdad')}
                />
                <span className="text-[11px] leading-relaxed text-slate-400">
                  {es.registro.mayorEdad}
                </span>
              </label>
            )}
            {modo === 'registrar' && (
              <ErrorCampo mensaje={formRegistro.formState.errors.declaraMayorEdad?.message} />
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
              {modo === 'entrar' ? t.entrar : t.registrar}
            </Button>
          </form>

          {modo === 'entrar' && config.esDesarrollo && (
            <>
              <div className="my-7 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/8" />
                <span className="text-[11px] uppercase tracking-wider text-slate-600">
                  {t.cuentasDemo}
                </span>
                <div className="h-px flex-1 bg-white/8" />
              </div>

              <div className="space-y-2">
                {ROLES_DEMO.map((rol) => {
                  const usuario = CUENTAS_SEMILLA.find((u) => u.rol === rol)
                  if (!usuario) return null
                  return (
                    <button
                      key={rol}
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
                          {t.descripcionDemo[rol]}
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
              {modo === 'entrar' ? t.entrando : t.registrando}
            </p>
          )}

          <footer className="mt-8 space-y-2 border-t border-white/8 pt-4">
            <Link
              to="/legal/privacidad"
              className="text-[11px] text-slate-400 underline underline-offset-2 hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
            >
              {es.legal.enlace}
            </Link>
            <p className="text-[10px] leading-relaxed text-slate-600" lang="en">
              {DESCARGO_RIOT}
            </p>
          </footer>
        </div>
      </div>
    </div>
  )
}

/** Enlace a una seccion del aviso legal, en una pestaña nueva para no perder el formulario. */
function EnlaceLegal({ ancla, children }: { ancla: 'privacidad' | 'terminos'; children: string }) {
  return (
    <a
      href={`/legal/privacidad#${ancla}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-brand-300 underline underline-offset-2 hover:text-brand-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
    >
      {children}
      <span className="sr-only"> {es.registro.nuevaPestana}</span>
    </a>
  )
}
