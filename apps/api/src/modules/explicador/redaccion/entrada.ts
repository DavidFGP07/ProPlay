import {
  DIMENSIONES_VISIBLES,
  rangoAlMenos,
  type CandidatoRanking,
  type DimensionMatching,
  type MetricaTecnicaLol,
} from "@proplay/shared";

/**
 * RF-11 · Entrada del explicador: sólo cifras y códigos (minimización, Ley
 * 1581). Sale del desglose, la explicación y el puntaje del candidato del
 * ranking; nunca de `candidato.jugador`. Ni nombres, ni correos, ni Riot ID, ni
 * ids, ni ubicación, ni fechas.
 *
 * Los porcentajes van ya calculados y como enteros (0–100) para que el modelo
 * no haga cuentas. Entran sólo las dimensiones visibles con peso mayor que 0:
 * las demás no aportan al puntaje y no se mencionan.
 */

/** Una parte de una dimensión: un componente de la técnica, las horas o la cercanía. */
export interface ParteDimension {
  componente: string;
  valor: number | string | null;
}

export interface DimensionEntrada {
  dimension: DimensionMatching;
  /** Valor de la dimensión, 0–100. */
  valor: number;
  /** Peso de la dimensión en la oferta, en %. */
  peso: number;
  faltanDatos: boolean;
  motivo: string | null;
  detalle: Record<string, unknown>;
}

export interface EntradaExplicador {
  oferta: {
    posicion: string;
    rangoMinimo: string | null;
    modalidad: string;
    horasSemana: number | null;
  };
  /** Puntaje total, 0–100. */
  compatibilidad: number;
  dimensiones: DimensionEntrada[];
  /** Dimensiones de la que más suma (peso × valor) a la que menos; sólo las que suman algo. */
  ordenPorAporte: DimensionMatching[];
  /** Dimensiones de la que más le quita al puntaje (peso × lo que le falta) a la que menos. */
  ordenPorLoQueResta: DimensionMatching[];
  /**
   * Si la misma dimensión encabeza las dos listas, qué parte de ella suma y
   * cuál resta, para que el texto no se contradiga («lo que más suma es la
   * técnica… lo que más resta es la técnica»).
   */
  mismaDimension: { dimension: DimensionMatching; suma: ParteDimension | null; resta: ParteDimension } | null;
  /**
   * Requisitos de la oferta que el candidato no cumple, calculados aquí y no
   * por el modelo: el ranking ordena a todos, aunque ninguno los cumpla, y el
   * texto tiene que decirlo en vez de resaltar sólo lo bueno.
   */
  requisitosNoCumplidos: RequisitoNoCumplido[];
}

/**
 * Un requisito de la oferta que el candidato no cumple: lo que pide la oferta
 * y lo que tiene el candidato (nulo si no hay datos verificados con que
 * comprobarlo, que tampoco cuenta como cumplido).
 */
export type RequisitoNoCumplido =
  | { requisito: "posicion"; pedido: string; candidato: string | null }
  | { requisito: "rangoMinimo"; pedido: string; candidato: string | null }
  | { requisito: "horasSemana"; pedido: number; candidato: number | null };

/**
 * Posición, rango mínimo y horas por semana: lo que la oferta pide como
 * mínimo. La ubicación no entra: la oferta no fija un mínimo, sólo pondera la
 * cercanía (con la relocalización).
 */
export function requisitosNoCumplidos(candidato: CandidatoRanking): RequisitoNoCumplido[] {
  const { tecnica, disponibilidad } = candidato.explicacion.dimensiones;
  const faltan: RequisitoNoCumplido[] = [];
  if (tecnica.posicionPrincipal !== tecnica.posicionPedida) {
    faltan.push({ requisito: "posicion", pedido: tecnica.posicionPedida, candidato: tecnica.posicionPrincipal });
  }
  if (tecnica.rangoMinimo && (!tecnica.rango || !rangoAlMenos(tecnica.rango, tecnica.rangoMinimo))) {
    faltan.push({ requisito: "rangoMinimo", pedido: tecnica.rangoMinimo, candidato: tecnica.rango });
  }
  const { horasOferta, horasJugador } = disponibilidad;
  if (horasOferta !== null && (horasJugador === null || horasJugador < horasOferta)) {
    faltan.push({ requisito: "horasSemana", pedido: horasOferta, candidato: horasJugador });
  }
  return faltan;
}

const porcentaje = (fraccion: number): number => Math.round(fraccion * 100);
const dosDecimales = (valor: number): number => Math.round(valor * 100) / 100;

/** Métricas que son fracciones (0–1) y se dan en %. */
const METRICAS_EN_PORCENTAJE: readonly MetricaTecnicaLol[] = ["winRate", "participacionKills"];
/** Métricas grandes que se redondean a entero. */
const METRICAS_ENTERAS: readonly MetricaTecnicaLol[] = ["danoPorMinuto", "oroPorMinuto"];

function valorMetrica(metrica: MetricaTecnicaLol, valor: number): { valor: number; unidad?: "%" } {
  if (METRICAS_EN_PORCENTAJE.includes(metrica)) return { valor: porcentaje(valor), unidad: "%" };
  if (METRICAS_ENTERAS.includes(metrica)) return { valor: Math.round(valor) };
  return { valor: dosDecimales(valor) };
}

