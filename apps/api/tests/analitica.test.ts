import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  API_PREFIX,
  DIMENSIONES_MATCHING,
  JUEGO_PILOTO,
  dimensionDecisivaSchema,
  embudoEquipoSchema,
  embudoOfertaSchema,
  talentoVerificadoSchema,
  type Departamento,
  type EstadoOferta,
  type PosicionLol,
  type RangoLol,
} from "@proplay/shared";
import { prisma } from "../src/config/prisma";
import type { EtapaEmbudoDb, GrupoRankingDb, TalentoDb } from "../src/modules/analitica/analitica.repository";
import {
  construirDecisiva,
  construirEmbudo,
  construirTalento,
  embudoEquipo,
  suprimirFila,
} from "../src/modules/analitica/analitica.service";
import { PREFIJO_PRUEBA, cerrarConexiones, emailDePrueba, limpiarUsuariosDePrueba } from "./utils/entorno";
import { conToken, registrar } from "./utils/ofertas";

/**
 * RF-13 · Analítica: embudo de la vacante con el tiempo hasta cubrirla (H1) y
 * hasta el primer tryout, dimensión que decide el ranking y mapa del talento
 * verificado con el umbral de privacidad. Cada métrica se prueba con datos
 * conocidos y su resultado exacto; las definiciones están en
 * docs/arquitectura.md, «Analítica».
 *
 * Las fechas de las pruebas de integración están elegidas para que contar los
 * días en UTC diera otro resultado que contarlos en Colombia (UTC−5).
 */
const RUTA = `${API_PREFIX}/analitica`;
const utc = (iso: string) => new Date(iso);

// ------------------------------------------------------- funciones puras

describe("construirEmbudo", () => {
  const fila = (etapa: string, cambios: Partial<EtapaEmbudoDb> = {}): EtapaEmbudoDb => ({
    etapa,
    alcanzaron: 0,
    enEtapa: 0,
    rechazadas: 0,
    rechazadasAlCerrar: 0,
    n: 0,
    mediana: null,
    media: null,
    ...cambios,
  });

  it("da las cuatro etapas en orden, con la conversión desde la anterior", () => {
    const embudo = construirEmbudo([
      fila("ENTREVISTA", { alcanzaron: 2, n: 1, mediana: 3, media: 3 }),
      fila("ENVIADA", { alcanzaron: 8, enEtapa: 2, rechazadas: 1, n: 6, mediana: 1.5, media: 2 }),
      fila("EN_REVISION", { alcanzaron: 5, rechazadasAlCerrar: 1, n: 3, mediana: 2, media: 2.5 }),
      fila("ACEPTADA", { alcanzaron: 1, enEtapa: 1 }),
    ]);
    expect(embudo.etapas.map((e) => [e.etapa, e.alcanzaron, e.conversion])).toEqual([
      ["ENVIADA", 8, null],
      ["EN_REVISION", 5, 5 / 8],
      ["ENTREVISTA", 2, 2 / 5],
      ["ACEPTADA", 1, 1 / 2],
    ]);
    expect(embudo.postulaciones).toBe(8);
    expect(embudo.coincidenciasExitosas).toBe(1);
    expect(embudo.etapas[0]).toMatchObject({ siguen: 2, rechazadas: 1, diasEnEtapa: { n: 6, mediana: 1.5, media: 2 } });
    expect(embudo.etapas[1]!.rechazadasAlCerrar).toBe(1);
    // ACEPTADA es final: nadie «sigue» en ella ni tiene tiempo en la etapa.
    expect(embudo.etapas[3]).toMatchObject({ siguen: 0, diasEnEtapa: { n: 0, mediana: null, media: null } });
  });

  it("sin postulaciones: todo a 0, conversiones nulas (no 0 %) y sin tiempos", () => {
    const embudo = construirEmbudo([]);
    expect(embudo.postulaciones).toBe(0);
    for (const etapa of embudo.etapas) {
      expect(etapa).toMatchObject({ alcanzaron: 0, conversion: null, diasEnEtapa: { n: 0, mediana: null } });
    }
  });
});

