import { Link } from 'react-router-dom'
import axios from 'axios'
import { CheckCircle2, Clock, Compass, Filter, MapPin, Trophy, Users } from 'lucide-react'
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import {
  BANDAS_RANGO,
  LINEA_BASE_SCOUTING_MANUAL,
  MIN_CANDIDATOS_DIMENSION_DECISIVA,
  POSICIONES_LOL,
  type CeldaTalento,
  type DimensionDecisiva,
  type Embudo,
  type EmbudoEquipo,
  type GrupoTalentoRespuesta,
  type OfertaAnalitica,
  type ResumenDiasRespuesta,
} from '@proplay/shared'
import {
  Card,
  CardHeader,
  EmptyState,
  EstadoError,
  EstadoSinPermiso,
  Stat,
  cn,
} from '@/components/ui'
import { MuestraDimension, RELLENO_DIMENSION } from '@/components/BarraAportes'
import { useDimensionDecisiva, useTalento } from '@/api/analitica'
import { es } from '@/i18n/es'

/*
 * RF-13 · Indicadores de la analítica: tiempos de las vacantes (H1), embudo,
 * dimensión que decide el ranking y mapa del talento verificado. Cada gráfica
 * (Recharts, la única librería de gráficos) va con su tabla de datos, que es
 * la alternativa accesible y no depende del color.
 */

const t = es.analitica
const formatoPorcentaje = new Intl.NumberFormat('es-CO', { style: 'percent', maximumFractionDigits: 0 })
const COLOR_TEXTO = 'var(--color-slate-400)'
const COLOR_ETIQUETA = 'var(--color-slate-200)'
/** Id del patrón rayado del resto de Colombia; lo define `LeyendaGrupos`, una sola vez. */
const RAYAS_RESTO = 'rayas-resto-colombia'

export const esProhibido = (error: unknown) =>
  axios.isAxiosError(error) && error.response?.status === 403

/** Mediana en días, o «—» si no hay datos (n = 0 no es «0 días»). */
export function textoMediana(r: ResumenDiasRespuesta): string {
  return r.mediana === null ? t.sinDato : t.dias(r.mediana)
}

function celdaDias(n: number | null) {
  return n === null ? t.sinDato : t.dias(n)
}

/** Esqueleto de una tarjeta (estado cargando, CLAUDE.md §5). */
export function EsqueletoTarjeta({ etiqueta, alto = 'h-48' }: { etiqueta: string; alto?: string }) {
  return <div aria-busy="true" aria-label={etiqueta} className={cn('skeleton rounded-2xl', alto)} />
}

