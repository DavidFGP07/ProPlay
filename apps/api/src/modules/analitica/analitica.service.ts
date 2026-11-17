import {
  BANDAS_RANGO,
  DIMENSIONES_MATCHING,
  DIMENSIONES_VISIBLES,
  ETAPAS_EMBUDO,
  GRUPOS_TALENTO,
  MACROREGIONES,
  MACROREGION_POR_DEPARTAMENTO,
  MIN_CANDIDATOS_DIMENSION_DECISIVA,
  POSICIONES_LOL,
  TOP_DIMENSION_DECISIVA,
  UMBRAL_PRIVACIDAD_ANALITICA,
  VERSION_FORMULAS_MATCHING,
  bandaDeRango,
  type BandaRango,
  type CeldaTalento,
  type Departamento,
  type DimensionDecisiva,
  type DimensionMatching,
  type Embudo,
  type EmbudoEquipo,
  type EmbudoOferta,
  type GrupoTalento,
  type GrupoTalentoRespuesta,
  type Macrorregion,
  type MacrorregionTalento,
  type OfertaAnalitica,
  type PosicionLol,
  type ResumenDiasRespuesta,
  type Rol,
  type TalentoVerificado,
  type VentajaDimension,
} from "@proplay/shared";
import { AppError, ForbiddenError, NotFoundError } from "../../utils/errors";
import { rankingAlDia } from "../matching/matching.service";
import * as repositorio from "./analitica.repository";

/**
 * Lógica del módulo `analitica` (RF-13): los indicadores de la analítica
 * fusionada con el panel del equipo. Sólo lee. Las definiciones de cada
 * métrica están en docs/arquitectura.md, «Analítica»; las funciones puras de
 * este archivo (`construir…`, `suprimirFila`) las aplican a lo que agrega el
 * repository en SQL, y las prueban tests/analitica.test.ts.
 */

export interface Actor {
  id: string;
  rol: Rol;
}

// ---------------------------------------------------------------- permisos

async function equipoDe(actor: Actor): Promise<string> {
  const perfil = await repositorio.perfilEquipoDe(actor.id);
  if (!perfil) throw new NotFoundError("Perfil de equipo no encontrado");
  return perfil.id;
}

/**
 * Oferta del equipo del actor. Mismas reglas que `ofertas`: un borrador ajeno
 * responde 404 (es privado) y una oferta publicada de otro equipo, 403.
 */
async function ofertaPropia(id: string, actor: Actor): Promise<repositorio.OfertaPermisosDb> {
  const oferta = await repositorio.buscarOferta(id);
  const esPropia = oferta?.equipo.usuarioId === actor.id;
  if (!oferta || (oferta.estado === "BORRADOR" && !esPropia)) {
    throw new NotFoundError("Oferta no encontrada");
  }
  if (!esPropia) {
    throw new ForbiddenError("Sólo el equipo que publicó la oferta ve su analítica");
  }
  return oferta;
}

// ------------------------------------------------------------------ embudo

function resumenDias(serie: repositorio.SerieDiasDb): ResumenDiasRespuesta {
  return serie.n === 0
    ? { n: 0, mediana: null, media: null }
    : { n: serie.n, mediana: serie.mediana, media: serie.media };
}

/**
 * Embudo a partir de las filas por etapa del repository: una entrada por cada
 * etapa de `ETAPAS_EMBUDO`, también las que nadie alcanzó, y la conversión
 * desde la anterior (nula en la primera o si la anterior no tiene ninguna).
 * `ACEPTADA` es final: nadie «sigue» en ella ni tiene tiempo en la etapa.
 */
export function construirEmbudo(filas: readonly repositorio.EtapaEmbudoDb[]): Embudo {
  const porEtapa = new Map(filas.map((f) => [f.etapa, f]));
  let anterior: number | null = null;
  const etapas = ETAPAS_EMBUDO.map((etapa) => {
    const fila = porEtapa.get(etapa);
    const alcanzaron = fila?.alcanzaron ?? 0;
    const conversion = anterior === null || anterior === 0 ? null : alcanzaron / anterior;
    anterior = alcanzaron;
    const final = etapa === "ACEPTADA";
    return {
      etapa,
      alcanzaron,
      conversion,
      siguen: final ? 0 : (fila?.enEtapa ?? 0),
      rechazadas: fila?.rechazadas ?? 0,
      rechazadasAlCerrar: fila?.rechazadasAlCerrar ?? 0,
      diasEnEtapa: resumenDias(
        final || !fila ? { n: 0, mediana: null, media: null } : fila,
      ),
    };
  });
  return {
    postulaciones: etapas[0]!.alcanzaron,
    etapas,
    coincidenciasExitosas: etapas[etapas.length - 1]!.alcanzaron,
  };
}