describe("suprimirFila (umbral de privacidad)", () => {
  it("oculta las celdas de 1 o 2 y muestra las de 0", () => {
    expect(suprimirFila([5, 0, 4, 2, 1], 12, 3).celdas).toEqual([5, 0, 4, null, null]);
  });

  it("supresión secundaria: con una sola celda oculta, oculta también la más pequeña con jugadores", () => {
    // Sin la segunda, la celda de 1 se deduciría: 10 − 5 − 4 = 1.
    expect(suprimirFila([5, 4, 1, 0], 10, 3).celdas).toEqual([5, null, null, 0]);
  });

  it("respeta el orden de preferencia de la supresión secundaria", () => {
    expect(suprimirFila([5, 4, 1], 10, 3, [0, 1, 2]).celdas).toEqual([null, 4, null]);
  });

  it("con dos o más celdas ocultas no hace falta la secundaria", () => {
    expect(suprimirFila([6, 2, 1], 9, 3).celdas).toEqual([6, null, null]);
  });

  it("un total por debajo del umbral oculta la fila entera", () => {
    expect(suprimirFila([2, 0], 2, 3)).toEqual({ celdas: [null, null], total: null });
  });

  it("una fila vacía se muestra (0 no identifica a nadie)", () => {
    expect(suprimirFila([0, 0], 0, 3)).toEqual({ celdas: [0, 0], total: 0 });
  });
});

describe("construirTalento", () => {
  const t = (
    departamento: Departamento | null,
    posicion: PosicionLol | null,
    rango: RangoLol | null,
    jugadores: number,
    pais: string | null = "CO",
  ): TalentoDb => ({ pais, departamento, posicion, rango, jugadores });

  const filas: TalentoDb[] = [
    // Caribe: 9 jugadores (Atlántico 6, Bolívar 2, Sucre 1).
    t("ATLANTICO", "MID", "DIAMANTE_II", 3),
    t("ATLANTICO", "ADC", "ORO_II", 3),
    t("BOLIVAR", "SOPORTE", "MAESTRO", 2),
    t("SUCRE", "TOP", null, 1),
    // Resto de Colombia: 7 (Antioquia 4, Bogotá 3).
    t("ANTIOQUIA", "TOP", "ESMERALDA_II", 4),
    t("BOGOTA_DC", "JUNGLA", "PLATA_I", 3),
    // Fuera de Colombia: 1. Sin ubicación: 4.
    t(null, "MID", "ORO_I", 1, "MX"),
    t(null, "ADC", "PLATINO_I", 4, null),
  ];
  const talento = construirTalento(filas, 30, utc("2026-11-17T12:00:00Z"));

  it("cuenta los verificados y su proporción sobre los registrados", () => {
    expect(talento.verificados).toBe(21);
    expect(talento.proporcionVerificados).toBeCloseTo(21 / 30, 10);
    expect(talentoVerificadoSchema.safeParse(talento).success).toBe(true);
  });

  it("en la fila de ubicación oculta primero los residuales, no un grupo", () => {
    // Fuera de Colombia (1) se oculta; la secundaria cae en «sin ubicación», no en un grupo.
    expect(talento.fueraDeColombia).toBeNull();
    expect(talento.sinUbicacion).toBeNull();
    expect(talento.grupos.map((g) => g.total)).toEqual([9, 7]);
  });

  it("compara Caribe y resto por posición y por banda de rango, con el umbral", () => {
    const [caribe, resto] = talento.grupos;
    // Caribe: MID 3, ADC 3, SOPORTE 2 y TOP 1 ocultos; JUNGLA 0.
    expect(caribe!.porPosicion).toEqual({ TOP: null, JUNGLA: 0, MID: 3, ADC: 3, SOPORTE: null });
    // Caribe por banda: Esmeralda–Diamante 3, Oro–Platino 3, Maestro 2 y sin rango 1 ocultos.
    expect(caribe!.porBanda).toEqual({
      HIERRO_PLATA: 0,
      ORO_PLATINO: 3,
      ESMERALDA_DIAMANTE: 3,
      MAESTRO_O_SUPERIOR: null,
      SIN_RANGO: null,
    });
    expect(resto!.porPosicion).toEqual({ TOP: 4, JUNGLA: 3, MID: 0, ADC: 0, SOPORTE: 0 });
    expect(resto!.porBanda.HIERRO_PLATA).toBe(3);
    expect(resto!.porBanda.ESMERALDA_DIAMANTE).toBe(4);
  });

  it("agrupa los departamentos pequeños en OTROS y aplica la secundaria dentro de la macrorregión", () => {
    const caribe = talento.macrorregiones.find((m) => m.macrorregion === "CARIBE")!;
    expect(caribe.total).toBe(9);
    // Bolívar (2) y Sucre (1) van a OTROS (3), que se muestra.
    expect(caribe.departamentos).toEqual([
      { departamento: "ATLANTICO", jugadores: 6 },
      { departamento: "OTROS", jugadores: 3 },
    ]);
    const andina = talento.macrorregiones.find((m) => m.macrorregion === "ANDINA")!;
    expect(andina.departamentos).toEqual([
      { departamento: "ANTIOQUIA", jugadores: 4 },
      { departamento: "BOGOTA_DC", jugadores: 3 },
    ]);
    expect(talento.macrorregiones.find((m) => m.macrorregion === "PACIFICA")).toEqual({
      macrorregion: "PACIFICA",
      total: 0,
      departamentos: [],
    });
  });

  it("si el total de un grupo queda oculto, también todo su desglose", () => {
    const pocos = construirTalento(
      [t("ATLANTICO", "MID", "ORO_II", 5), t("ANTIOQUIA", "TOP", "ORO_II", 2)],
      10,
    );
    const resto = pocos.grupos[1]!;
    expect(resto.total).toBeNull();
    expect(Object.values(resto.porPosicion).every((c) => c === null)).toBe(true);
    expect(Object.values(resto.porBanda).every((c) => c === null)).toBe(true);
    expect(pocos.macrorregiones.find((m) => m.macrorregion === "ANDINA")).toMatchObject({
      total: null,
      departamentos: [],
    });
  });
});