/** Envoltorio de una gráfica: imagen con su resumen; la tabla de datos va aparte. */
function Grafica({ resumen, alto, children }: { resumen: string; alto: number; children: React.ReactElement }) {
  return (
    <div role="img" aria-label={resumen} style={{ height: alto }} className="w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}

function Tabla({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[30rem] text-left text-xs">
        <caption className="sr-only">{titulo}</caption>
        {children}
      </table>
    </div>
  )
}

const th = 'border-b border-white/8 px-3 py-2 font-medium text-slate-400'
const td = 'border-b border-white/5 px-3 py-2 text-slate-200'

// ------------------------------------------------------------ tiempos (H1)

// RF-13 · Tiempo hasta cubrir la vacante (H1) y hasta el primer tryout
export function TiemposVacantes({ datos }: { datos: EmbudoEquipo }) {
  const { diasHastaCubrir: cubrir, diasHastaPrimerTryout: tryout, cobertura } = datos
  const terminadas = cobertura.cubiertas + cobertura.cerradasSinCubrir
  const base = LINEA_BASE_SCOUTING_MANUAL
  const cubiertas = datos.ofertas.filter((o) => o.diasHastaCubrir !== null)

  return (
    <Card>
      <CardHeader title={t.vacantes} subtitle={t.vacantesSubtitulo} icon={<Clock size={16} />} />
      <div className="space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat
            label={t.hastaCubrir}
            value={textoMediana(cubrir)}
            hint={cubrir.media === null ? t.hastaCubrirDetalle : t.detalleSerie(cubrir.media, cubrir.n)}
            icono={<CheckCircle2 size={16} />}
            acento="verde"
          />
          <Stat
            label={t.hastaTryout}
            value={textoMediana(tryout)}
            hint={tryout.media === null ? t.hastaTryoutDetalle : t.detalleSerie(tryout.media, tryout.n)}
            icono={<Users size={16} />}
            acento="cian"
          />
          <Stat
            label={t.cobertura}
            value={cobertura.tasa === null ? t.sinDato : formatoPorcentaje.format(cobertura.tasa)}
            hint={terminadas === 0 ? t.sinTerminadas : t.coberturaDetalle(cobertura.cubiertas, terminadas)}
            icono={<Trophy size={16} />}
            acento="ambar"
          />
        </div>

        {base && (
          <p className="text-xs text-slate-300">
            {t.lineaBase(t.dias(base.diasHastaCubrir.mediana), base.equipos)}
          </p>
        )}

        {cubrir.n === 0 ? (
          <EmptyState
            icono={<CheckCircle2 size={22} />}
            titulo={t.sinCubiertas}
            descripcion={t.sinCubiertasDetalle}
          />
        ) : (
          <>
            <Grafica
              alto={Math.max(120, cubiertas.length * 40 + 30)}
              resumen={t.graficoCubrirResumen(
                cubiertas.map((o) => `${o.titulo} ${t.dias(o.diasHastaCubrir!)}`).join(', '),
              )}
            >
              <BarChart
                data={cubiertas.map((o) => ({ nombre: o.titulo, dias: o.diasHastaCubrir }))}
                layout="vertical"
                margin={{ top: 4, right: 36, bottom: 4, left: 4 }}
              >
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="nombre"
                  width={130}
                  tick={{ fill: COLOR_TEXTO, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Bar dataKey="dias" fill="var(--color-emerald-400)" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                  <LabelList dataKey="dias" position="right" fill={COLOR_ETIQUETA} fontSize={11} />
                </Bar>
                <ReferenceLine
                  x={cubrir.mediana ?? 0}
                  stroke={COLOR_ETIQUETA}
                  strokeDasharray="4 3"
                  label={{ value: t.mediana, fill: COLOR_ETIQUETA, fontSize: 10, position: 'top' }}
                />
              </BarChart>
            </Grafica>
            <p className="text-[11px] text-slate-400">{t.descriptiva}</p>
          </>
        )}
      </div>
    </Card>
  )
}

// ------------------------------------------------------------------ ofertas

export function TablaOfertas({ ofertas }: { ofertas: readonly OfertaAnalitica[] }) {
  return (
    <Card>
      <CardHeader title={t.tusOfertas} icon={<Compass size={16} />} />
      <div className="p-5">
        <Tabla titulo={t.tusOfertas}>
          <thead>
            <tr>
              <th scope="col" className={th}>{t.columnaOferta}</th>
              <th scope="col" className={th}>{t.columnaEstado}</th>
              <th scope="col" className={th}>{t.columnaPostulaciones}</th>
              <th scope="col" className={th}>{t.columnaCubrir}</th>
              <th scope="col" className={th}>{t.columnaTryout}</th>
            </tr>
          </thead>
          <tbody>
            {ofertas.map((o) => (
              <tr key={o.id}>
                <th scope="row" className={cn(td, 'font-medium')}>
                  <Link to={`/vacantes/${o.id}`} className="hover:text-brand-300 hover:underline">
                    {o.titulo}
                  </Link>
                </th>
                <td className={td}>
                  {es.estadoOferta[o.estado]}
                  {o.diasAbierta !== null && (
                    <span className="block text-[11px] text-slate-400">{t.abiertaHace(o.diasAbierta)}</span>
                  )}
                </td>
                <td className={td}>{o.postulaciones}</td>
                <td className={td}>{celdaDias(o.diasHastaCubrir)}</td>
                <td className={td}>{celdaDias(o.diasHastaPrimerTryout)}</td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      </div>
    </Card>
  )
}

// ------------------------------------------------------------------- embudo

// RF-13 · Embudo de la vacante: postulaciones que llegan a cada etapa
export function EmbudoVacantes({
  embudo,
  titulo = t.embudo,
  subtitulo = t.embudoSubtitulo,
  enTarjeta = true,
}: {
  embudo: Embudo
  titulo?: string
  subtitulo?: string
  enTarjeta?: boolean
}) {
  const nombre = (etapa: Embudo['etapas'][number]['etapa']) => es.estadoPostulacion[etapa]
  const contenido =
    embudo.postulaciones === 0 ? (
      <EmptyState icono={<Filter size={22} />} titulo={t.sinPostulaciones} descripcion={t.sinPostulacionesDetalle} />
    ) : (
      <div className="space-y-4">
        <Grafica
          alto={190}
          resumen={t.graficoEmbudoResumen(
            embudo.etapas.map((e) => `${nombre(e.etapa)} ${e.alcanzaron}`).join(', '),
          )}
        >
          <BarChart
            data={embudo.etapas.map((e) => ({ nombre: nombre(e.etapa), valor: e.alcanzaron }))}
            layout="vertical"
            margin={{ top: 4, right: 36, bottom: 4, left: 4 }}
          >
            <XAxis type="number" hide allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="nombre"
              width={130}
              tick={{ fill: COLOR_TEXTO, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Bar dataKey="valor" fill="var(--color-brand-500)" radius={[0, 4, 4, 0]} isAnimationActive={false}>
              <LabelList dataKey="valor" position="right" fill={COLOR_ETIQUETA} fontSize={11} />
            </Bar>
          </BarChart>
        </Grafica>
        <Tabla titulo={titulo}>
          <thead>
            <tr>
              <th scope="col" className={th}>{t.columnaEtapa}</th>
              <th scope="col" className={th}>{t.columnaAlcanzaron}</th>
              <th scope="col" className={th}>{t.columnaConversion}</th>
              <th scope="col" className={th}>{t.columnaSiguen}</th>
              <th scope="col" className={th}>{t.columnaRechazadas}</th>
              <th scope="col" className={th}>{t.columnaAlCerrar}</th>
              <th scope="col" className={th}>{t.columnaDias}</th>
            </tr>
          </thead>
          <tbody>
            {embudo.etapas.map((e) => (
              <tr key={e.etapa}>
                <th scope="row" className={cn(td, 'font-medium')}>{nombre(e.etapa)}</th>
                <td className={td}>{e.alcanzaron}</td>
                <td className={td}>{e.conversion === null ? t.sinDato : formatoPorcentaje.format(e.conversion)}</td>
                <td className={td}>{e.siguen}</td>
                <td className={td}>{e.rechazadas}</td>
                <td className={td}>{e.rechazadasAlCerrar}</td>
                <td className={td}>{textoMediana(e.diasEnEtapa)}</td>
              </tr>
            ))}
          </tbody>
        </Tabla>
        <p className="text-[11px] leading-relaxed text-slate-400">{t.notaEmbudo}</p>
      </div>
    )

  if (!enTarjeta) return contenido
  return (
    <Card>
      <CardHeader title={titulo} subtitle={subtitulo} icon={<Filter size={16} />} />
      <div className="p-5">{contenido}</div>
    </Card>
  )
}

// ------------------------------------------------------- dimensión decisiva

/** Mínimo del eje de ventajas: 0, o la menor ventaja con margen para su etiqueta. */
function minimoDominio(valores: number[]): number {
  const minimo = Math.min(0, ...valores)
  if (minimo >= 0) return 0
  const maximo = Math.max(0, ...valores)
  return minimo - Math.max(6, (maximo - minimo) * 0.35)
}

const nombreDimension = (clave: DimensionDecisiva['dimensiones'][number]['dimension']) =>
  clave === 'otras' ? t.otras : es.dimension[clave]

const puntos = (fraccion: number) => Math.round(fraccion * 1000) / 10

/** Frase que resume la dimensión decisiva para el equipo. */
export function fraseDecisiva(d: DimensionDecisiva): string {
  if (!d.suficiente) return t.pocosCandidatos(MIN_CANDIDATOS_DIMENSION_DECISIVA, d.candidatos)
  if (!d.decisiva || d.ventajaTotal === null) return t.empate
  const ventaja = d.dimensiones.find((x) => x.dimension === d.decisiva)!.ventaja
  const formato = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 })
  // Lo que aporta la decisiva y lo que suman o restan las demás, por separado:
  // con las cifras ya redondeadas, para que la cuenta cuadre en la frase.
  const decisiva = puntos(ventaja)
  const total = puntos(d.ventajaTotal)
  const resto = Math.round((total - decisiva) * 10) / 10
  const principal = t.decisivaFrase(es.dimension[d.decisiva], d.top, formato.format(decisiva))
  const totalTexto = formato.format(total)
  const demas =
    resto < 0
      ? t.decisivaRestan(formato.format(-resto), totalTexto)
      : resto > 0
        ? t.decisivaSuman(formato.format(resto), totalTexto)
        : t.decisivaSolo(totalTexto)
  return `${principal} ${demas}`
}

// RF-13 · Qué dimensión decide el ranking de una oferta
export function DimensionDecisivaOferta({ ofertaId }: { ofertaId: string }) {
  const consulta = useDimensionDecisiva(ofertaId)

  return (
    <section aria-labelledby="titulo-decisiva" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 id="titulo-decisiva" className="text-sm font-semibold text-slate-100">{t.decisiva}</h4>
        <Link to={`/vacantes/${ofertaId}/ranking`} className="text-xs font-medium text-brand-300 hover:underline">
          {t.verRanking}
        </Link>
      </div>
      {consulta.isPending ? (
        <EsqueletoTarjeta etiqueta={t.cargando} alto="h-40" />
      ) : consulta.isError ? (
        esProhibido(consulta.error) ? (
          <EstadoSinPermiso descripcion={t.sinPermiso} />
        ) : (
          <EstadoError titulo={t.errorOferta} onReintentar={() => void consulta.refetch()} />
        )
      ) : (
        <ContenidoDecisiva datos={consulta.data} />
      )}
    </section>
  )
}

function ContenidoDecisiva({ datos }: { datos: DimensionDecisiva }) {
  const frase = <p className="text-sm leading-relaxed text-slate-200">{fraseDecisiva(datos)}</p>
  if (!datos.suficiente) return frase
  const filas = datos.dimensiones.map((d) => ({ ...d, nombre: nombreDimension(d.dimension), pts: puntos(d.ventaja) }))

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">{t.decisivaSubtitulo(datos.top)}</p>
      {frase}
      <Grafica
        alto={Math.max(120, filas.length * 38 + 20)}
        resumen={t.graficoDecisivaResumen(filas.map((f) => `${f.nombre} ${t.puntos(f.pts)}`).join(', '))}
      >
        <BarChart data={filas} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 4 }}>
          {/* Con ventajas negativas, su etiqueta va a la izquierda de la barra: se
              reserva sitio en el dominio para que no choque con el eje. */}
          <XAxis type="number" hide domain={[minimoDominio(filas.map((f) => f.pts)), 'auto']} />
          <YAxis
            type="category"
            dataKey="nombre"
            width={110}
            tick={{ fill: COLOR_TEXTO, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <ReferenceLine x={0} stroke={COLOR_TEXTO} />
          <Bar dataKey="pts" radius={[0, 4, 4, 0]} isAnimationActive={false}>
            {filas.map((f) => (
              <Cell key={f.dimension} fill={RELLENO_DIMENSION[f.dimension]} />
            ))}
            <LabelList
              dataKey="pts"
              position="right"
              fill={COLOR_ETIQUETA}
              fontSize={11}
              formatter={(v: number) => t.puntos(v)}
            />
          </Bar>
        </BarChart>
      </Grafica>
      <Tabla titulo={t.decisiva}>
        <thead>
          <tr>
            <th scope="col" className={th}>{t.columnaDimension}</th>
            <th scope="col" className={th}>{t.columnaPeso}</th>
            <th scope="col" className={th}>{t.columnaTop(datos.top)}</th>
            <th scope="col" className={th}>{t.columnaResto}</th>
            <th scope="col" className={th}>{t.columnaVentaja}</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.dimension}>
              <th scope="row" className={cn(td, 'font-medium')}>
                <span className="flex items-center gap-2">
                  <MuestraDimension clave={f.dimension} />
                  {f.nombre}
                </span>
              </th>
              <td className={td}>{formatoPorcentaje.format(f.peso)}</td>
              <td className={td}>{t.puntosAporte(puntos(f.aporteMedioTop))}</td>
              <td className={td}>{t.puntosAporte(puntos(f.aporteMedioResto))}</td>
              <td className={td}>
                {t.puntos(f.pts)}
                {f.pts < 0 && <span className="block text-[11px] text-slate-400">{t.enContra}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </Tabla>
    </div>
  )
}

// --------------------------------------------------------- mapa del talento

const textoCelda = (c: CeldaTalento) => (c === null ? t.oculto : String(c))

/** Porcentaje de una celda sobre el total del grupo; nulo si alguno está oculto. */
export function porcentajeDe(celda: CeldaTalento, total: CeldaTalento): number | null {
  if (celda === null || total === null || total === 0) return null
  return (celda / total) * 100
}

function ComparacionGrupos({
  titulo,
  resumen,
  grupos,
  categorias,
}: {
  titulo: string
  resumen: string
  grupos: readonly GrupoTalentoRespuesta[]
  categorias: { clave: string; nombre: string; celda: (g: GrupoTalentoRespuesta) => CeldaTalento }[]
}) {
  const [caribe, resto] = grupos as [GrupoTalentoRespuesta, GrupoTalentoRespuesta]
  const datos = categorias.map((c) => ({
    nombre: c.nombre,
    caribe: porcentajeDe(c.celda(caribe), caribe.total),
    resto: porcentajeDe(c.celda(resto), resto.total),
  }))
  const etiqueta = (v: number | null) => (v === null ? '' : t.porcentaje(v))
  const descripcion = datos
    .map((d) => `${d.nombre}: ${t.grupo.CARIBE} ${etiqueta(d.caribe) || t.oculto}, ${t.grupo.RESTO_COLOMBIA} ${etiqueta(d.resto) || t.oculto}`)
    .join('; ')

  return (
    // min-w-0: en la rejilla, la tabla ancha no debe ensanchar la columna (375 px).
    <div className="min-w-0 space-y-3">
      <h5 className="text-xs font-semibold text-slate-300">{titulo}</h5>
      <Grafica alto={categorias.length * 46 + 20} resumen={t.graficoComparacionResumen(`${resumen}. ${descripcion}`)}>
        <BarChart data={datos} layout="vertical" barGap={2} margin={{ top: 4, right: 48, bottom: 4, left: 4 }}>
          <XAxis type="number" hide domain={[0, 100]} />
          <YAxis
            type="category"
            dataKey="nombre"
            width={120}
            tick={{ fill: COLOR_TEXTO, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Bar dataKey="caribe" name={t.grupo.CARIBE} fill="var(--color-accent-400)" radius={[0, 3, 3, 0]} isAnimationActive={false}>
            <LabelList dataKey="caribe" position="right" fill={COLOR_ETIQUETA} fontSize={10} formatter={etiqueta} />
          </Bar>
          <Bar dataKey="resto" name={t.grupo.RESTO_COLOMBIA} fill={`url(#${RAYAS_RESTO})`} radius={[0, 3, 3, 0]} isAnimationActive={false}>
            <LabelList dataKey="resto" position="right" fill={COLOR_ETIQUETA} fontSize={10} formatter={etiqueta} />
          </Bar>
        </BarChart>
      </Grafica>
      <Tabla titulo={`${t.comparacion}: ${titulo}`}>
        <thead>
          <tr>
            <th scope="col" className={th}>{t.columnaCategoria}</th>
            <th scope="col" className={th}>{t.grupo.CARIBE}</th>
            <th scope="col" className={th}>{t.grupo.RESTO_COLOMBIA}</th>
          </tr>
        </thead>
        <tbody>
          {categorias.map((c, i) => (
            <tr key={c.clave}>
              <th scope="row" className={cn(td, 'font-medium')}>{c.nombre}</th>
              {([caribe, resto] as const).map((g, j) => {
                const pct = j === 0 ? datos[i]!.caribe : datos[i]!.resto
                return (
                  <td key={g.grupo} className={td}>
                    {textoCelda(c.celda(g))}
                    {pct !== null && <span className="ml-1 text-slate-400">({t.porcentaje(pct)})</span>}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </Tabla>
    </div>
  )
}

/**
 * Leyenda en texto de las dos series (el color no es la única pista: el resto
 * va rayado). Define el patrón que usan las dos gráficas de la comparación.
 */
function LeyendaGrupos() {
  return (
    <ul className="flex flex-wrap gap-4 text-[11px] text-slate-300" aria-hidden>
      <li className="flex items-center gap-1.5">
        <span className="inline-block size-3 rounded-sm bg-accent-400" />
        {t.grupo.CARIBE}
      </li>
      <li className="flex items-center gap-1.5">
        <svg className="size-3" viewBox="0 0 12 12">
          <defs>
            <pattern id={RAYAS_RESTO} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="var(--color-surface-600)" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-brand-300)" strokeWidth="3" />
            </pattern>
          </defs>
          <rect width="12" height="12" fill={`url(#${RAYAS_RESTO})`} />
        </svg>
        {t.grupo.RESTO_COLOMBIA}
      </li>
    </ul>
  )
}

// RF-13 · Mapa del talento verificado: el Caribe frente al resto de Colombia
export function MapaTalento() {
  const consulta = useTalento()

  return (
    <Card>
      <CardHeader title={t.talento} subtitle={t.talentoSubtitulo} icon={<MapPin size={16} />} />
      <div className="p-5">
        {consulta.isPending ? (
          <EsqueletoTarjeta etiqueta={t.cargando} />
        ) : consulta.isError ? (
          esProhibido(consulta.error) ? (
            <EstadoSinPermiso />
          ) : (
            <EstadoError titulo={t.errorTalento} onReintentar={() => void consulta.refetch()} />
          )
        ) : consulta.data.verificados === 0 ? (
          <EmptyState icono={<MapPin size={22} />} titulo={t.sinVerificados} descripcion={t.sinVerificadosDetalle} />
        ) : (
          <ContenidoTalento datos={consulta.data} />
        )}
      </div>
    </Card>
  )
}

function ContenidoTalento({ datos }: { datos: NonNullable<ReturnType<typeof useTalento>['data']> }) {
  const posiciones = POSICIONES_LOL.map((p) => ({
    clave: p,
    nombre: es.posicionLol[p],
    celda: (g: GrupoTalentoRespuesta) => g.porPosicion[p],
  }))
  const bandas = [...BANDAS_RANGO, 'SIN_RANGO' as const].map((b) => ({
    clave: b,
    nombre: t.banda[b],
    celda: (g: GrupoTalentoRespuesta) => g.porBanda[b],
  }))
  const resumenGrupos = datos.grupos
    .map((g) => `${t.grupo[g.grupo]} ${textoCelda(g.total)}`)
    .join(', ')

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label={t.registrados} value={datos.jugadoresRegistrados} icono={<Users size={16} />} acento="violeta" />
        <Stat label={t.verificados} value={datos.verificados} icono={<CheckCircle2 size={16} />} acento="verde" />
        <Stat
          label={t.proporcion}
          value={datos.proporcionVerificados === null ? t.sinDato : formatoPorcentaje.format(datos.proporcionVerificados)}
          icono={<Trophy size={16} />}
          acento="cian"
        />
      </div>

      <section aria-labelledby="titulo-comparacion" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 id="titulo-comparacion" className="text-sm font-semibold text-slate-100">
            {t.comparacion}
          </h4>
          <LeyendaGrupos />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <ComparacionGrupos titulo={t.porPosicion} resumen={resumenGrupos} grupos={datos.grupos} categorias={posiciones} />
          <ComparacionGrupos titulo={t.porBanda} resumen={resumenGrupos} grupos={datos.grupos} categorias={bandas} />
        </div>
      </section>

      <section aria-labelledby="titulo-regiones" className="space-y-3">
        <h4 id="titulo-regiones" className="text-sm font-semibold text-slate-100">{t.porRegion}</h4>
        <Tabla titulo={t.porRegion}>
          <thead>
            <tr>
              <th scope="col" className={th}>{t.columnaRegion}</th>
              <th scope="col" className={th}>{t.columnaJugadores}</th>
              <th scope="col" className={th}>{t.columnaDepartamentos}</th>
            </tr>
          </thead>
          <tbody>
            {datos.macrorregiones.map((m) => (
              <tr key={m.macrorregion}>
                <th scope="row" className={cn(td, 'font-medium')}>{es.macrorregion[m.macrorregion]}</th>
                <td className={td}>{textoCelda(m.total)}</td>
                <td className={td}>
                  {m.departamentos.length === 0
                    ? t.sinDato
                    : m.departamentos
                        .map(
                          (d) =>
                            `${d.departamento === 'OTROS' ? t.otrosDepartamentos : es.departamento[d.departamento]} ${textoCelda(d.jugadores)}`,
                        )
                        .join(' · ')}
                </td>
              </tr>
            ))}
            <tr>
              <th scope="row" className={cn(td, 'font-medium')}>{t.fueraDeColombia}</th>
              <td className={td}>{textoCelda(datos.fueraDeColombia)}</td>
              <td className={td}>{t.sinDato}</td>
            </tr>
            <tr>
              <th scope="row" className={cn(td, 'font-medium')}>{t.sinUbicacion}</th>
              <td className={td}>{textoCelda(datos.sinUbicacion)}</td>
              <td className={td}>{t.sinDato}</td>
            </tr>
          </tbody>
        </Tabla>
      </section>

      <p className="text-[11px] leading-relaxed text-slate-400">{t.notaPrivacidad(datos.umbral)}</p>
    </div>
  )
}
