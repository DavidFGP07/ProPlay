import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import {
  API_PREFIX,
  DIMENSIONES_MATCHING,
  JUEGO_PILOTO,
  ofertasCompatiblesSchema,
  rankingOfertaSchema,
  type Departamento,
  type OfertasCompatibles,
} from "@proplay/shared";
import { prisma } from "../src/config/prisma";
import { PREFIJO_PRUEBA, app, cerrarConexiones, limpiarUsuariosDePrueba } from "./utils/entorno";
import { conToken, crearOferta, postular, registrar } from "./utils/ofertas";

/**
 * RF-09 · GET /matching/jugador/me: las ofertas abiertas ordenadas por
 * compatibilidad con el jugador autenticado, con el mismo motor que el ranking
 * de cada oferta. Las pruebas filtran por un departamento que el seed no usa
 * (Guainía): la base puede tener otras ofertas abiertas.
 */
const RUTA = `${API_PREFIX}/matching/jugador/me`;
const AQUI: Departamento = "GUAINIA";
const haceDias = (dias: number) => new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

let tokenEquipo: string;
let tokenJugador: string;
let tokenSinCuenta: string;
let tokenScout: string;
let ofertaMid: string;
let ofertaSoporte: string;
let borrador: string;
let cerrada: string;

/** Perfil del jugador registrado con esa etiqueta, en Guainía y con 20 h. */
async function perfilDe(etiqueta: string): Promise<string> {
  const usuario = await prisma.usuario.findFirstOrThrow({
    where: { email: { startsWith: `${PREFIJO_PRUEBA}+${etiqueta}-` } },
    include: { perfilJugador: true },
  });
  const perfil = usuario.perfilJugador!;
  await prisma.perfilJugador.update({
    where: { id: perfil.id },
    data: { pais: "CO", departamento: AQUI, disponibilidadHoras: 20 },
  });
  return perfil.id;
}

/** Cuenta de Riot verificada con una captura de MID en Diamante II. */
async function verificar(jugadorId: string): Promise<void> {
  const cuenta = await prisma.cuentaGaming.create({
    data: {
      jugadorId,
      plataforma: "RIOT",
      externalId: `test-puuid-${jugadorId}`,
      verificadaEn: haceDias(30),
    },
  });
  await prisma.estadistica.create({
    data: {
      jugadorId,
      cuentaId: cuenta.id,
      juego: JUEGO_PILOTO,
      rol: "MID",
      rango: "DIAMANTE_II",
      partidas: 20,
      victorias: 11,
      kda: 3.2,
      winRate: 0.55,
      fuente: "RIOT",
      metricas: {
        partidasAnalizadas: 20,
        csPorMinuto: 7,
        danoPorMinuto: 650,
        visionPorMinuto: 1.1,
        participacionKills: 0.6,
        oroPorMinuto: 400,
        distribucionRoles: { MID: 20 },
        rangoSoloDuo: { liga: "DIAMOND", division: "II", puntosLiga: 10, victorias: 60, derrotas: 50 },
      },
      capturadaEn: haceDias(2),
    },
  });
}

const compatibles = (token: string, query: Record<string, string | number> = {}) =>
  conToken(token).get(RUTA).query({ departamento: AQUI, ...query });

beforeAll(async () => {
  await limpiarUsuariosDePrueba();
  tokenEquipo = await registrar("compat-equipo", "EQUIPO");
  tokenScout = await registrar("compat-scout", "SCOUT");
  tokenJugador = await registrar("compat-jugador", "JUGADOR");
  tokenSinCuenta = await registrar("compat-sin-cuenta", "JUGADOR");
  await verificar(await perfilDe("compat-jugador"));
  await perfilDe("compat-sin-cuenta");

  const ubicacion = { modalidad: "PRESENCIAL", pais: "CO", departamento: AQUI, horasSemana: 15 };
  // La de soporte se publica después: a igualdad de puntaje iría primero.
  ofertaMid = (await crearOferta(tokenEquipo, { ...ubicacion, rol: "MID", rangoMinimo: "PLATA_I" })).id;
  ofertaSoporte = (await crearOferta(tokenEquipo, { ...ubicacion, rol: "SOPORTE", rangoMinimo: "PLATA_I" })).id;
  borrador = (await crearOferta(tokenEquipo, { ...ubicacion, estado: "BORRADOR" })).id;
  cerrada = (await crearOferta(tokenEquipo, ubicacion)).id;
  await prisma.oferta.update({ where: { id: cerrada }, data: { estado: "CERRADA", cerradaEn: new Date() } });
});

afterAll(async () => {
  await limpiarUsuariosDePrueba();
  await cerrarConexiones();
});