describe("construirDecisiva", () => {
  const indice = (d: string) => DIMENSIONES_MATCHING.indexOf(d as (typeof DIMENSIONES_MATCHING)[number]);
  const vector = (valores: Record<string, number>) =>
    DIMENSIONES_MATCHING.map((d) => valores[d] ?? 0);
  const grupo = (top: boolean, n: number, aportes: Record<string, number>, pesos: Record<string, number>): GrupoRankingDb => ({
    top,
    n,
    puntaje: Object.values(aportes).reduce((s, v) => s + v, 0),
    aportes: vector(aportes),
    pesos: vector(pesos),
    calculadoEn: utc("2026-11-17T12:00:00Z"),
    versionFormulas: 2,
  });
  const pesos = { tecnica: 0.6, geografica: 0, disponibilidad: 0.4 };

  it("la decisiva es la de mayor ventaja y las ventajas suman la diferencia de puntaje medio", () => {
    const r = construirDecisiva("o", [
      grupo(true, 5, { tecnica: 0.45, disponibilidad: 0.3 }, pesos),
      grupo(false, 11, { tecnica: 0.05, disponibilidad: 0.35 }, pesos),
    ]);
    expect(r.suficiente).toBe(true);
    expect(r.candidatos).toBe(16);
    expect(r.decisiva).toBe("tecnica");
    expect(r.dimensiones.map((d) => d.dimension)).toEqual(["tecnica", "geografica", "disponibilidad"]);
    expect(r.dimensiones[0]!.ventaja).toBeCloseTo(0.4, 12);
    // La disponibilidad juega en contra de los primeros.
    expect(r.dimensiones[2]!.ventaja).toBeCloseTo(-0.05, 12);
    const suma = r.dimensiones.reduce((s, d) => s + d.ventaja, 0);
    expect(suma).toBeCloseTo(r.ventajaTotal!, 12);
    expect(r.ventajaTotal).toBeCloseTo(0.35, 12);
    expect(dimensionDecisivaSchema.safeParse(r).success).toBe(true);
  });

  it("una dimensión sin datos con peso aparece como «otras» y nunca es la decisiva", () => {
    const conExperiencia = { ...pesos, tecnica: 0.4, experiencia: 0.2 };
    const r = construirDecisiva("o", [
      grupo(true, 5, { tecnica: 0.1, experiencia: 0.2, disponibilidad: 0.4 }, conExperiencia),
      grupo(false, 5, { tecnica: 0.05, experiencia: 0, disponibilidad: 0.4 }, conExperiencia),
    ]);
    expect(r.dimensiones[0]).toMatchObject({ dimension: "otras", peso: 0.2 });
    expect(r.dimensiones[0]!.ventaja).toBeCloseTo(0.2, 12);
    expect(r.decisiva).toBe("tecnica");
    expect(r.dimensiones.reduce((s, d) => s + d.ventaja, 0)).toBeCloseTo(r.ventajaTotal!, 12);
    expect(indice("experiencia")).toBeGreaterThan(-1);
  });

  it("con menos de 8 candidatos no hay cálculo", () => {
    const r = construirDecisiva("o", [
      grupo(true, 5, { tecnica: 0.5 }, pesos),
      grupo(false, 2, { tecnica: 0.1 }, pesos),
    ]);
    expect(r).toMatchObject({ suficiente: false, candidatos: 7, dimensiones: [], decisiva: null, ventajaTotal: null });
    expect(dimensionDecisivaSchema.safeParse(r).success).toBe(true);
  });

  it("sin diferencia entre grupos no hay dimensión decisiva", () => {
    const igual = { tecnica: 0.3, disponibilidad: 0.4 };
    const r = construirDecisiva("o", [grupo(true, 5, igual, pesos), grupo(false, 5, igual, pesos)]);
    expect(r.suficiente).toBe(true);
    expect(r.decisiva).toBeNull();
  });
});