/** Ofertas abiertas, cubiertas y cerradas sin cubrir, y la tasa de cobertura. */
function cobertura(ofertas: readonly repositorio.OfertaTiemposDb[]): EmbudoEquipo["cobertura"] {
  const cuenta = (estado: string) => ofertas.filter((o) => o.estado === estado).length;
  const cubiertas = cuenta("CUBIERTA");
  const cerradasSinCubrir = cuenta("CERRADA");
  const terminadas = cubiertas + cerradasSinCubrir;
  return {
    abiertas: cuenta("ABIERTA"),
    cubiertas,
    cerradasSinCubrir,
    tasa: terminadas === 0 ? null : cubiertas / terminadas,
  };
}

function aOfertaAnalitica(o: repositorio.OfertaTiemposDb): OfertaAnalitica {
  return {
    id: o.id,
    titulo: o.titulo,
    rol: o.rol,
    estado: o.estado,
    publicadaEn: o.publicadaEn,
    cerradaEn: o.cerradaEn,
    postulaciones: o.postulaciones,
    diasHastaCubrir: o.diasHastaCubrir,
    diasHastaPrimerTryout: o.diasHastaPrimerTryout,
    diasAbierta: o.diasAbierta,
  };
}

/**
 * RF-13 · Embudo agregado de las ofertas publicadas del equipo, con el tiempo
 * hasta cubrir (H1), el tiempo hasta el primer tryout y la cobertura.
 */
export async function embudoEquipo(actor: Actor, ahora = new Date()): Promise<EmbudoEquipo> {
  const filtro = { equipoId: await equipoDe(actor) };
  const [filas, tiempos, ofertas] = await Promise.all([
    repositorio.etapasEmbudo(filtro),
    repositorio.resumenTiempos(filtro, ahora),
    repositorio.ofertasConTiempos(filtro, ahora),
  ]);
  return {
    embudo: construirEmbudo(filas),
    diasHastaCubrir: resumenDias(tiempos.hastaCubrir),
    diasHastaPrimerTryout: resumenDias(tiempos.hastaPrimerTryout),
    cobertura: cobertura(ofertas),
    ofertas: ofertas.map(aOfertaAnalitica),
    calculadoEn: ahora,
  };
}

/**
 * RF-13 · Embudo de una oferta del equipo. Un borrador propio responde 409
 * `OFERTA_SIN_PUBLICAR`: todavía no tiene embudo.
 */
export async function embudoOferta(
  id: string,
  actor: Actor,
  ahora = new Date(),
): Promise<EmbudoOferta> {
  const oferta = await ofertaPropia(id, actor);
  if (oferta.estado === "BORRADOR") {
    throw new AppError(409, "OFERTA_SIN_PUBLICAR", "Un borrador todavía no tiene embudo");
  }
  const filtro = { ofertaId: oferta.id };
  const [filas, [fila]] = await Promise.all([
    repositorio.etapasEmbudo(filtro),
    repositorio.ofertasConTiempos(filtro, ahora),
  ]);
  return { oferta: aOfertaAnalitica(fila!), embudo: construirEmbudo(filas), calculadoEn: ahora };
}

// ------------------------------------------------------- dimensión decisiva

const SIN_DATOS: readonly DimensionMatching[] = DIMENSIONES_MATCHING.filter(
  (d) => !DIMENSIONES_VISIBLES.includes(d),
);

const fraccion = (n: number) => Math.min(1, Math.max(0, n));
/** Las sumas en coma flotante dejan residuos del orden de 1e-16. */
const EPSILON = 1e-9;

