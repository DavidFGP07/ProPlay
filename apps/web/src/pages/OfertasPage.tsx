import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Briefcase,
  Clock,
  MapPin,
  Plus,
  Search,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  SectionTitle,
  cn,
} from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { usePostulaciones, useVacantes } from '@/api/ofertas'
import { useEquipos } from '@/api/perfiles'

export default function OfertasPage() {
  const { usuario } = useAuth()
  const vacantes = useVacantes()
  const { data: postulaciones = [] } = usePostulaciones()
  const { data: perfilesEquipo = [] } = useEquipos()
  const ofertas = vacantes.data ?? []
  const cargando = vacantes.isLoading
  const [query, setQuery] = useState('')
  const [soloAbiertas, setSoloAbiertas] = useState(true)

  const filtradas = ofertas.filter((o) => {
    if (soloAbiertas && o.estado !== 'abierta') return false
    if (!query) return true
    const q = query.toLowerCase()
    return (
      o.juego.toLowerCase().includes(q) ||
      o.rol.toLowerCase().includes(q) ||
      o.descripcion.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Vacantes publicadas"
        subtitle="Oportunidades de los equipos del ecosistema, con el ranking de compatibilidad calculado por el motor hibrido."
        action={
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar vacante..."
                className="h-9 w-48 pl-9 text-xs"
              />
            </div>
            <Button
              variante={soloAbiertas ? 'primario' : 'secundario'}
              tamano="sm"
              onClick={() => setSoloAbiertas((v) => !v)}
            >
              Solo abiertas
            </Button>
            {(usuario?.rol === 'equipo' || usuario?.rol === 'admin') && (
              <Link to="/panel-equipo">
                <Button variante="secundario" tamano="sm">
                  <Plus size={14} />
                  Publicar
                </Button>
              </Link>
            )}
          </div>
        }
      />

      {cargando ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-56 rounded-2xl" />
          ))}
        </div>
      ) : filtradas.length === 0 ? (
        <Card>
          <EmptyState
            icono={<Briefcase size={22} />}
            titulo="No hay vacantes que coincidan"
            descripcion="Prueba a desactivar el filtro de abiertas o a buscar por otro termino."
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtradas.map((o) => {
            const equipo = perfilesEquipo.find((e) => e.id === o.equipoId)
            const postulacionesOferta = postulaciones.filter(
              (p) => p.ofertaId === o.id,
            ).length
            return (
              <Link key={o.id} to={`/vacantes/${o.id}`} className="card card-hover block p-5">
                <div className="flex items-start gap-3">
                  {equipo && <Avatar nombre={equipo.nombre} size="md" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-100">
                          {o.rol} · {o.juego}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">
                          {equipo?.nombre} · {equipo?.region}
                        </p>
                      </div>
                      <Badge
                        tono={
                          o.estado === 'abierta'
                            ? 'verde'
                            : o.estado === 'en-proceso'
                              ? 'ambar'
                              : 'neutro'
                        }
                      >
                        {o.estado}
                      </Badge>
                    </div>
                  </div>
                </div>

                <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-slate-400">
                  {o.descripcion}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
                  <span className="flex items-center gap-1.5 text-slate-500">
                    <TrendingUp size={12} />
                    Rank min. {o.rangoMinimo}
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-500">
                    <Clock size={12} />
                    {o.horasSemanales} h/semana
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-500">
                    <MapPin size={12} />
                    {o.regionPreferida}
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-500">
                    <Users size={12} />
                    {postulacionesOferta} postulaciones
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-white/6 pt-3">
                  <span className="text-[11px] text-slate-500">
                    Publicada el {o.publicadaEn}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-medium text-brand-300">
                    <Sparkles size={12} />
                    Ver ranking de compatibilidad
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <Card>
        <CardHeader
          title="Como se construye el ranking"
          subtitle="Recorrido de una peticion de matching (Nivel 3 del modelo C4)"
          icon={<Sparkles size={16} />}
        />
        <div className="grid gap-3 p-5 md:grid-cols-3">
          {[
            {
              n: '1',
              t: 'Recuperador por contenido',
              d: 'Consulta de similitud sobre el indice HNSW de pgvector con el vector de requisitos de la oferta. Devuelve los candidatos mas proximos sin recorrer la tabla completa.',
            },
            {
              n: '2',
              t: 'Componente colaborativo',
              d: 'Ajusta el conjunto con la senal de interacciones previas entre el equipo y los jugadores. Si el historial es insuficiente, su peso permanece en cero.',
            },
            {
              n: '3',
              t: 'Ponderador y explicador',
              d: 'Promedio ponderado de las cinco dimensiones y explicacion en lenguaje natural anclada en fuentes recuperadas en tiempo real.',
            },
          ].map((p) => (
            <div
              key={p.n}
              className={cn(
                'rounded-xl border border-white/8 bg-white/3 p-4',
              )}
            >
              <span className="grid size-7 place-items-center rounded-lg bg-brand-500/15 font-mono text-xs text-brand-300">
                {p.n}
              </span>
              <p className="mt-2.5 text-sm font-semibold text-slate-100">{p.t}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{p.d}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
