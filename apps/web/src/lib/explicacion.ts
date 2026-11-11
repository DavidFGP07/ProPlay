import {
  MOTIVOS_FALTAN_DATOS,
  type CandidatoRanking,
  type DimensionMatching,
  type ExplicacionDisponibilidad,
  type ExplicacionGeografica,
  type ExplicacionTecnica,
  type MetricaTecnicaLol,
  type MotivoDimension,
} from '@proplay/shared'
import { es } from '@/i18n/es'
import { aPorcentaje } from '@/lib/aportes'
import { DIMENSIONES_VISIBLES } from '@/lib/pesos'
import { lugar } from '@/lib/ubicacion'

/**
 * RF-11 · Explicación determinista del puntaje: frases construidas con los
 * códigos de motivo y las cifras que guardó el motor (`explicacion` del
 * contrato), sin ningún modelo de lenguaje. Los textos viven en `i18n/es.ts`.
 * La explicación generada del Sprint 4 partirá de estos mismos datos.
 */

const t = es.explicacion

const formatoFecha = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' })
const dosDecimales = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const hastaDosDecimales = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 })
const entero = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })

/** Métricas que el motor guarda como fracción y se leen como porcentaje. */
const METRICAS_EN_PORCENTAJE: readonly MetricaTecnicaLol[] = ['winRate', 'participacionKills']
/** Métricas con valores de cientos: sin decimales. */
const METRICAS_ENTERAS: readonly MetricaTecnicaLol[] = ['oroPorMinuto', 'danoPorMinuto']

const FALTAN_DATOS: readonly MotivoDimension[] = MOTIVOS_FALTAN_DATOS

/** Valor de una métrica como se le enseña al equipo. */
export function formatearMetrica(metrica: MetricaTecnicaLol, valor: number): string {
  if (METRICAS_EN_PORCENTAJE.includes(metrica)) return `${aPorcentaje(valor)} %`
  if (METRICAS_ENTERAS.includes(metrica)) return entero.format(valor)
  return hastaDosDecimales.format(valor)
}

/**
 * Datos que le faltan al candidato en las dimensiones visibles, para la marca
 * «Faltan datos: …» de la fila del ranking.
 */
export function datosQueFaltan(candidato: Pick<CandidatoRanking, 'explicacion'>): string[] {
  return DIMENSIONES_VISIBLES.flatMap((dimension) => {
    const { faltanDatos, motivo } = candidato.explicacion.dimensiones[dimension]
    const dato = faltanDatos && motivo ? es.ranking.dato[motivo] : undefined
    return dato ? [dato] : []
  })
}

/** La dimensión se puntuó sin el dato del jugador (0 o el valor neutro). */
export function faltanDatosEn(
  candidato: Pick<CandidatoRanking, 'explicacion'>,
  dimension: DimensionMatching,
): boolean {
  const { faltanDatos, motivo } = candidato.explicacion.dimensiones[dimension]
  return faltanDatos || (motivo !== null && FALTAN_DATOS.includes(motivo))
}

export interface MetricaExplicada {
  metrica: MetricaTecnicaLol
  nombre: string
  valor: string
  /** Lugar en la escala fija de la posición, de 0 a 100. */
  normalizado: number
}

export interface ExplicacionDimension {
  /** Frases de la explicación, en orden. */
  frases: string[]
  /** Sólo en la técnica: la cuenta completa, las métricas y la muestra. */
  formula?: string
  metricas?: MetricaExplicada[]
  muestra?: string
}