/**
 * Dimensión decisiva a partir de los dos grupos del ranking (top y resto):
 * ventaja = aporte medio del top − aporte medio del resto, por dimensión
 * visible, más «otras» si alguna dimensión sin datos tiene peso. Ordenadas de
 * mayor a menor ventaja (a igualdad, en el orden de la ecuación); la decisiva
 * es la visible de mayor ventaja positiva.
 */
export function construirDecisiva(
  ofertaId: string,
  grupos: readonly repositorio.GrupoRankingDb[],
  ahora = new Date(),
): DimensionDecisiva {
  const top = grupos.find((g) => g.top);
  const resto = grupos.find((g) => !g.top);
  const candidatos = (top?.n ?? 0) + (resto?.n ?? 0);
  // Datos del cálculo del ranking: los del más antiguo de los dos grupos.
  const presentes = [top, resto].filter((g): g is repositorio.GrupoRankingDb => g !== undefined);
  const calculadoEn =
    presentes.length === 0
      ? ahora
      : new Date(Math.min(...presentes.map((g) => g.calculadoEn.getTime())));
  const versionFormulas =
    presentes.length === 0
      ? VERSION_FORMULAS_MATCHING
      : Math.min(...presentes.map((g) => g.versionFormulas));
  const base = { ofertaId, candidatos, top: TOP_DIMENSION_DECISIVA, calculadoEn, versionFormulas };

  if (!top || !resto || candidatos < MIN_CANDIDATOS_DIMENSION_DECISIVA) {
    return {
      ...base,
      suficiente: false,
      puntajeMedioTop: null,
      puntajeMedioResto: null,
      ventajaTotal: null,
      dimensiones: [],
      decisiva: null,
    };
  }

  const indice = (d: DimensionMatching) => DIMENSIONES_MATCHING.indexOf(d);
  const ventaja = (aporteTop: number, aporteResto: number, peso: number) => ({
    peso: fraccion(peso),
    aporteMedioTop: fraccion(aporteTop),
    aporteMedioResto: fraccion(aporteResto),
    ventaja: Math.max(-1, Math.min(1, aporteTop - aporteResto)),
  });

  const dimensiones: VentajaDimension[] = DIMENSIONES_VISIBLES.map((d) => ({
    dimension: d,
    ...ventaja(top.aportes[indice(d)]!, resto.aportes[indice(d)]!, top.pesos[indice(d)]!),
  }));
  const pesoOtras = SIN_DATOS.reduce((s, d) => s + top.pesos[indice(d)]!, 0);
  if (pesoOtras > EPSILON) {
    const suma = (g: repositorio.GrupoRankingDb) =>
      SIN_DATOS.reduce((s, d) => s + g.aportes[indice(d)]!, 0);
    dimensiones.push({ dimension: "otras", ...ventaja(suma(top), suma(resto), pesoOtras) });
  }
  // Orden estable: a igualdad de ventaja se conserva el de la ecuación (1).
  dimensiones.sort((a, b) => b.ventaja - a.ventaja);

  const mejor = dimensiones.find((d) => d.dimension !== "otras");
  return {
    ...base,
    suficiente: true,
    puntajeMedioTop: fraccion(top.puntaje),
    puntajeMedioResto: fraccion(resto.puntaje),
    ventajaTotal: fraccion(top.puntaje - resto.puntaje),
    dimensiones,
    decisiva:
      mejor && mejor.ventaja > EPSILON ? (mejor.dimension as DimensionMatching) : null,
  };
}

/**
 * RF-13 · Qué dimensión decide el ranking de una oferta del equipo. Pone al
 * día el ranking antes de calcular (la misma regla que al leerlo).
 */
export async function dimensionDecisiva(id: string, actor: Actor): Promise<DimensionDecisiva> {
  const oferta = await ofertaPropia(id, actor);
  await rankingAlDia(oferta.id);
  const grupos = await repositorio.gruposDelRanking(oferta.id, TOP_DIMENSION_DECISIVA);
  return construirDecisiva(oferta.id, grupos);
}

// --------------------------------------------------------- mapa del talento