describe("GET /matching/jugador/me", () => {
  let cuerpo: OfertasCompatibles;

  beforeAll(async () => {
    const respuesta = await compatibles(tokenJugador);
    expect(respuesta.status).toBe(200);
    cuerpo = ofertasCompatiblesSchema.parse(respuesta.body);
  });

  it("cumple el contrato y sólo trae ofertas abiertas", () => {
    const ids = cuerpo.data.map((o) => o.oferta.id);
    expect(ids).toEqual([ofertaMid, ofertaSoporte]);
    expect(ids).not.toContain(borrador);
    expect(ids).not.toContain(cerrada);
    expect(cuerpo.verificado).toBe(true);
    expect(cuerpo).toMatchObject({ modo: "CONTENIDO", pesoColaborativo: 0 });
    expect(cuerpo.meta).toMatchObject({ page: 1, total: 2 });
  });

  it("ordena por compatibilidad: la oferta de su posición por encima de la otra, aunque sea más antigua", () => {
    const [mid, soporte] = cuerpo.data;
    expect(mid!.puntaje).toBeGreaterThan(soporte!.puntaje);
    expect(mid!.desglose.tecnica).toBeGreaterThan(soporte!.desglose.tecnica);
  });

  it("el desglose ponderado por los pesos aplicados suma el puntaje", () => {
    for (const { puntaje, desglose, explicacion } of cuerpo.data) {
      const suma = DIMENSIONES_MATCHING.reduce((s, d) => s + explicacion.pesos[d] * desglose[d], 0);
      expect(suma).toBeCloseTo(puntaje, 10);
    }
  });

  it("da el mismo puntaje y el mismo desglose que el ranking de la oferta", async () => {
    // Postulado, entra seguro en el ranking aunque el índice no lo traiga.
    await postular(tokenJugador, ofertaMid);
    const jugadorId = (await prisma.perfilJugador.findFirstOrThrow({
      where: { usuario: { email: { startsWith: `${PREFIJO_PRUEBA}+compat-jugador-` } } },
    })).id;
    const ranking = rankingOfertaSchema.parse(
      (await conToken(tokenEquipo).get(`${API_PREFIX}/matching/ofertas/${ofertaMid}/ranking`).query({ soloPostulados: "true" })).body,
    );
    const enRanking = ranking.data.find((c) => c.jugador.id === jugadorId)!;
    const propia = cuerpo.data.find((o) => o.oferta.id === ofertaMid)!;
    expect(propia.puntaje).toBeCloseTo(enRanking.puntaje, 12);
    for (const d of DIMENSIONES_MATCHING) expect(propia.desglose[d]).toBeCloseTo(enRanking.desglose[d], 12);
    expect(propia.explicacion.pesos).toEqual(enRanking.explicacion.pesos);
  });

  it("admite los filtros de GET /ofertas", async () => {
    const soloSoporte = ofertasCompatiblesSchema.parse((await compatibles(tokenJugador, { rol: "SOPORTE" })).body);
    expect(soloSoporte.data.map((o) => o.oferta.id)).toEqual([ofertaSoporte]);
    const remotas = ofertasCompatiblesSchema.parse((await compatibles(tokenJugador, { modalidad: "REMOTA" })).body);
    expect(remotas.data).toHaveLength(0);
  });

  it("pagina sin cambiar el orden", async () => {
    const segunda = ofertasCompatiblesSchema.parse((await compatibles(tokenJugador, { pageSize: 1, page: 2 })).body);
    expect(segunda.data.map((o) => o.oferta.id)).toEqual([ofertaSoporte]);
    expect(segunda.meta).toMatchObject({ page: 2, pageSize: 1, total: 2, totalPages: 2 });
  });

  it("sin cuenta verificada, la técnica vale 0 en todas con «faltan datos» y verificado es false", async () => {
    const sinCuenta = ofertasCompatiblesSchema.parse((await compatibles(tokenSinCuenta)).body);
    expect(sinCuenta.verificado).toBe(false);
    expect(sinCuenta.data).toHaveLength(2);
    for (const o of sinCuenta.data) {
      expect(o.desglose.tecnica).toBe(0);
      expect(o.explicacion.dimensiones.tecnica.faltanDatos).toBe(true);
    }
  });

  it("una query inválida responde 422", async () => {
    const respuesta = await compatibles(tokenJugador, { rol: "CAPITAN" });
    expect(respuesta.status).toBe(422);
  });
});

describe("permisos de GET /matching/jugador/me (RNF-04)", () => {
  it("sin sesión responde 401", async () => {
    expect((await request(app).get(RUTA)).status).toBe(401);
  });

  it("el equipo y el scout reciben 403", async () => {
    expect((await conToken(tokenEquipo).get(RUTA)).status).toBe(403);
    expect((await conToken(tokenScout).get(RUTA)).status).toBe(403);
  });
});
