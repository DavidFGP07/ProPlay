import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Briefcase, LineChart } from 'lucide-react'
import type { EmbudoEquipo } from '@proplay/shared'
import { Card, CardHeader, EmptyState, EstadoError, EstadoSinPermiso, Field, SectionTitle, Select } from '@/components/ui'
import {
  DimensionDecisivaOferta,
  EmbudoVacantes,
  EsqueletoTarjeta,
  MapaTalento,
  TablaOfertas,
  TiemposVacantes,
  esProhibido,
} from '@/components/IndicadoresAnalitica'
import { useEmbudoEquipo, useEmbudoOferta } from '@/api/analitica'
import { useAuth } from '@/context/AuthContext'
import { es } from '@/i18n/es'

const t = es.analitica

// RF-13 · Analítica, fusionada con el panel del equipo (decisión 0.10): el
// equipo ve el embudo y los tiempos de sus vacantes (H1), el embudo y la
// dimensión decisiva de cada oferta, y el mapa del talento verificado; el
// scout y el administrador, sólo el mapa. La tendencia del jugador, el cuarto
// indicador, vive en Mis estadísticas.
export default function AnaliticaPage() {
  const { usuario } = useAuth()
  const esEquipo = usuario?.rol === 'EQUIPO'

  return (
    <div className="space-y-6">
      <SectionTitle title={t.titulo} subtitle={esEquipo ? t.subtitulo : t.subtituloScout} />
      {esEquipo && <AnaliticaVacantes />}
      <MapaTalento />
      <p className="flex items-start gap-2 text-xs text-slate-400">
        <LineChart size={14} className="mt-0.5 shrink-0" aria-hidden />
        {t.tendencia}
      </p>
    </div>
  )
}

function AnaliticaVacantes() {
  const consulta = useEmbudoEquipo()

  if (consulta.isPending) {
    return (
      <div className="space-y-6">
        <EsqueletoTarjeta etiqueta={t.cargando} alto="h-56" />
        <EsqueletoTarjeta etiqueta={t.cargando} alto="h-72" />
      </div>
    )
  }
  if (consulta.isError) {
    return (
      <Card>
        {esProhibido(consulta.error) ? (
          <EstadoSinPermiso descripcion={t.sinPermiso} />
        ) : (
          <EstadoError titulo={t.error} onReintentar={() => void consulta.refetch()} />
        )}
      </Card>
    )
  }
  const datos = consulta.data
  if (datos.ofertas.length === 0) {
    return (
      <Card>
        <EmptyState
          icono={<Briefcase size={22} />}
          titulo={t.sinOfertas}
          descripcion={t.sinOfertasDetalle}
          action={
            <Link
              to="/panel-equipo/ofertas/nueva"
              className="rounded-lg border border-white/12 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-brand-500/50"
            >
              {t.publicar}
            </Link>
          }
        />
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <TiemposVacantes datos={datos} />
      <EmbudoVacantes embudo={datos.embudo} />
      <TablaOfertas ofertas={datos.ofertas} />
      <PorOferta ofertas={datos.ofertas} />
    </div>
  )
}

/** Oferta que se muestra al entrar: la abierta más reciente o, si no hay, la más reciente. */
function ofertaInicial(ofertas: EmbudoEquipo['ofertas']): string {
  return (ofertas.find((o) => o.estado === 'ABIERTA') ?? ofertas[0]!).id
}

function PorOferta({ ofertas }: { ofertas: EmbudoEquipo['ofertas'] }) {
  const [elegida, setElegida] = useState(() => ofertaInicial(ofertas))
  const ofertaId = ofertas.some((o) => o.id === elegida) ? elegida : ofertaInicial(ofertas)
  const embudo = useEmbudoOferta(ofertaId)

  return (
    <Card>
      <CardHeader title={t.porOferta} subtitle={t.porOfertaSubtitulo} icon={<BarChart3 size={16} />} />
      <div className="space-y-6 p-5">
        <div className="max-w-md">
          <Field label={t.elegirOferta}>
            <Select value={ofertaId} onChange={(e) => setElegida(e.target.value)}>
              {ofertas.map((o) => (
                <option key={o.id} value={o.id}>
                  {`${o.titulo} (${es.estadoOferta[o.estado]})`}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <section aria-labelledby="titulo-embudo-oferta" className="space-y-3">
          <h4 id="titulo-embudo-oferta" className="text-sm font-semibold text-slate-100">
            {t.embudoOferta}
          </h4>
          {embudo.isPending ? (
            <EsqueletoTarjeta etiqueta={t.cargando} alto="h-40" />
          ) : embudo.isError ? (
            esProhibido(embudo.error) ? (
              <EstadoSinPermiso descripcion={t.sinPermiso} />
            ) : (
              <EstadoError titulo={t.errorOferta} onReintentar={() => void embudo.refetch()} />
            )
          ) : (
            <EmbudoVacantes embudo={embudo.data.embudo} titulo={t.embudoOferta} enTarjeta={false} />
          )}
        </section>

        <DimensionDecisivaOferta ofertaId={ofertaId} />
      </div>
    </Card>
  )
}
