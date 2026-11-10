import type { ExplicacionTecnica, MetricaTecnicaLol, PosicionLol } from "@proplay/shared";
import {
  DIVISIONES_HASTA_CERO,
  INDICE_RANGO_MAXIMO,
  METRICAS_POR_POSICION,
  SUBPESOS_TECNICA,
  clamp01,
  escalaDe,
  indiceRango,
  normalizar,
  winRateAjustado,
} from "./escalas";
import type { CapturaVerificada, JugadorMotor, OfertaMotor } from "./tipos";

/**
 * RF-09 · Dimensión técnica: posición, rango y rendimiento de la última
 * captura verificada frente a la posición y el rango mínimo de la oferta.
 *
 *   d_tec = 0,25·posición + 0,35·rango + 0,40·rendimiento
 *
 * Sin cuenta verificada o sin captura vale 0 y lo marca como «faltan datos»:
 * nada declarado por el jugador cuenta como dato de juego.
 */
export function evaluarTecnica(
  jugador: JugadorMotor,
  oferta: OfertaMotor,
): { valor: number; explicacion: ExplicacionTecnica } {
  const base = {
    posicionPedida: oferta.rol,
    rangoMinimo: oferta.rangoMinimo,
  };
  const captura = jugador.verificado ? jugador.captura : null;
  if (!captura) {
    return {
      valor: 0,
      explicacion: {
        ...base,
        faltanDatos: true,
        motivo: jugador.verificado ? "SIN_CAPTURA" : "SIN_CUENTA_VERIFICADA",
        posicionPrincipal: null,
        fraccionEnPosicion: null,
        rango: null,
        partidasAnalizadas: null,
        datosDel: null,
        componentes: null,
        metricas: [],
      },
    };
  }

  const fraccion = fraccionEnPosicion(captura, oferta.rol);
  const posicion = captura.posicion === oferta.rol ? 1 : fraccion;
  const rango = puntajeRango(captura, oferta);
  const metricas = metricasNormalizadas(captura, oferta.rol);
  const rendimiento =
    metricas.length > 0 ? metricas.reduce((s, m) => s + m.normalizado, 0) / metricas.length : 0;

  const componentes = { posicion, rango, rendimiento };
  const valor = clamp01(
    SUBPESOS_TECNICA.posicion * posicion +
      SUBPESOS_TECNICA.rango * rango +
      SUBPESOS_TECNICA.rendimiento * rendimiento,
  );
  return {
    valor,
    explicacion: {
      ...base,
      faltanDatos: false,
      motivo: null,
      posicionPrincipal: captura.posicion,
      fraccionEnPosicion: fraccion,
      rango: captura.rango,
      partidasAnalizadas: captura.partidasAnalizadas,
      datosDel: captura.capturadaEn,
      componentes,
      metricas,
    },
  };
}

/**
 * Fracción de las partidas de solo/dúo jugadas en la posición pedida. Sin
 * distribución, 1 si es su posición principal y 0 si no.
 */
export function fraccionEnPosicion(captura: CapturaVerificada, rol: PosicionLol): number {
  const distribucion = captura.distribucionRoles;
  const total = distribucion
    ? Object.values(distribucion).reduce((s, n) => s + (n ?? 0), 0)
    : 0;
  if (!distribucion || total <= 0) return captura.posicion === rol ? 1 : 0;
  return clamp01((distribucion[rol] ?? 0) / total);
}

/**
 * Con rango mínimo: 1 si lo cumple; por debajo baja linealmente y llega a 0
 * una liga entera (cuatro divisiones) por debajo. Sin mínimo, el rango
 * absoluto en el catálogo. Sin rango en solo/dúo, 0.
 */
export function puntajeRango(captura: CapturaVerificada, oferta: OfertaMotor): number {
  if (!captura.rango) return 0;
  const i = indiceRango(captura.rango);
  if (!oferta.rangoMinimo) return i / INDICE_RANGO_MAXIMO;
  const falta = indiceRango(oferta.rangoMinimo) - i;
  return falta <= 0 ? 1 : clamp01(1 - falta / DIVISIONES_HASTA_CERO);
}

/** Métricas que cuentan para la posición pedida, normalizadas con sus escalas. */
export function metricasNormalizadas(
  captura: CapturaVerificada,
  rol: PosicionLol,
): ExplicacionTecnica["metricas"] {
  const salida: ExplicacionTecnica["metricas"] = [];
  for (const metrica of METRICAS_POR_POSICION[rol]) {
    const valor = valorMetrica(captura, metrica);
    if (valor === null) continue;
    const comparable =
      metrica === "winRate" ? winRateAjustado(valor, captura.partidasAnalizadas) : valor;
    salida.push({ metrica, valor, normalizado: normalizar(comparable, escalaDe(metrica, rol)) });
  }
  return salida;
}

function valorMetrica(captura: CapturaVerificada, metrica: MetricaTecnicaLol): number | null {
  const valor = captura.metricas[metrica];
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}