/**
 * Oculta las celdas de una fila que podrían identificar a alguien:
 *
 * 1. Si el total está por debajo del umbral (sin ser 0), se oculta la fila
 *    entera.
 * 2. Se oculta toda celda con 1 a `umbral − 1` jugadores.
 * 3. Supresión secundaria: si queda oculta una sola celda, se oculta también
 *    otra, porque si no se deduciría restando del total. Se elige la primera
 *    de `preferencia` que tenga jugadores (por defecto, la más pequeña).
 *
 * Las celdas con 0 se muestran: no identifican a nadie. Devuelve las celdas y
 * el total ya protegidos (`null` = oculta).
 */
export function suprimirFila(
  celdas: readonly number[],
  total: number,
  umbral = UMBRAL_PRIVACIDAD_ANALITICA,
  preferencia?: readonly number[],
): { celdas: CeldaTalento[]; total: CeldaTalento } {
  if (total > 0 && total < umbral) {
    return { celdas: celdas.map(() => null), total: null };
  }
  const salida: CeldaTalento[] = celdas.map((v) => (v > 0 && v < umbral ? null : v));
  const ocultas = salida.filter((v) => v === null).length;
  if (ocultas === 1) {
    const orden =
      preferencia ??
      celdas
        .map((_, i) => i)
        .sort((a, b) => celdas[a]! - celdas[b]! || a - b);
    const otra = orden.find((i) => salida[i] !== null && celdas[i]! > 0);
    if (otra !== undefined) salida[otra] = null;
  }
  return { celdas: salida, total };
}

const DEPARTAMENTOS_DE_MACRO = (macro: Macrorregion) =>
  (Object.keys(MACROREGION_POR_DEPARTAMENTO) as Departamento[]).filter(
    (d) => MACROREGION_POR_DEPARTAMENTO[d] === macro,
  );

/** Macrorregiones del resto de Colombia, en el orden de `MACROREGIONES`. */
const MACROS_RESTO = MACROREGIONES.filter((m) => m !== "CARIBE");

/**
 * Mapa del talento a partir de los conteos del repository, con el umbral de
 * privacidad aplicado a cada fila (ver `suprimirFila`):
 *
 * - Fila de ubicación: Caribe, resto de Colombia, fuera de Colombia y sin
 *   ubicación, contra el total de verificados. Si hace falta una supresión
 *   secundaria, se prefiere ocultar los dos últimos antes que un grupo.
 * - Si el total de un grupo queda oculto, todo su desglose también: sus
 *   celdas sumarían el total.
 * - Por grupo, la posición (con una celda implícita «sin captura» que no se
 *   devuelve) y la banda de rango.
 * - Las macrorregiones del resto, contra el total del resto; el Caribe es el
 *   propio grupo. En cada macrorregión, los departamentos por debajo del
 *   umbral se agrupan en `OTROS` antes de suprimir.
 */