// ---------------------------------------------------------- integración

let tokenEquipo: string;
let tokenOtroEquipo: string;
let tokenScout: string;
let tokenJugador: string;
let usuarioEquipo: string;
let equipoId: string;
let otroEquipoId: string;
const ofertas: Record<string, string> = {};

async function perfilEquipo(etiqueta: string) {
  return prisma.perfilEquipo.findFirstOrThrow({
    where: { usuario: { email: { startsWith: `${PREFIJO_PRUEBA}+${etiqueta}-` } } },
  });
}

/** Jugador sin cuenta verificada, sólo para postularse. */
async function postulante(etiqueta: string): Promise<string> {
  const usuario = await prisma.usuario.create({
    data: {
      email: emailDePrueba(etiqueta),
      passwordHash: "sin-acceso",
      nombre: `Postulante ${etiqueta}`,
      rol: "JUGADOR",
      perfilJugador: { create: { pais: "CO", departamento: "VICHADA", disponibilidadHoras: 20 } },
    },
    include: { perfilJugador: true },
  });
  return usuario.perfilJugador!.id;
}

/** Jugador con cuenta de Riot verificada y una captura. */
async function verificado(
  etiqueta: string,
  datos: { departamento: Departamento; posicion?: PosicionLol; rango?: RangoLol; winRate?: number; horas?: number },
): Promise<string> {
  const { departamento, posicion = "MID", rango = "DIAMANTE_II", winRate = 0.55, horas = 20 } = datos;
  const usuario = await prisma.usuario.create({
    data: {
      email: emailDePrueba(etiqueta),
      passwordHash: "sin-acceso",
      nombre: `Verificado ${etiqueta}`,
      rol: "JUGADOR",
      perfilJugador: { create: { pais: "CO", departamento, disponibilidadHoras: horas } },
    },
    include: { perfilJugador: true },
  });
  const perfil = usuario.perfilJugador!;
  const cuenta = await prisma.cuentaGaming.create({
    data: {
      jugadorId: perfil.id,
      plataforma: "RIOT",
      externalId: `test-puuid-${perfil.id}`,
      verificadaEn: utc("2026-10-01T12:00:00Z"),
    },
  });
  await prisma.estadistica.create({
    data: {
      jugadorId: perfil.id,
      cuentaId: cuenta.id,
      juego: JUEGO_PILOTO,
      rol: posicion,
      rango,
      partidas: 20,
      victorias: Math.round(20 * winRate),
      kda: 3.2,
      winRate,
      fuente: "RIOT",
      metricas: {
        partidasAnalizadas: 20,
        csPorMinuto: 7,
        danoPorMinuto: 650,
        participacionKills: 0.6,
        distribucionRoles: { [posicion]: 20 },
      },
      capturadaEn: utc("2026-11-01T12:00:00Z"),
    },
  });
  return perfil.id;
}