function explicarTecnica(e: ExplicacionTecnica, valor: number): ExplicacionDimension {
  if (e.motivo === 'SIN_CUENTA_VERIFICADA') return { frases: [t.tecnica.sinCuenta] }
  if (e.motivo === 'SIN_CAPTURA' || !e.componentes) return { frases: [t.tecnica.sinCaptura] }

  const posicion = es.posicionLol[e.posicionPedida]
  const fraccion = e.fraccionEnPosicion ?? 0
  const { posicion: factor, rango: parteRango, rendimiento } = e.componentes
  const frases: string[] = []

  // Factor de posición.
  if (fraccion === 0) frases.push(t.tecnica.posicionNunca(posicion))
  else if (factor < 1) {
    frases.push(t.tecnica.posicionParcial(posicion, aPorcentaje(fraccion), dosDecimales.format(factor)))
  } else frases.push(t.tecnica.posicionEspecialista(posicion, aPorcentaje(fraccion)))
  if (e.posicionPrincipal && e.posicionPrincipal !== e.posicionPedida) {
    frases.push(t.tecnica.principal(es.posicionLol[e.posicionPrincipal]))
  }

  // Rango frente al mínimo de la oferta.
  if (!e.rango) frases.push(t.tecnica.sinRango)
  else if (!e.rangoMinimo) {
    frases.push(t.tecnica.rangoSinMinimo(es.rangoLol[e.rango], aPorcentaje(parteRango)))
  } else if (parteRango >= 1) {
    frases.push(t.tecnica.rangoCumple(es.rangoLol[e.rango], es.rangoLol[e.rangoMinimo]))
  } else {
    frases.push(
      t.tecnica.rangoPorDebajo(es.rangoLol[e.rango], es.rangoLol[e.rangoMinimo], aPorcentaje(parteRango)),
    )
  }

  // Rendimiento.
  frases.push(t.tecnica.rendimiento(aPorcentaje(rendimiento), e.metricas.length))

  return {
    frases,
    formula: t.tecnica.formula(
      dosDecimales.format(factor),
      dosDecimales.format(parteRango),
      dosDecimales.format(rendimiento),
      aPorcentaje(valor),
    ),
    metricas: e.metricas.map((m) => ({
      metrica: m.metrica,
      nombre: t.metrica[m.metrica],
      valor: formatearMetrica(m.metrica, m.valor),
      normalizado: aPorcentaje(m.normalizado),
    })),
    muestra:
      e.partidasAnalizadas !== null && e.datosDel
        ? t.tecnica.muestra(e.partidasAnalizadas, formatoFecha.format(e.datosDel))
        : undefined,
  }
}

function explicarGeografica(
  e: ExplicacionGeografica,
  jugador: CandidatoRanking['jugador'],
): ExplicacionDimension {
  if (e.motivo === 'OFERTA_REMOTA') return { frases: [t.geografica.ofertaRemota] }
  if (e.motivo === 'SIN_UBICACION' || !e.cercania) {
    return { frases: [t.geografica.modalidad(es.modalidad[e.modalidad]), t.geografica.sinUbicacion] }
  }
  const frases = [t.geografica.modalidad(es.modalidad[e.modalidad]), t.geografica.cercania[e.cercania]]
  if (jugador.pais) frases.push(t.geografica.viveEn(lugar(jugador.pais, jugador.departamento)))
  if (e.relocalizacionAplicada) frases.push(t.geografica.relocalizacion)
  else if (e.cercania !== 'MISMO_DEPARTAMENTO' && !jugador.dispuestoRelocalizar) {
    frases.push(t.geografica.sinRelocalizacion)
  }
  return { frases }
}

function explicarDisponibilidad(e: ExplicacionDisponibilidad, valor: number): ExplicacionDimension {
  if (e.motivo === 'OFERTA_SIN_HORAS' || e.horasOferta === null) {
    return { frases: [t.disponibilidad.ofertaSinHoras] }
  }
  if (e.motivo === 'SIN_HORAS' || e.horasJugador === null) return { frases: [t.disponibilidad.sinHoras] }
  return {
    frases: [
      e.horasJugador >= e.horasOferta
        ? t.disponibilidad.cubre(e.horasJugador, e.horasOferta)
        : t.disponibilidad.parcial(e.horasJugador, e.horasOferta, aPorcentaje(valor)),
    ],
  }
}

/**
 * Explicación de una dimensión visible del candidato. Las dos dimensiones sin
 * datos en el piloto no se muestran, así que no tienen explicación.
 */
export function explicarDimension(
  candidato: Pick<CandidatoRanking, 'jugador' | 'desglose' | 'explicacion'>,
  dimension: DimensionMatching,
): ExplicacionDimension {
  const { dimensiones } = candidato.explicacion
  const valor = candidato.desglose[dimension]
  switch (dimension) {
    case 'tecnica':
      return explicarTecnica(dimensiones.tecnica, valor)
    case 'geografica':
      return explicarGeografica(dimensiones.geografica, candidato.jugador)
    case 'disponibilidad':
      return explicarDisponibilidad(dimensiones.disponibilidad, valor)
    default:
      return { frases: [] }
  }
}
