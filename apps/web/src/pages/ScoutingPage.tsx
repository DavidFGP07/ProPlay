import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BadgeCheck,
  Filter,
  MapPin,
  Search,
  SlidersHorizontal,
  Users,
  X,
} from 'lucide-react'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Select,
  Stat,
  cn,
} from '@/components/ui'
import { useJugadores } from '@/api/matching'
import { DIMENSIONES } from '@/lib/matching'
import type { FiltrosBusqueda } from '@/mocks/modelos'

const JUEGOS = ['Todos', 'League of Legends', 'Valorant', 'Counter-Strike 2', 'Rocket League', 'Dota 2'] as const
const REGIONES = [
  'Todas',
  'Barranquilla',
  'Cartagena',
  'Santa Marta',
  'Bogotá',
  'Medellín',
  'Cali',
  'Bucaramanga',
  'Cúcuta',
] as const
const RANGOS = [
  'Todos',
  'Hierro',
  'Bronce',
  'Plata',
  'Oro',
  'Platino',
  'Diamante',
  'Ascendente',
  'Inmortal',
  'Radiante',
  'Master',
  'Grandmaster',
  'Global Elite',
  'Champions II',
] as const
const DISPONIBILIDAD = [
  { v: 'cualquiera', l: 'Cualquiera' },
  { v: 'inmediata', l: 'Inmediata (30 h+)' },
  { v: 'media', l: 'Media (20-29 h)' },
  { v: 'flexible', l: 'Flexible (< 20 h)' },
] as const