async function oferta(
  equipo: string,
  titulo: string,
  estado: EstadoOferta,
  publicadaEn: Date | null,
  cerradaEn: Date | null = null,
): Promise<string> {
  const creada = await prisma.oferta.create({
    data: {
      equipoId: equipo,
      titulo,
      juego: JUEGO_PILOTO,
      rol: "MID",
      modalidad: "REMOTA",
      horasSemana: 20,
      descripcion: "Oferta de las pruebas de la analítica.",
      pesoTecnica: 0.6,
      pesoExperiencia: 0,
      pesoHabilidadesBlandas: 0,
      pesoGeografica: 0,
      pesoDisponibilidad: 0.4,
      estado,
      publicadaEn,
      cerradaEn,
    },
  });
  return creada.id;
}

async function postulacion(
  ofertaId: string,
  etiqueta: string,
  fechas: { creadoEn: string; revisadaEn?: string; entrevistaEn?: string; aceptadaEn?: string; rechazadaEn?: string },
) {
  const estado = fechas.rechazadaEn
    ? "RECHAZADA"
    : fechas.aceptadaEn
      ? "ACEPTADA"
      : fechas.entrevistaEn
        ? "ENTREVISTA"
        : fechas.revisadaEn
          ? "EN_REVISION"
          : "ENVIADA";
  const fecha = (iso?: string) => (iso ? utc(iso) : null);
  await prisma.postulacion.create({
    data: {
      ofertaId,
      jugadorId: await postulante(etiqueta),
      estado,
      creadoEn: utc(fechas.creadoEn),
      revisadaEn: fecha(fechas.revisadaEn),
      entrevistaEn: fecha(fechas.entrevistaEn),
      aceptadaEn: fecha(fechas.aceptadaEn),
      rechazadaEn: fecha(fechas.rechazadaEn),
    },
  });
}

beforeAll(async () => {
  await limpiarUsuariosDePrueba();
  tokenEquipo = await registrar("analitica-a", "EQUIPO");
  tokenOtroEquipo = await registrar("analitica-b", "EQUIPO");
  tokenScout = await registrar("analitica-scout", "SCOUT");
  tokenJugador = await registrar("analitica-jugador", "JUGADOR");
  const a = await perfilEquipo("analitica-a");
  equipoId = a.id;
  usuarioEquipo = a.usuarioId;
  otroEquipoId = (await perfilEquipo("analitica-b")).id;

  // O1 · cubierta. Publicada el 1 de octubre (10:00 en Colombia). La primera
  // aceptación es el 13 de octubre a las 04:59Z, que en Colombia todavía es el
  // 12: 11 días naturales (en UTC serían 12). El primer tryout, el 5 de
  // octubre a las 04:00Z (el 4 en Colombia): 3 días (en UTC, 4).
  ofertas.o1 = await oferta(equipoId, "O1", "CUBIERTA", utc("2026-10-01T15:00:00Z"), utc("2026-10-20T15:00:00Z"));
  await postulacion(ofertas.o1, "o1-aceptada", {
    creadoEn: "2026-10-02T15:00:00Z",
    revisadaEn: "2026-10-03T03:00:00Z", // 0,5 días en «enviada»
    entrevistaEn: "2026-10-05T04:00:00Z", // 2 días y 1 hora en revisión
    aceptadaEn: "2026-10-13T04:59:00Z", // 8 días y 59 minutos en entrevista
  });
  await postulacion(ofertas.o1, "o1-rechazada", {
    creadoEn: "2026-10-02T12:00:00Z",
    rechazadaEn: "2026-10-04T12:00:00Z", // rechazo del equipo tras 2 días en «enviada»
  });
  await postulacion(ofertas.o1, "o1-al-cerrar", {
    creadoEn: "2026-10-06T15:00:00Z",
    revisadaEn: "2026-10-07T15:00:00Z", // 1 día en «enviada»
    rechazadaEn: "2026-10-20T15:00:00Z", // = cerradaEn: rechazo automático en revisión
  });

  // O2 · cubierta en 20 días, primer tryout a los 5.
  ofertas.o2 = await oferta(equipoId, "O2", "CUBIERTA", utc("2026-09-01T15:00:00Z"), utc("2026-09-25T15:00:00Z"));
  await postulacion(ofertas.o2, "o2-aceptada", {
    creadoEn: "2026-09-02T15:00:00Z",
    revisadaEn: "2026-09-03T15:00:00Z",
    entrevistaEn: "2026-09-06T15:00:00Z",
    aceptadaEn: "2026-09-21T15:00:00Z",
  });

  // O3 · cubierta en 59 días (el caso extremo), primer tryout a los 10.
  ofertas.o3 = await oferta(equipoId, "O3", "CUBIERTA", utc("2026-08-01T15:00:00Z"), utc("2026-10-01T15:00:00Z"));
  await postulacion(ofertas.o3, "o3-aceptada", {
    creadoEn: "2026-08-02T15:00:00Z",
    revisadaEn: "2026-08-04T15:00:00Z",
    entrevistaEn: "2026-08-11T15:00:00Z",
    aceptadaEn: "2026-09-29T15:00:00Z",
  });

  // O4 · cerrada sin cubrir y sin postulaciones.
  ofertas.o4 = await oferta(equipoId, "O4", "CERRADA", utc("2026-10-10T15:00:00Z"), utc("2026-10-15T15:00:00Z"));

  // O5 · abierta. Publicada el 10 de noviembre a las 03:00Z (el 9 en Colombia).
  ofertas.o5 = await oferta(equipoId, "O5", "ABIERTA", utc("2026-11-10T03:00:00Z"));
  await postulacion(ofertas.o5, "o5-enviada", { creadoEn: "2026-11-11T15:00:00Z" });

  ofertas.borrador = await oferta(equipoId, "Borrador", "BORRADOR", null);
  ofertas.ajena = await oferta(otroEquipoId, "Ajena", "ABIERTA", utc("2026-11-01T15:00:00Z"));
  ofertas.borradorAjeno = await oferta(otroEquipoId, "Borrador ajeno", "BORRADOR", null);
});