export function construirTalento(
  filas: readonly repositorio.TalentoDb[],
  registrados: number,
  ahora = new Date(),
  umbral = UMBRAL_PRIVACIDAD_ANALITICA,
): TalentoVerificado {
  const verificados = filas.reduce((s, f) => s + f.jugadores, 0);

  type Ubicacion = { grupo: GrupoTalento; macro: Macrorregion; departamento: Departamento } | "FUERA" | "SIN";
  const ubicar = (f: repositorio.TalentoDb): Ubicacion => {
    if (f.pais === null) return "SIN";
    if (f.pais !== "CO") return "FUERA";
    if (!f.departamento) return "SIN";
    const macro = MACROREGION_POR_DEPARTAMENTO[f.departamento];
    return { grupo: macro === "CARIBE" ? "CARIBE" : "RESTO_COLOMBIA", macro, departamento: f.departamento };
  };
  const ubicadas = filas.map((f) => ({ ...f, donde: ubicar(f) }));
  const sumar = (pred: (u: (typeof ubicadas)[number]) => boolean) =>
    ubicadas.filter(pred).reduce((s, f) => s + f.jugadores, 0);
  const deGrupo = (g: GrupoTalento) => (u: (typeof ubicadas)[number]) =>
    typeof u.donde === "object" && u.donde.grupo === g;

  // Fila de ubicación: [Caribe, resto, fuera, sin ubicación] (preferencia: los dos últimos).
  const brutos = [
    sumar(deGrupo("CARIBE")),
    sumar(deGrupo("RESTO_COLOMBIA")),
    sumar((u) => u.donde === "FUERA"),
    sumar((u) => u.donde === "SIN"),
  ];
  const porTamano = (indices: number[]) =>
    [...indices].sort((a, b) => brutos[a]! - brutos[b]! || a - b);
  const ubicacion = suprimirFila(brutos, verificados, umbral, [
    ...porTamano([2, 3]),
    ...porTamano([0, 1]),
  ]);
  const totalGrupo = (g: GrupoTalento) => ubicacion.celdas[GRUPOS_TALENTO.indexOf(g)] ?? null;

  const grupos: GrupoTalentoRespuesta[] = GRUPOS_TALENTO.map((grupo) => {
    const total = totalGrupo(grupo);
    const del = ubicadas.filter(deGrupo(grupo));
    const cuenta = (pred: (f: (typeof del)[number]) => boolean) =>
      del.filter(pred).reduce((s, f) => s + f.jugadores, 0);

    const posiciones = POSICIONES_LOL.map((p) => cuenta((f) => f.posicion === p));
    const sinPosicion = cuenta((f) => !POSICIONES_LOL.includes(f.posicion as PosicionLol));
    const bandas = BANDAS_RANGO.map((b) => cuenta((f) => f.rango !== null && bandaDeRango(f.rango) === b));
    const sinRango = cuenta((f) => f.rango === null);

    const oculto = total === null;
    const filaPosicion = suprimirFila([...posiciones, sinPosicion], oculto ? 0 : total, umbral);
    const filaBanda = suprimirFila([...bandas, sinRango], oculto ? 0 : total, umbral);
    const celda = (c: CeldaTalento) => (oculto ? null : c);

    return {
      grupo,
      total,
      porPosicion: Object.fromEntries(
        POSICIONES_LOL.map((p, i) => [p, celda(filaPosicion.celdas[i]!)]),
      ) as GrupoTalentoRespuesta["porPosicion"],
      porBanda: Object.fromEntries(
        [...BANDAS_RANGO, "SIN_RANGO" as const].map((b, i) => [b, celda(filaBanda.celdas[i]!)]),
      ) as Record<BandaRango | "SIN_RANGO", CeldaTalento>,
    };
  });

  const enMacro = (m: Macrorregion) => (u: (typeof ubicadas)[number]) =>
    typeof u.donde === "object" && u.donde.macro === m;
  const totalesResto = MACROS_RESTO.map((m) => sumar(enMacro(m)));
  const restoTotal = totalGrupo("RESTO_COLOMBIA");
  const filaResto = suprimirFila(totalesResto, restoTotal ?? 0, umbral);

  const macrorregiones: MacrorregionTalento[] = MACROREGIONES.map((macro) => {
    const total =
      macro === "CARIBE"
        ? totalGrupo("CARIBE")
        : restoTotal === null
          ? null
          : filaResto.celdas[MACROS_RESTO.indexOf(macro)]!;
    const bruto = sumar(enMacro(macro));
    if (total === null || bruto === 0) return { macrorregion: macro, total, departamentos: [] };

    const porDepartamento = DEPARTAMENTOS_DE_MACRO(macro).map((d) => ({
      departamento: d,
      jugadores: sumar((u) => typeof u.donde === "object" && u.donde.departamento === d),
    }));
    const grandes = porDepartamento.filter((d) => d.jugadores >= umbral);
    const otros = porDepartamento
      .filter((d) => d.jugadores > 0 && d.jugadores < umbral)
      .reduce((s, d) => s + d.jugadores, 0);
    const lista: { departamento: Departamento | "OTROS"; jugadores: number }[] = [
      ...grandes,
      ...(otros > 0 ? [{ departamento: "OTROS" as const, jugadores: otros }] : []),
    ];
    const protegida = suprimirFila(
      lista.map((d) => d.jugadores),
      bruto,
      umbral,
    );
    return {
      macrorregion: macro,
      total,
      departamentos: lista.map((d, i) => ({
        departamento: d.departamento,
        jugadores: protegida.celdas[i]!,
      })),
    };
  });

  return {
    jugadoresRegistrados: registrados,
    verificados,
    proporcionVerificados: registrados === 0 ? null : fraccion(verificados / registrados),
    umbral,
    grupos,
    macrorregiones,
    fueraDeColombia: ubicacion.celdas[2]!,
    sinUbicacion: ubicacion.celdas[3]!,
    calculadoEn: ahora,
  };
}

