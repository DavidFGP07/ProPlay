import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { usuariosDemo } from '@/mocks/api'
import type { Region, Usuario } from '@/types'

const CUENTAS_DEMO: { rol: Usuario['rol']; descripcion: string }[] = [
  { rol: 'jugador', descripcion: 'Perfil, postulaciones y endoses' },
  { rol: 'equipo', descripcion: 'Publica vacantes y usa el matching' },
  { rol: 'scout', descripcion: 'Busca y evalua talento' },
  { rol: 'admin', descripcion: 'Gestion, metricas y auditoria' },
]

const REGIONES: Region[] = [
  'Barranquilla',
  'Cartagena',
  'Santa Marta',
  'Cúcuta',
  'Bucaramanga',
  'Medellín',
  'Bogotá',
  'Cali',
]

type Modo = 'entrar' | 'registrar'

export default function LoginPage() {
  const { entrar, registrar, cargando, error } = useAuth()
  const navegar = useNavigate()
  const [modo, setModo] = useState<Modo>('entrar')
  const [email, setEmail] = useState('daniel.ocoro@gmail.com')
  const [nombre, setNombre] = useState('')
  const [rol, setRol] = useState<Usuario['rol']>('jugador')
  const [region, setRegion] = useState<Region>('Barranquilla')
  const [aceptaPrivacidad, setAceptaPrivacidad] = useState(false)

  const manejarSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const ok =
      modo === 'entrar'
        ? await entrar(email)
        : await registrar({ nombre, email, rol, region, aceptaPrivacidad })
    if (ok) navegar('/')
  }

  const usuarios = usuariosDemo()

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
                onClick={() => setModo(t.id)}
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

          <form onSubmit={manejarSubmit} className="mt-5 space-y-4">
            {modo === 'registrar' && (
              <Field label="Nombre completo">
                <Input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Daniel Ocoro"
                  required
                />
              </Field>
            )}

            <Field label="Correo electronico">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tucorreo@dominio.com"
                required
              />
            </Field>

            {modo === 'registrar' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Rol en la plataforma">
                  <Select
                    value={rol}
                    onChange={(e) => setRol(e.target.value as Usuario['rol'])}
                  >
                    <option value="jugador">Jugador</option>
                    <option value="equipo">Equipo</option>
                    <option value="scout">Scout</option>
                    <option value="admin">Administrador</option>
                  </Select>
                </Field>
                <Field label="Region">
                  <Select
                    value={region}
                    onChange={(e) => setRegion(e.target.value as Region)}
                  >
                    {REGIONES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            )}

            {modo === 'registrar' && (
              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/8 bg-white/3 px-3.5 py-3">
                <input
                  type="checkbox"
                  checked={aceptaPrivacidad}
                  onChange={(e) => setAceptaPrivacidad(e.target.checked)}
                  required
                  className="mt-0.5 size-4 shrink-0 accent-[#7c4df5]"
                />
                <span className="text-[11px] leading-relaxed text-slate-400">
                  He leido y acepto el aviso de privacidad de ProPlay, el
                  tratamiento de mis datos personales conforme a la Ley 1581 de
                  2012 y el tratamiento de mis estadisticas de juego para construir
                  mi perfil profesional.
                </span>
              </label>
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

          {modo === 'entrar' && (
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
                  const usuario = usuarios.find((u) => u.rol === c.rol)
                  if (!usuario) return null
                  return (
                    <button
                      key={c.rol}
                      type="button"
                      onClick={() => setEmail(usuario.email)}
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