afterAll(async () => {
  // Las ofertas caen en cascada con el perfil del equipo, y los jugadores con su usuario.
  await limpiarUsuariosDePrueba();
  await cerrarConexiones();
});

describe("GET /analitica/ofertas/:id/embudo", () => {
  it("da el embudo de la oferta con sus cifras exactas", async () => {
    const r = await conToken(tokenEquipo).get(`${RUTA}/ofertas/${ofertas.o1}/embudo`);
    expect(r.status).toBe(200);
    const { oferta: o, embudo } = embudoOfertaSchema.parse(r.body);
    expect(o).toMatchObject({ estado: "CUBIERTA", postulaciones: 3, diasHastaCubrir: 11, diasHastaPrimerTryout: 3, diasAbierta: null });

    const [enviada, revision, entrevista, aceptada] = embudo.etapas;
    expect([enviada, revision, entrevista, aceptada].map((e) => e!.alcanzaron)).toEqual([3, 2, 1, 1]);
    expect(revision!.conversion).toBeCloseTo(2 / 3, 12);
    expect(entrevista!.conversion).toBeCloseTo(1 / 2, 12);
    expect(aceptada!.conversion).toBe(1);
    // Rechazo del equipo en «enviada» y rechazo automático (al cerrar) en revisión.
    expect(enviada).toMatchObject({ rechazadas: 1, rechazadasAlCerrar: 0, siguen: 0 });
    expect(revision).toMatchObject({ rechazadas: 0, rechazadasAlCerrar: 1, siguen: 0 });
    // Tiempo en «enviada»: 0,5, 2 y 1 días → mediana 1, media 7/6.
    expect(enviada!.diasEnEtapa.n).toBe(3);
    expect(enviada!.diasEnEtapa.mediana).toBeCloseTo(1, 10);
    expect(enviada!.diasEnEtapa.media).toBeCloseTo(3.5 / 3, 10);
    // En revisión sólo cuenta la que siguió (2 días y 1 hora): el rechazo al cerrar no.
    expect(revision!.diasEnEtapa.n).toBe(1);
    expect(revision!.diasEnEtapa.mediana).toBeCloseTo(2 + 1 / 24, 10);
    expect(entrevista!.diasEnEtapa.mediana).toBeCloseTo(8 + 59 / 1440, 10);
    expect(embudo.coincidenciasExitosas).toBe(1);
  });

  it("una oferta sin postulaciones da un embudo vacío, sin tiempos", async () => {
    const r = await conToken(tokenEquipo).get(`${RUTA}/ofertas/${ofertas.o4}/embudo`);
    expect(r.status).toBe(200);
    const { oferta: o, embudo } = embudoOfertaSchema.parse(r.body);
    expect(o).toMatchObject({ estado: "CERRADA", postulaciones: 0, diasHastaCubrir: null, diasHastaPrimerTryout: null });
    expect(embudo.postulaciones).toBe(0);
    expect(embudo.etapas.every((e) => e.conversion === null && e.diasEnEtapa.n === 0)).toBe(true);
  });

  it("un borrador propio responde 409 OFERTA_SIN_PUBLICAR", async () => {
    const r = await conToken(tokenEquipo).get(`${RUTA}/ofertas/${ofertas.borrador}/embudo`);
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe("OFERTA_SIN_PUBLICAR");
  });

  it("un equipo no ve el embudo de otro: 403 en una publicada, 404 en un borrador", async () => {
    expect((await conToken(tokenEquipo).get(`${RUTA}/ofertas/${ofertas.ajena}/embudo`)).status).toBe(403);
    expect((await conToken(tokenEquipo).get(`${RUTA}/ofertas/${ofertas.borradorAjeno}/embudo`)).status).toBe(404);
    expect((await conToken(tokenOtroEquipo).get(`${RUTA}/ofertas/${ofertas.o1}/embudo`)).status).toBe(403);
  });

  it("el scout y el jugador no tienen embudo (403)", async () => {
    expect((await conToken(tokenScout).get(`${RUTA}/ofertas/${ofertas.o1}/embudo`)).status).toBe(403);
    expect((await conToken(tokenJugador).get(`${RUTA}/embudo`)).status).toBe(403);
    expect((await conToken(tokenScout).get(`${RUTA}/embudo`)).status).toBe(403);
  });
});

