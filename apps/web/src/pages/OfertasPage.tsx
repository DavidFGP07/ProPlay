import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, CheckCircle2, Clock, MapPin, Plus, TrendingUp } from 'lucide-react'
import {
  MODALIDADES,
  POSICIONES_LOL,
  type Departamento,
  type EstadoPostulacion,
  type Modalidad,
  type Oferta,
  type PosicionLol,
} from '@proplay/shared'
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  EstadoError,
  Field,
  Paginacion,
  SectionTitle,
  Select,
} from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { useMisPostulaciones, useOfertas, type FiltrosOfertas } from '@/api/ofertas'
import { es } from '@/i18n/es'
import { OPCIONES_DEPARTAMENTO, lugarOferta } from '@/lib/ubicacion'

const t = es.ofertas

const formatoFecha = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' })

// RF-07 · RF-09 · Explorar oportunidades: ofertas abiertas reales de
// GET /api/v1/ofertas, paginadas y filtradas por posición, departamento y
// modalidad. Sin puntaje: el orden por compatibilidad llega con el matching.
export default function OfertasPage() {
  const { usuario } = useAuth()
  const [filtros, setFiltros] = useState<FiltrosOfertas>({ page: 1 })
  const consulta = useOfertas(filtros)
  const esJugador = usuario?.rol === 'JUGADOR'
  const mias = useMisPostulaciones(esJugador)
  const postuladas = new Map(mias.data?.map((p) => [p.oferta.id, p.estado]))
  const hayFiltros = Boolean(filtros.rol || filtros.departamento || filtros.modalidad)

  // Cambiar un filtro vuelve a la primera página.
  const filtrar = (cambio: Partial<FiltrosOfertas>) =>
    setFiltros((previos) => ({ ...previos, ...cambio, page: 1 }))

  return (
    <div className="space-y-6">
      <SectionTitle
        title={t.titulo}
        subtitle={t.subtitulo}
        action={
          usuario?.rol === 'EQUIPO' && (
            <Link
              to="/panel-equipo"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/12 bg-white/5 px-3 text-xs font-medium text-slate-200 transition hover:border-brand-500/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
            >
              <Plus size={14} aria-hidden />
              {t.publicar}
            </Link>
          )
        }
      />

      <Card className="p-4">
        <fieldset className="grid gap-3 sm:grid-cols-3">
          <legend className="sr-only">{t.filtros}</legend>
          <Field label={t.filtroRol}>
            <Select
              value={filtros.rol ?? ''}
              onChange={(e) => filtrar({ rol: (e.target.value || undefined) as PosicionLol | undefined })}
            >
              <option value="">{t.todas}</option>
              {POSICIONES_LOL.map((posicion) => (
                <option key={posicion} value={posicion}>
                  {es.posicionLol[posicion]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t.filtroDepartamento}>
            <Select
              value={filtros.departamento ?? ''}
              onChange={(e) =>
                filtrar({ departamento: (e.target.value || undefined) as Departamento | undefined })
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
          <Field label={t.filtroModalidad}>
            <Select
              value={filtros.modalidad ?? ''}
              onChange={(e) =>
                filtrar({ modalidad: (e.target.value || undefined) as Modalidad | undefined })
              }
            >
              <option value="">{t.todas}</option>
              {MODALIDADES.map((modalidad) => (
                <option key={modalidad} value={modalidad}>
                  {es.modalidad[modalidad]}
                </option>
              ))}
            </Select>
          </Field>
        </fieldset>
      </Card>

      {consulta.isPending ? (
        <div aria-busy="true" aria-label={t.cargando} className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-48 rounded-2xl" />
          ))}
        </div>
      ) : consulta.isError ? (
        <Card>
          <EstadoError titulo={t.error} onReintentar={() => void consulta.refetch()} />
        </Card>
      ) : consulta.data.data.length === 0 ? (
        <Card>
          <EmptyState
            icono={<Briefcase size={22} />}
            titulo={hayFiltros ? t.vacioFiltros : t.vacio}
            descripcion={hayFiltros ? t.vacioFiltrosDetalle : t.vacioDetalle}
            action={
              hayFiltros && (
                <Button variante="secundario" tamano="sm" onClick={() => setFiltros({ page: 1 })}>
                  {t.limpiarFiltros}
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
          <ul className="grid gap-4 lg:grid-cols-2">
            {consulta.data.data.map((oferta) => (
              <li key={oferta.id} className="min-w-0">
                <TarjetaOferta oferta={oferta} postulacion={postuladas.get(oferta.id)} />
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

function TarjetaOferta({
  oferta,
  postulacion,
}: {
  oferta: Oferta
  postulacion: EstadoPostulacion | undefined
}) {
  return (
    <Link
      to={`/vacantes/${oferta.id}`}
      className="card card-hover block h-full p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
    >
      <div className="flex items-start gap-3">
        <Avatar nombre={oferta.equipo.nombreOrg} size="md" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold break-words text-slate-100">{oferta.titulo}</h3>
          <p className="truncate text-[11px] text-slate-400">{oferta.equipo.nombreOrg}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge tono="cian">{es.posicionLol[oferta.rol]}</Badge>
        <Badge tono="violeta">{es.modalidad[oferta.modalidad]}</Badge>
        {postulacion && (
          <Badge tono="verde">
            <CheckCircle2 size={11} aria-hidden />
            {t.yaPostulado(es.estadoPostulacion[postulacion])}
          </Badge>
        )}
      </div>

      <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-slate-400">
        {oferta.descripcion}
      </p>

      <ul className="mt-4 grid gap-1.5 text-[11px] text-slate-400 sm:grid-cols-2">
        <li className="flex min-w-0 items-center gap-1.5">
          <MapPin size={12} className="shrink-0" aria-hidden />
          <span className="truncate">{lugarOferta(oferta)}</span>
        </li>
        {oferta.rangoMinimo && (
          <li className="flex min-w-0 items-center gap-1.5">
            <TrendingUp size={12} className="shrink-0" aria-hidden />
            <span className="truncate">{t.rangoMinimo(oferta.rangoMinimo)}</span>
          </li>
        )}
        {oferta.horasSemana !== null && (
          <li className="flex items-center gap-1.5">
            <Clock size={12} className="shrink-0" aria-hidden />
            {t.horas(oferta.horasSemana)}
          </li>
        )}
      </ul>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/6 pt-3 text-[11px]">
        {oferta.publicadaEn && (
          <span className="text-slate-400">
            {t.publicadaEl(formatoFecha.format(oferta.publicadaEn))}
          </span>
        )}
        <span className="font-medium text-brand-300">{t.verOferta}</span>
      </div>
    </Link>
  )
}
