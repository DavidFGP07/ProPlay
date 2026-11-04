import { useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { BadgeCheck, Clock, MapPin, Plane, Search } from 'lucide-react'
import {
  MACROREGION_POR_DEPARTAMENTO,
  POSICIONES_LOL,
  RANGOS_LOL,
  type Departamento,
  type JugadorEncontrado,
  type PosicionLol,
  type RangoLol,
} from '@proplay/shared'
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  EstadoError,
  EstadoSinPermiso,
  Field,
  Paginacion,
  SectionTitle,
  Select,
} from '@/components/ui'
import { useBuscarJugadores, type FiltrosTalento } from '@/api/scouting'
import { es } from '@/i18n/es'
import { OPCIONES_DEPARTAMENTO, lugar } from '@/lib/ubicacion'

const t = es.buscador

const formatoFecha = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' })

/** Rangos de mayor a menor: en un «mínimo», lo que más se busca va arriba. */
const RANGOS_DESCENDENTES = [...RANGOS_LOL].reverse()

const SIN_FILTROS: FiltrosTalento = { page: 1 }

// RF-08 · Buscador de talento: jugadores reales de GET /api/v1/scouting/jugadores
// filtrados por posición, rango mínimo y departamento. La posición y el rango
// salen de la última captura de Riot de una cuenta verificada; sin puntaje de
// compatibilidad (motor de matching). Cada resultado abre su perfil público.
export default function ScoutingPage() {
  const [filtros, setFiltros] = useState<FiltrosTalento>(SIN_FILTROS)
  const consulta = useBuscarJugadores(filtros)
  const hayFiltros = Boolean(filtros.posicion || filtros.rangoMinimo || filtros.departamento)

  // Cambiar un filtro vuelve a la primera página.
  const filtrar = (cambio: Partial<FiltrosTalento>) =>
    setFiltros((previos) => ({ ...previos, ...cambio, page: 1 }))

  return (
    <div className="space-y-6">
      <SectionTitle title={t.titulo} subtitle={t.subtitulo} />

      <Card className="p-4">
        <fieldset className="space-y-3">
          <legend className="sr-only">{t.filtros}</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t.posicion}>
              <Select
                value={filtros.posicion ?? ''}
                onChange={(e) =>
                  filtrar({ posicion: (e.target.value || undefined) as PosicionLol | undefined })
                }
              >
                <option value="">{t.todas}</option>
                {POSICIONES_LOL.map((posicion) => (
                  <option key={posicion} value={posicion}>
                    {es.posicionLol[posicion]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t.rangoMinimo}>
              <Select
                value={filtros.rangoMinimo ?? ''}
                onChange={(e) =>
                  filtrar({ rangoMinimo: (e.target.value || undefined) as RangoLol | undefined })
                }
              >
                <option value="">{t.sinMinimo}</option>
                {RANGOS_DESCENDENTES.map((rango) => (
                  <option key={rango} value={rango}>
                    {es.rangoLol[rango]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t.departamento}>
              <Select
                value={filtros.departamento ?? ''}
                onChange={(e) =>
                  filtrar({
                    departamento: (e.target.value || undefined) as Departamento | undefined,
                  })
                }
              >
                <option value="">{t.todos}</option>
                {OPCIONES_DEPARTAMENTO.map((departamento) => (
                  <option key={departamento} value={departamento}>
                    {es.departamento[departamento]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-slate-400">{t.pistaVerificados}</p>
            {hayFiltros && (
              <Button variante="fantasma" tamano="sm" onClick={() => setFiltros(SIN_FILTROS)}>
                {t.limpiar}
              </Button>
            )}
          </div>
        </fieldset>
      </Card>

      {consulta.isPending ? (
        <div aria-busy="true" aria-label={t.cargando} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-44 rounded-2xl" />
          ))}
        </div>
      ) : consulta.isError ? (
        <Card>
          {axios.isAxiosError(consulta.error) && consulta.error.response?.status === 403 ? (
            <EstadoSinPermiso descripcion={t.sinPermiso} />
          ) : (
            <EstadoError titulo={t.error} onReintentar={() => void consulta.refetch()} />
          )}
        </Card>
      ) : consulta.data.data.length === 0 ? (
        <Card>
          <EmptyState
            icono={<Search size={22} />}
            titulo={hayFiltros ? t.vacioFiltros : t.vacio}
            descripcion={hayFiltros ? t.vacioFiltrosDetalle : t.vacioDetalle}
            action={
              hayFiltros && (
                <Button variante="secundario" tamano="sm" onClick={() => setFiltros(SIN_FILTROS)}>
                  {t.limpiar}
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-slate-400" aria-live="polite">
            {t.resultados(consulta.data.meta.total)}
          </p>
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {consulta.data.data.map((jugador) => (
              <li key={jugador.id} className="min-w-0">
                <TarjetaJugador jugador={jugador} />
              </li>
            ))}
          </ul>
          <Paginacion
            pagina={consulta.data.meta.page}
            totalPaginas={consulta.data.meta.totalPages}
            onCambiar={(page) => setFiltros((previos) => ({ ...previos, page }))}
          />
        </div>
      )}
    </div>
  )
}

function TarjetaJugador({ jugador }: { jugador: JugadorEncontrado }) {
  const caribe =
    jugador.departamento !== null && MACROREGION_POR_DEPARTAMENTO[jugador.departamento] === 'CARIBE'

  return (
    <Link
      to={`/jugador/${jugador.id}`}
      className="card card-hover block h-full p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
    >
      <div className="flex items-start gap-3">
        {jugador.avatarUrl ? (
          <img src={jugador.avatarUrl} alt="" className="size-10 shrink-0 rounded-full object-cover" />
        ) : (
          <Avatar nombre={jugador.nombre} size="md" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-sm font-semibold text-slate-100">{jugador.nombre}</h3>
            {jugador.verificacion && (
              <BadgeCheck size={15} className="shrink-0 text-emerald-400" aria-hidden />
            )}
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
            <MapPin size={11} className="shrink-0" aria-hidden />
            <span className="truncate">
              {jugador.pais ? lugar(jugador.pais, jugador.departamento) : t.sinUbicacion}
            </span>
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {jugador.verificacion ? (
          <>
            {jugador.posicion && (
              <Badge tono="cian">
                {es.posicionLol[jugador.posicion as PosicionLol] ?? jugador.posicion}
              </Badge>
            )}
            <Badge tono="violeta">{jugador.rango ? es.rangoLol[jugador.rango] : t.sinRango}</Badge>
          </>
        ) : (
          <Badge>{t.sinVerificar}</Badge>
        )}
        {caribe && <Badge tono="verde">{es.macrorregion.CARIBE}</Badge>}
      </div>

      <ul className="mt-3 space-y-1 text-[11px] text-slate-400">
        {jugador.disponibilidadHoras !== null && (
          <li className="flex items-center gap-1.5">
            <Clock size={11} className="shrink-0" aria-hidden />
            {t.horas(jugador.disponibilidadHoras)}
          </li>
        )}
        {jugador.dispuestoRelocalizar && (
          <li className="flex items-center gap-1.5">
            <Plane size={11} className="shrink-0" aria-hidden />
            {t.relocaliza}
          </li>
        )}
      </ul>

      {jugador.verificacion && (
        <p className="mt-3 border-t border-white/6 pt-2 text-[10px] leading-relaxed text-slate-400">
          {t.verificada(formatoFecha.format(jugador.verificacion.verificadaEn))}
          {jugador.datosDel && ` · ${t.datosDel(formatoFecha.format(jugador.datosDel))}`}
        </p>
      )}
    </Link>
  )
}