describe("GET /analitica/embudo", () => {
  it("agrega las ofertas publicadas del equipo con los tiempos de H1", async () => {
    const r = await conToken(tokenEquipo).get(`${RUTA}/embudo`);
    expect(r.status).toBe(200);
    const cuerpo = embudoEquipoSchema.parse(r.body);
    // Tiempo hasta cubrir: 11, 20 y 59 días → mediana 20, media 30.
    expect(cuerpo.diasHastaCubrir).toEqual({ n: 3, mediana: 20, media: 30 });
    // Primer tryout: 3, 5 y 10 días (la abierta no llegó a uno) → mediana 5, media 6.
    expect(cuerpo.diasHastaPrimerTryout).toEqual({ n: 3, mediana: 5, media: 6 });
    expect(cuerpo.cobertura).toEqual({ abiertas: 1, cubiertas: 3, cerradasSinCubrir: 1, tasa: 0.75 });
    // Sin el borrador ni las ofertas del otro equipo, de la más reciente a la más antigua.
    expect(cuerpo.ofertas.map((o) => o.titulo)).toEqual(["O5", "O4", "O1", "O2", "O3"]);
    expect(cuerpo.embudo.postulaciones).toBe(6);
    expect(cuerpo.embudo.etapas.map((e) => e.alcanzaron)).toEqual([6, 4, 3, 3]);
    expect(cuerpo.embudo.etapas[0]!.siguen).toBe(1);
    expect(cuerpo.embudo.coincidenciasExitosas).toBe(3);
  });

  it("cuenta los días que lleva abierta una oferta en la fecha de Colombia", async () => {
    // A las 12:00Z del 17 de noviembre: del 9 (publicación, en Colombia) al 17 son 8 días.
    const r = await embudoEquipo({ id: usuarioEquipo, rol: "EQUIPO" }, utc("2026-11-17T12:00:00Z"));
    expect(r.ofertas.find((o) => o.titulo === "O5")!.diasAbierta).toBe(8);
    // A las 04:30Z del 17 todavía es el 16 en Colombia: 7 días.
    const antes = await embudoEquipo({ id: usuarioEquipo, rol: "EQUIPO" }, utc("2026-11-17T04:30:00Z"));
    expect(antes.ofertas.find((o) => o.titulo === "O5")!.diasAbierta).toBe(7);
  });

  it("un equipo sin ofertas publicadas recibe el embudo vacío y sin tiempos", async () => {
    const r = await conToken(tokenOtroEquipo).get(`${RUTA}/embudo`);
    expect(r.status).toBe(200);
    const cuerpo = embudoEquipoSchema.parse(r.body);
    expect(cuerpo.diasHastaCubrir).toEqual({ n: 0, mediana: null, media: null });
    expect(cuerpo.cobertura.tasa).toBeNull();
    expect(cuerpo.ofertas.map((o) => o.titulo)).toEqual(["Ajena"]);
  });
});