export default function ScoutingPage() {
  const [filtros, setFiltros] = useState<FiltrosBusqueda>({
    juego: 'Todos',
    rol: 'Todos',
    rango: 'Todos',
    region: 'Todas',
    disponibilidad: 'cualquiera',
    verificados: false,
    query: '',
  })
  const [filtrosConsulta, setFiltrosConsulta] = useState(filtros)
  const [panelAbierto, setPanelAbierto] = useState(false)

  // La busqueda espera a que el usuario deje de teclear.
  useEffect(() => {
    const t = window.setTimeout(() => setFiltrosConsulta(filtros), 200)
    return () => window.clearTimeout(t)
  }, [filtros])

  const consulta = useJugadores(filtrosConsulta)
  const jugadores = useMemo(() => consulta.data ?? [], [consulta.data])
  const cargando = consulta.isLoading || consulta.isPlaceholderData

  const actualizar = (parcial: Partial<FiltrosBusqueda>) =>
    setFiltros((f) => ({ ...f, ...parcial }))

  const rolesDisponibles = useMemo(() => {
    const set = new Set<string>()
    for (const j of jugadores) for (const r of j.rolesPreferidos) set.add(r)
    return ['Todos', ...[...set].sort()]
  }, [jugadores])

  const filtrosActivos =
    (filtros.juego !== 'Todos' ? 1 : 0) +
    (filtros.rol !== 'Todos' ? 1 : 0) +
    (filtros.rango !== 'Todos' ? 1 : 0) +
    (filtros.region !== 'Todas' ? 1 : 0) +
    (filtros.disponibilidad !== 'cualquiera' ? 1 : 0) +
    (filtros.verificados ? 1 : 0)

  const limpiar = () =>
    setFiltros({
      juego: 'Todos',
      rol: 'Todos',
      rango: 'Todos',
      region: 'Todas',
      disponibilidad: 'cualquiera',
      verificados: false,
      query: '',
    })

  const enCaribe = jugadores.filter((j) => j.esCaribe).length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-50">
            Directorio de talento
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Busca por juego, rol, rango y region. Todos los perfiles exponen
            estadisticas verificadas por ingesta directa.
          </p>
        </div>
        <Button
          variante="secundario"
          tamano="sm"
          className="lg:hidden"
          onClick={() => setPanelAbierto((v) => !v)}
        >
          <Filter size={14} />
          Filtros {filtrosActivos > 0 && `(${filtrosActivos})`}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* ---------------------------- Filtros ---------------------------- */}
        <aside
          className={cn(
            'space-y-4 lg:block',
            panelAbierto ? 'block' : 'hidden',
          )}
        >
          <Card>
            <CardHeader
              title="Filtros de busqueda"
              subtitle="Criterios del modulo de scouting (RF-08)."
              icon={<SlidersHorizontal size={16} />}
              action={
                filtrosActivos > 0 ? (
                  <button
                    onClick={limpiar}
                    className="flex items-center gap-1 text-[11px] text-slate-500 transition hover:text-rose-300"
                  >
                    <X size={12} />
                    Limpiar
                  </button>
                ) : undefined
              }
            />
            <div className="space-y-4 p-5">
              <Field label="Busqueda">
                <div className="relative">
                  <Search
                    size={14}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
                  />
                  <Input
                    value={filtros.query ?? ''}
                    onChange={(e) => actualizar({ query: e.target.value })}
                    placeholder="Nombre, handle, rol..."
                    className="pl-9"
                  />
                </div>
              </Field>

              <Field label="Juego">
                <Select
                  value={filtros.juego}
                  onChange={(e) =>
                    actualizar({ juego: e.target.value as FiltrosBusqueda['juego'] })
                  }
                >
                  {JUEGOS.map((j) => (
                    <option key={j} value={j}>
                      {j}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Rol">
                <Select
                  value={filtros.rol}
                  onChange={(e) => actualizar({ rol: e.target.value })}
                >
                  {rolesDisponibles.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Rango minimo">
                <Select
                  value={filtros.rango}
                  onChange={(e) => actualizar({ rango: e.target.value })}
                >
                  {RANGOS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Region">
                <Select
                  value={filtros.region}
                  onChange={(e) =>
                    actualizar({ region: e.target.value as FiltrosBusqueda['region'] })
                  }
                >
                  {REGIONES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Disponibilidad">
                <Select
                  value={filtros.disponibilidad}
                  onChange={(e) =>
                    actualizar({
                      disponibilidad:
                        e.target.value as FiltrosBusqueda['disponibilidad'],
                    })
                  }
                >
                  {DISPONIBILIDAD.map((d) => (
                    <option key={d.v} value={d.v}>
                      {d.l}
                    </option>
                  ))}
                </Select>
              </Field>

              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-white/8 bg-white/3 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={filtros.verificados}
                  onChange={(e) => actualizar({ verificados: e.target.checked })}
                  className="size-4 accent-[#7c4df5]"
                />
                <span className="text-xs text-slate-300">
                  Solo perfiles con cuenta verificada
                </span>
              </label>
            </div>
          </Card>

          <Card className="p-4">
            <p className="text-[11px] leading-relaxed text-slate-500">
              El motor de matching evalua cinco dimensiones:{' '}
              {DIMENSIONES.map((d) => d.label.toLowerCase()).join(', ')}.
            </p>
          </Card>
        </aside>

        {/* ---------------------------- Resultados ---------------------------- */}
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat
              label="Jugadores encontrados"
              value={jugadores.length}
              icono={<Users size={16} />}
              acento="violeta"
            />
            <Stat
              label="Del Caribe colombiano"
              value={enCaribe}
              icono={<MapPin size={16} />}
              acento="cian"
            />
            <Stat
              label="Filtros aplicados"
              value={filtrosActivos}
              icono={<Filter size={16} />}
              acento="verde"
            />
          </div>

          {cargando ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton h-32 rounded-2xl" />
              ))}
            </div>
          ) : jugadores.length === 0 ? (
            <Card>
              <EmptyState
                icono={<Search size={22} />}
                titulo="Sin coincidencias"
                descripcion="Ningun jugador cumple los criterios seleccionados. Prueba a relajar los filtros."
                action={
                  <Button variante="secundario" tamano="sm" onClick={limpiar}>
                    Limpiar filtros
                  </Button>
                }
              />
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {jugadores.map((j) => (
                <Link
                  key={j.id}
                  to={`/jugador/${j.id}`}
                  className="card card-hover group p-4"
                >
                  <div className="flex items-start gap-3">
                    <Avatar nombre={j.nombre} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-slate-100 group-hover:text-brand-200">
                          {j.nombre}
                        </p>
                        <BadgeCheck
                          size={14}
                          className="shrink-0 text-emerald-400"
                        />
                      </div>
                      <p className="truncate font-mono text-[11px] text-slate-500">
                        @{j.handle}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {j.rolesPreferidos.map((r) => (
                      <Badge key={r} tono="violeta">
                        {r}
                      </Badge>
                    ))}
                    {j.esCaribe && <Badge tono="cian">Caribe</Badge>}
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-white/6 pt-3 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <MapPin size={12} />
                      {j.region}
                    </span>
                    <span>{j.horasDisponibles} h/semana</span>
                    <span>{j.aniosExperiencia} anos exp.</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