/**
 * RF-13 · Mapa del talento verificado, con el umbral de privacidad aplicado.
 * `excluirPrueba` deja fuera las cuentas del seed (script del piloto).
 */
export async function talento(ahora = new Date(), excluirPrueba = false): Promise<TalentoVerificado> {
  const [filas, registrados] = await Promise.all([
    repositorio.talentoVerificado(excluirPrueba),
    repositorio.jugadoresRegistrados(excluirPrueba),
  ]);
  return construirTalento(filas, registrados, ahora);
}

// ------------------------------------------------------ métricas del piloto

export interface OpcionesPiloto {
  /** Primer día de publicación de las ofertas (AAAA-MM-DD, en la zona del piloto). */
  desde?: string;
  /** Último día de publicación de las ofertas (AAAA-MM-DD). */
  hasta?: string;
  /** Deja fuera las cuentas del seed (`utils/datosDePrueba.ts`). */
  excluirPrueba: boolean;
}

export interface OfertaPiloto extends OfertaAnalitica {
  equipo: string;
  embudo: Embudo;
  dimensionDecisiva: DimensionDecisiva;
}

export interface MetricasPiloto {
  opciones: OpcionesPiloto;
  generadoEn: Date;
  ofertas: OfertaPiloto[];
  embudo: Embudo;
  diasHastaCubrir: ResumenDiasRespuesta;
  diasHastaPrimerTryout: ResumenDiasRespuesta;
  cobertura: EmbudoEquipo["cobertura"];
  talento: TalentoVerificado;
  registros: Partial<Record<Rol, number>>;
}

/**
 * Métricas de todo el piloto, para el informe de la tesis (script
 * `npm run metricas:piloto -w api`): las mismas definiciones que la API, sobre
 * todas las ofertas publicadas en la ventana, de cualquier equipo. No tiene
 * ruta: el panel de administración quedó fuera del alcance (decisión 0.10).
 * Pone al día el ranking de cada oferta antes de su dimensión decisiva (las
 * cubiertas o cerradas conservan su instantánea).
 */
export async function metricasPiloto(
  opciones: OpcionesPiloto,
  ahora = new Date(),
): Promise<MetricasPiloto> {
  const filtro: repositorio.FiltroOfertas = {
    desde: opciones.desde,
    hasta: opciones.hasta,
    excluirPrueba: opciones.excluirPrueba,
  };
  const [filas, tiempos, ofertas, mapa, registros] = await Promise.all([
    repositorio.etapasEmbudo(filtro),
    repositorio.resumenTiempos(filtro, ahora),
    repositorio.ofertasConTiempos(filtro, ahora),
    talento(ahora, opciones.excluirPrueba),
    repositorio.registrosPorRol(opciones.excluirPrueba),
  ]);

  const porOferta: OfertaPiloto[] = [];
  for (const oferta of ofertas) {
    const embudo = construirEmbudo(await repositorio.etapasEmbudo({ ...filtro, ofertaId: oferta.id }));
    await rankingAlDia(oferta.id);
    const grupos = await repositorio.gruposDelRanking(
      oferta.id,
      TOP_DIMENSION_DECISIVA,
      opciones.excluirPrueba,
    );
    porOferta.push({
      ...aOfertaAnalitica(oferta),
      equipo: oferta.equipo,
      embudo,
      dimensionDecisiva: construirDecisiva(oferta.id, grupos, ahora),
    });
  }

  return {
    opciones,
    generadoEn: ahora,
    ofertas: porOferta,
    embudo: construirEmbudo(filas),
    diasHastaCubrir: resumenDias(tiempos.hastaCubrir),
    diasHastaPrimerTryout: resumenDias(tiempos.hastaPrimerTryout),
    cobertura: cobertura(ofertas),
    talento: mapa,
    registros: Object.fromEntries(registros.map((r) => [r.rol, r.total])),
  };
}