describe("GET /analitica/ofertas/:id/dimension-decisiva", () => {
  let decisiva: string;

  beforeAll(async () => {
    // Cinco MID fuertes y cuatro TOP (técnica 0 en una oferta de MID), todos con
    // las 20 horas de la oferta: lo que separa al top del resto es la técnica.
    for (let i = 0; i < 5; i++) {
      await verificado(`decisiva-mid-${i}`, { departamento: "ARAUCA", posicion: "MID", winRate: 0.6 });
    }
    for (let i = 0; i < 4; i++) {
      await verificado(`decisiva-top-${i}`, { departamento: "ARAUCA", posicion: "TOP" });
    }
    decisiva = await oferta(equipoId, "Decisiva", "ABIERTA", utc("2026-11-12T15:00:00Z"));
  });

  it("la técnica decide y las ventajas suman la diferencia de puntaje medio", async () => {
    const r = await conToken(tokenEquipo).get(`${RUTA}/ofertas/${decisiva}/dimension-decisiva`);
    expect(r.status).toBe(200);
    const cuerpo = dimensionDecisivaSchema.parse(r.body);
    const ranking = await conToken(tokenEquipo).get(`${API_PREFIX}/matching/ofertas/${decisiva}/ranking`);
    expect(cuerpo.candidatos).toBe(ranking.body.meta.total);
    expect(cuerpo.suficiente).toBe(true);
    expect(cuerpo.decisiva).toBe("tecnica");
    const porDimension = Object.fromEntries(cuerpo.dimensiones.map((d) => [d.dimension, d]));
    // El ranking incluye a todos los jugadores de la base de pruebas (también
    // los postulantes de otras pruebas, sin cuenta verificada), así que sólo
    // se fija el orden: la técnica separa mucho más que la disponibilidad.
    expect(porDimension.tecnica!.ventaja).toBeGreaterThan(0.2);
    expect(porDimension.tecnica!.ventaja).toBeGreaterThan(porDimension.disponibilidad!.ventaja);
    expect(porDimension.geografica!.peso).toBe(0);
    const suma = cuerpo.dimensiones.reduce((s, d) => s + d.ventaja, 0);
    expect(suma).toBeCloseTo(cuerpo.ventajaTotal!, 10);
  });

  it("permisos: el otro equipo 403, el scout 403", async () => {
    expect((await conToken(tokenOtroEquipo).get(`${RUTA}/ofertas/${decisiva}/dimension-decisiva`)).status).toBe(403);
    expect((await conToken(tokenScout).get(`${RUTA}/ofertas/${decisiva}/dimension-decisiva`)).status).toBe(403);
  });
});

describe("GET /analitica/talento", () => {
  beforeAll(async () => {
    // Amazonía: 6 en Guainía y 1 en Guaviare. Guaviare va a OTROS (1, se
    // oculta) y la supresión secundaria oculta Guainía, que si no lo delataría.
    for (let i = 0; i < 6; i++) {
      await verificado(`talento-guainia-${i}`, { departamento: "GUAINIA", posicion: "SOPORTE", rango: "ORO_I" });
    }
    await verificado("talento-guaviare", { departamento: "GUAVIARE", posicion: "SOPORTE", rango: "ORO_I" });
  });

  it("el equipo y el scout lo ven, con el umbral y la supresión secundaria", async () => {
    for (const token of [tokenEquipo, tokenScout]) {
      const r = await conToken(token).get(`${RUTA}/talento`);
      expect(r.status).toBe(200);
      const cuerpo = talentoVerificadoSchema.parse(r.body);
      expect(cuerpo.umbral).toBe(3);
      const amazonia = cuerpo.macrorregiones.find((m) => m.macrorregion === "AMAZONIA")!;
      expect(amazonia.total).toBe(7);
      expect(amazonia.departamentos).toEqual([
        { departamento: "GUAINIA", jugadores: null },
        { departamento: "OTROS", jugadores: null },
      ]);
    }
  });

  it("el jugador no lo ve (403)", async () => {
    expect((await conToken(tokenJugador).get(`${RUTA}/talento`)).status).toBe(403);
  });
});