function detalleDe(candidato: CandidatoRanking, dimension: DimensionMatching): Record<string, unknown> {
  const { dimensiones } = candidato.explicacion;
  switch (dimension) {
    case "tecnica": {
      const t = dimensiones.tecnica;
      return {
        posicionPrincipal: t.posicionPrincipal,
        partidasEnPosicion: t.fraccionEnPosicion === null ? null : porcentaje(t.fraccionEnPosicion),
        rango: t.rango,
        partidasAnalizadas: t.partidasAnalizadas,
        componentes: t.componentes && {
          posicion: porcentaje(t.componentes.posicion),
          rango: porcentaje(t.componentes.rango),
          rendimiento: porcentaje(t.componentes.rendimiento),
        },
        metricas: t.metricas.map((m) => ({
          metrica: m.metrica,
          ...valorMetrica(m.metrica, m.valor),
          escala: porcentaje(m.normalizado),
        })),
      };
    }
    case "geografica": {
      const g = dimensiones.geografica;
      return { cercania: g.cercania, relocalizacionAplicada: g.relocalizacionAplicada };
    }
    case "disponibilidad": {
      const d = dimensiones.disponibilidad;
      return { horasJugador: d.horasJugador, horasOferta: d.horasOferta };
    }
    case "habilidadesBlandas":
      return { endorsementsDeEquipos: dimensiones.habilidadesBlandas.endorsementsDeEquipos };
    case "experiencia":
      return {};
  }
}

/** Qué parte de la dimensión suma y cuál resta, cuando encabeza las dos listas. */
function partesDe(candidato: CandidatoRanking, dimension: DimensionMatching): {
  suma: ParteDimension | null;
  resta: ParteDimension;
} {
  const { dimensiones } = candidato.explicacion;
  if (dimension === "tecnica" && dimensiones.tecnica.componentes) {
    const partes = Object.entries(dimensiones.tecnica.componentes).map(([componente, valor]) => ({
      componente,
      valor: porcentaje(valor),
    }));
    // A igualdad, el orden de la fórmula: posición, rango, rendimiento.
    const fuerte = partes.reduce((a, b) => (b.valor > a.valor ? b : a));
    const debil = partes.reduce((a, b) => (b.valor < a.valor ? b : a));
    return { suma: fuerte.componente === debil.componente ? null : fuerte, resta: debil };
  }
  if (dimension === "disponibilidad") {
    return { suma: null, resta: { componente: "horasJugador", valor: dimensiones.disponibilidad.horasJugador } };
  }
  if (dimension === "geografica") {
    return { suma: null, resta: { componente: "cercania", valor: dimensiones.geografica.cercania } };
  }
  return { suma: null, resta: { componente: "valor", valor: porcentaje(candidato.desglose[dimension]) } };
}

export function construirEntrada(candidato: CandidatoRanking): EntradaExplicador {
  const { desglose, explicacion } = candidato;
  const { pesos, dimensiones } = explicacion;

  const activas = DIMENSIONES_VISIBLES.filter((d) => pesos[d] > 0);
  const aporte = (d: DimensionMatching) => pesos[d] * desglose[d];
  const loQueResta = (d: DimensionMatching) => pesos[d] * (1 - desglose[d]);
  // Orden estable: a igualdad, el de la ecuación (1).
  const ordenPor = (f: (d: DimensionMatching) => number) =>
    activas.filter((d) => f(d) > 0).sort((a, b) => f(b) - f(a));

  const ordenPorAporte = ordenPor(aporte);
  const ordenPorLoQueResta = ordenPor(loQueResta);
  const [primeraSuma] = ordenPorAporte;
  const mismaDimension =
    primeraSuma !== undefined && primeraSuma === ordenPorLoQueResta[0]
      ? { dimension: primeraSuma, ...partesDe(candidato, primeraSuma) }
      : null;

  return {
    oferta: {
      posicion: dimensiones.tecnica.posicionPedida,
      rangoMinimo: dimensiones.tecnica.rangoMinimo,
      modalidad: dimensiones.geografica.modalidad,
      horasSemana: dimensiones.disponibilidad.horasOferta,
    },
    compatibilidad: porcentaje(candidato.puntaje),
    dimensiones: activas.map((dimension) => ({
      dimension,
      valor: porcentaje(desglose[dimension]),
      peso: porcentaje(pesos[dimension]),
      faltanDatos: dimensiones[dimension].faltanDatos,
      motivo: dimensiones[dimension].motivo,
      detalle: detalleDe(candidato, dimension),
    })),
    ordenPorAporte,
    ordenPorLoQueResta,
    mismaDimension,
    requisitosNoCumplidos: requisitosNoCumplidos(candidato),
  };
}

/** Texto canónico de la entrada: el mismo objeto da siempre el mismo texto (clave de la caché). */
export function serializarEntrada(entrada: EntradaExplicador): string {
  return JSON.stringify(entrada, null, 2);
}
