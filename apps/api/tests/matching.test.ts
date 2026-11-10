import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import rateLimit from "express-rate-limit";
import request from "supertest";
import {
  API_PREFIX,
  DIMENSIONES_MATCHING,
  JUEGO_PILOTO,
  PERFIL_VECTOR_VERSION,
  VERSION_FORMULAS_MATCHING,
  rankingOfertaSchema,
  type CandidatoRanking,
  type Departamento,
  type PosicionLol,
  type RangoLol,
  type RankingOferta,
} from "@proplay/shared";
import { prisma } from "../src/config/prisma";
import {
  opcionesLimiteRanking,
  opcionesLimiteRecalculoRanking,
} from "../src/middleware/rateLimit";
import * as repositorio from "../src/modules/matching/matching.repository";
import { CANDIDATOS_RECUPERADOR } from "../src/modules/matching/matching.service";
import { vectorizarOferta } from "../src/modules/matching/motor/vectorizador";
import { PREFIJO_PRUEBA, cerrarConexiones, emailDePrueba, limpiarUsuariosDePrueba } from "./utils/entorno";
import { conToken, crearOferta, registrar } from "./utils/ofertas";

/**
 * RF-09 · RNF-01 · Ranking de candidatos: GET /matching/ofertas/:id/ranking y
 * POST …/recalcular. Permisos de los cuatro roles, persistencia en `Matching`
 * con la explicación, orden estable, paginación, recálculo al cambiar los
 * datos y el recuperador HNSW con más de 40 candidatos (`hnsw.ef_search`).
 *
 * La base puede tener datos de demostración: el ranking es de toda la base,
 * así que las pruebas comprueban a sus propios jugadores (en Vichada, que el
 * seed no usa) y propiedades que valen para cualquier fila.
 */
const RUTA = `${API_PREFIX}/matching/ofertas`;
const AQUI: Departamento = "VICHADA";
const haceDias = (dias: number) => new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

interface DatosJugador {
  verificado?: boolean;
  posicion?: PosicionLol;
  rango?: RangoLol | null;
  winRate?: number;
  departamento?: Departamento | null;
  pais?: string | null;
  horas?: number | null;
}

/** Jugador creado directamente en la base (rápido: sin bcrypt), con su captura si está verificado. */
async function jugador(etiqueta: string, datos: DatosJugador = {}): Promise<string> {
  const {
    verificado = true,
    posicion = "MID",
    rango = "DIAMANTE_II",
    winRate = 0.55,
    departamento = AQUI,
    pais = "CO",
    horas = 25,
  } = datos;
  const usuario = await prisma.usuario.create({
    data: {
      email: emailDePrueba(etiqueta),
      passwordHash: "sin-acceso",
      nombre: `Candidato ${etiqueta}`,
      rol: "JUGADOR",
      perfilJugador: {
        create: {
          pais,
          departamento: pais === "CO" ? departamento : null,
          disponibilidadHoras: horas,
        },
      },
    },
    include: { perfilJugador: true },
  });
  const perfil = usuario.perfilJugador!;
  if (verificado) {
    const cuenta = await prisma.cuentaGaming.create({
      data: {
        jugadorId: perfil.id,
        plataforma: "RIOT",
        externalId: `test-puuid-${perfil.id}`,
        verificadaEn: haceDias(30),
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
          visionPorMinuto: 1.1,
          participacionKills: 0.6,
          oroPorMinuto: 400,
          distribucionRoles: { [posicion]: 20 },
          rangoSoloDuo: { liga: "DIAMOND", division: "II", puntosLiga: 10, victorias: 60, derrotas: 50 },
        },
        capturadaEn: haceDias(2),
      },
    });
  }
  return perfil.id;
}

let tokenEquipo: string;
let tokenOtroEquipo: string;
let tokenScout: string;
let tokenJugador: string;
let tokenAdmin: string;
let oferta: string;
let borrador: string;
const ids: Record<string, string> = {};

const ranking = (id: string, token: string, query: Record<string, number> = {}) =>
  conToken(token).get(`${RUTA}/${id}/ranking`).query(query);

const candidatoDe = (cuerpo: RankingOferta, id: string): CandidatoRanking | undefined =>
  cuerpo.data.find((c) => c.jugador.id === id);

beforeAll(async () => {
  await limpiarUsuariosDePrueba();
  tokenEquipo = await registrar("ranking-equipo", "EQUIPO");
  tokenOtroEquipo = await registrar("ranking-otro-equipo", "EQUIPO");
  tokenScout = await registrar("ranking-scout", "SCOUT");
  tokenJugador = await registrar("ranking-jugador", "JUGADOR");
  // El administrador no se registra: se promueve un scout (como el script de operación).
  tokenAdmin = await registrar("ranking-admin", "SCOUT");
  await prisma.usuario.updateMany({
    where: { email: { startsWith: `${PREFIJO_PRUEBA}+ranking-admin` } },
    data: { rol: "ADMIN" },
  });
  const login = await request((await import("./utils/entorno")).app)
    .post(`${API_PREFIX}/auth/login`)
    .send({
      email: (await prisma.usuario.findFirstOrThrow({ where: { email: { startsWith: `${PREFIJO_PRUEBA}+ranking-admin` } } })).email,
      password: "ProPlay123",
    });
  tokenAdmin = login.body.accessToken as string;

  ids.fuerte = await jugador("fuerte", { rango: "DIAMANTE_I", winRate: 0.6 });
  ids.debil = await jugador("debil", { posicion: "SOPORTE", rango: "BRONCE_I", winRate: 0.42, pais: "MX", departamento: null });
  ids.sinUbicacion = await jugador("sin-ubicacion", { pais: null, departamento: null });
  ids.sinCuenta = await jugador("sin-cuenta", { verificado: false });

  oferta = (await crearOferta(tokenEquipo, { departamento: AQUI, rangoMinimo: "DIAMANTE_II", horasSemana: 20 })).id;
  borrador = (await crearOferta(tokenEquipo, { estado: "BORRADOR" })).id;

  // El jugador sin cuenta se postula: tiene que aparecer aunque el índice no lo traiga.
  const perfilJugadorSinCuenta = await prisma.perfilJugador.findUniqueOrThrow({ where: { id: ids.sinCuenta } });
  await prisma.postulacion.create({ data: { ofertaId: oferta, jugadorId: perfilJugadorSinCuenta.id } });
});

afterAll(async () => {
  await limpiarUsuariosDePrueba();
  await cerrarConexiones();
});

describe("GET /matching/ofertas/:id/ranking", () => {
  let cuerpo: RankingOferta;

  beforeAll(async () => {
    const respuesta = await ranking(oferta, tokenEquipo, { pageSize: 100 });
    expect(respuesta.status).toBe(200);
    cuerpo = rankingOfertaSchema.parse(respuesta.body);
  });

  it("cumple el contrato y trae la oferta con sus pesos, la versión y el modo de arranque en frío", () => {
    expect(cuerpo.oferta).toMatchObject({ id: oferta, rol: "MID", estado: "ABIERTA" });
    expect(cuerpo.versionFormulas).toBe(VERSION_FORMULAS_MATCHING);
    expect(cuerpo).toMatchObject({ modo: "CONTENIDO", pesoColaborativo: 0 });
  });

  it("ordena por puntaje (a igualdad, técnica e id) con puestos consecutivos", () => {
    cuerpo.data.forEach((c, i) => expect(c.puesto).toBe(i + 1));
    for (let i = 1; i < cuerpo.data.length; i++) {
      const [a, b] = [cuerpo.data[i - 1]!, cuerpo.data[i]!];
      const enOrden =
        a.puntaje > b.puntaje ||
        (a.puntaje === b.puntaje &&
          (a.desglose.tecnica > b.desglose.tecnica ||
            (a.desglose.tecnica === b.desglose.tecnica && a.jugador.id < b.jugador.id)));
      expect(enOrden).toBe(true);
    }
  });

  it("en cada candidato, el desglose ponderado por los pesos de la oferta suma el puntaje", () => {
    for (const c of cuerpo.data) {
      const suma = DIMENSIONES_MATCHING.reduce((s, d) => s + c.desglose[d] * cuerpo.oferta.pesos[d], 0);
      expect(c.puntaje).toBeCloseTo(suma, 10);
    }
  });

  it("el jugador que cumple todo queda por encima del que no", () => {
    const fuerte = candidatoDe(cuerpo, ids.fuerte!)!;
    const debil = candidatoDe(cuerpo, ids.debil!)!;
    expect(fuerte.puesto).toBeLessThan(debil.puesto);
    expect(fuerte.desglose.geografica).toBe(1);
    expect(debil.explicacion.dimensiones.geografica.cercania).toBe("OTRO_PAIS");
  });

  it("el postulante sin cuenta verificada entra con la técnica en 0 y la marca «Sin cuenta verificada»", () => {
    const c = candidatoDe(cuerpo, ids.sinCuenta!)!;
    expect(c).toBeDefined();
    expect(c.jugador.verificacion).toBeNull();
    expect(c.desglose.tecnica).toBe(0);
    expect(c.explicacion.dimensiones.tecnica).toMatchObject({ faltanDatos: true, motivo: "SIN_CUENTA_VERIFICADA" });
    expect(c.postulacion).toMatchObject({ estado: "ENVIADA" });
  });

  it("sin ubicación, la geográfica vale el neutro 0,5 con «faltan datos»", () => {
    const c = candidatoDe(cuerpo, ids.sinUbicacion!)!;
    expect(c.desglose.geografica).toBe(0.5);
    expect(c.explicacion.dimensiones.geografica).toMatchObject({ faltanDatos: true, motivo: "SIN_UBICACION" });
  });

  it("experiencia y habilidades blandas se calculan y valen 0 con sus motivos", () => {
    const c = candidatoDe(cuerpo, ids.fuerte!)!;
    expect(c.desglose.experiencia).toBe(0);
    expect(c.explicacion.dimensiones.experiencia.motivo).toBe("SIN_DATOS_PILOTO");
    expect(c.explicacion.dimensiones.habilidadesBlandas.motivo).toBe("SIN_ENDORSEMENTS");
  });

  it("guarda el ranking en Matching con la explicación, la versión y los vectores v2", async () => {
    const filas = await prisma.matching.findMany({ where: { ofertaId: oferta } });
    expect(filas.length).toBeGreaterThanOrEqual(cuerpo.data.length);
    expect(filas.every((f) => f.versionFormulas === VERSION_FORMULAS_MATCHING)).toBe(true);
    const fuerte = filas.find((f) => f.jugadorId === ids.fuerte)!;
    expect(fuerte.explicacion).toMatchObject({ dimensiones: { tecnica: { posicionPedida: "MID" } } });
    const vector = await prisma.perfilVector.findUniqueOrThrow({ where: { jugadorId: ids.fuerte! } });
    expect(vector.version).toBe(PERFIL_VECTOR_VERSION);
    expect(vector.dimensiones).toHaveLength(64);
  });

  it("pagina sin cambiar el orden", async () => {
    const pagina2 = rankingOfertaSchema.parse((await ranking(oferta, tokenEquipo, { page: 2, pageSize: 2 })).body);
    expect(pagina2.data.map((c) => c.puesto)).toEqual([3, 4]);
    expect(pagina2.data.map((c) => c.jugador.id)).toEqual(cuerpo.data.slice(2, 4).map((c) => c.jugador.id));
    expect(pagina2.meta).toMatchObject({ page: 2, pageSize: 2, total: cuerpo.meta.total });
  });

  it("leer otra vez sin cambios no recalcula", async () => {
    const otra = rankingOfertaSchema.parse((await ranking(oferta, tokenEquipo)).body);
    expect(otra.calculadoEn.getTime()).toBe(cuerpo.calculadoEn.getTime());
  });

  it("una captura nueva deja obsoletos el vector y el ranking: se recalculan al leerlo", async () => {
    const cuenta = await prisma.cuentaGaming.findFirstOrThrow({ where: { jugadorId: ids.debil! } });
    await prisma.estadistica.create({
      data: {
        jugadorId: ids.debil!,
        cuentaId: cuenta.id,
        juego: JUEGO_PILOTO,
        rol: "MID",
        rango: "RETADOR",
        partidas: 20,
        winRate: 0.7,
        kda: 6,
        fuente: "RIOT",
        metricas: { partidasAnalizadas: 20, distribucionRoles: { MID: 20 } },
      },
    });
    const despues = rankingOfertaSchema.parse((await ranking(oferta, tokenEquipo, { pageSize: 100 })).body);
    expect(despues.calculadoEn.getTime()).toBeGreaterThan(cuerpo.calculadoEn.getTime());
    const debil = candidatoDe(despues, ids.debil!)!;
    expect(debil.jugador.rango).toBe("RETADOR");
    expect(debil.desglose.tecnica).toBeGreaterThan(candidatoDe(cuerpo, ids.debil!)!.desglose.tecnica);
  });
});

describe("permisos del ranking (RNF-04)", () => {
  it("sin sesión responde 401", async () => {
    expect((await request((await import("./utils/entorno")).app).get(`${RUTA}/${oferta}/ranking`)).status).toBe(401);
  });

  it("el jugador no ve rankings (403)", async () => {
    expect((await ranking(oferta, tokenJugador)).status).toBe(403);
  });

  it("otro equipo recibe 403 en la oferta publicada y 404 en el borrador", async () => {
    expect((await ranking(oferta, tokenOtroEquipo)).status).toBe(403);
    expect((await ranking(borrador, tokenOtroEquipo)).status).toBe(404);
  });

  it("el scout y el administrador ven la publicada, pero no el borrador ajeno", async () => {
    expect((await ranking(oferta, tokenScout)).status).toBe(200);
    expect((await ranking(oferta, tokenAdmin)).status).toBe(200);
    expect((await ranking(borrador, tokenScout)).status).toBe(404);
  });

  it("el equipo dueño ve el ranking de su borrador para probar los pesos", async () => {
    expect((await ranking(borrador, tokenEquipo)).status).toBe(200);
  });

  it("una oferta que no existe responde 404", async () => {
    expect((await ranking("no-existe", tokenScout)).status).toBe(404);
  });
});

describe("POST /matching/ofertas/:id/recalcular", () => {
  it("el equipo dueño y el scout recalculan; el administrador y el jugador no (403)", async () => {
    const antes = rankingOfertaSchema.parse((await ranking(oferta, tokenEquipo)).body).calculadoEn;
    const propia = await conToken(tokenEquipo).post(`${RUTA}/${oferta}/recalcular`);
    expect(propia.status).toBe(200);
    expect(rankingOfertaSchema.parse(propia.body).calculadoEn.getTime()).toBeGreaterThan(antes.getTime());
    expect((await conToken(tokenScout).post(`${RUTA}/${oferta}/recalcular`)).status).toBe(200);
    expect((await conToken(tokenAdmin).post(`${RUTA}/${oferta}/recalcular`)).status).toBe(403);
    expect((await conToken(tokenJugador).post(`${RUTA}/${oferta}/recalcular`)).status).toBe(403);
    expect((await conToken(tokenOtroEquipo).post(`${RUTA}/${oferta}/recalcular`)).status).toBe(403);
  });

  it("una oferta cerrada responde 409 OFERTA_FINALIZADA y sirve su última instantánea", async () => {
    const cerrada = (await crearOferta(tokenEquipo)).id;
    const antes = rankingOfertaSchema.parse((await ranking(cerrada, tokenEquipo)).body);
    expect((await conToken(tokenEquipo).patch(`${API_PREFIX}/ofertas/${cerrada}/estado`, { estado: "CERRADA" })).status).toBe(200);
    const respuesta = await conToken(tokenEquipo).post(`${RUTA}/${cerrada}/recalcular`);
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe("OFERTA_FINALIZADA");
    const despues = rankingOfertaSchema.parse((await ranking(cerrada, tokenEquipo)).body);
    expect(despues.calculadoEn.getTime()).toBe(antes.calculadoEn.getTime());
  });
});

describe("recuperador HNSW (RNF-01)", () => {
  beforeAll(async () => {
    for (let i = 0; i < 60; i++) {
      await jugador(`masa-${i}`, {
        posicion: (["TOP", "JUNGLA", "MID", "ADC", "SOPORTE"] as const)[i % 5],
        rango: (["ORO_II", "PLATINO_I", "DIAMANTE_IV", "ESMERALDA_III"] as const)[i % 4],
        winRate: 0.45 + (i % 10) / 100,
      });
    }
    // Vectores al día para todos antes de consultar el índice.
    await ranking(oferta, tokenEquipo);
  });

  it(`con SET LOCAL hnsw.ef_search = ${CANDIDATOS_RECUPERADOR} el índice devuelve más de 40 candidatos`, async () => {
    const vector = vectorizarOferta({
      ofertaId: oferta,
      rol: "MID",
      rangoMinimo: "DIAMANTE_II",
      modalidad: "PRESENCIAL",
      pais: "CO",
      departamento: AQUI,
      horasSemana: 20,
      pesos: { tecnica: 0.5, experiencia: 0, habilidadesBlandas: 0, geografica: 0.25, disponibilidad: 0.25 },
    });
    const conIndice = await repositorio.recuperarCandidatos(vector, CANDIDATOS_RECUPERADOR, PERFIL_VECTOR_VERSION, {
      soloIndice: true,
    });
    expect(conIndice.length).toBeGreaterThan(40);
    // Con el valor por defecto (40), el mismo recorrido por el índice no trae más.
    const porDefecto = await repositorio.recuperarCandidatos(vector, CANDIDATOS_RECUPERADOR, PERFIL_VECTOR_VERSION, {
      soloIndice: true,
      efSearch: 40,
    });
    expect(conIndice.length).toBeGreaterThanOrEqual(porDefecto.length);
    // SET LOCAL no se escapa de la transacción: la conexión vuelve al valor por defecto.
    const [fuera] = await prisma.$queryRaw<{ ef: string | null }[]>`SELECT current_setting('hnsw.ef_search', true) AS ef`;
    expect(fuera!.ef ?? "40").toBe("40");
    // Ordenados por similitud.
    for (let i = 1; i < conIndice.length; i++) {
      expect(conIndice[i - 1]!.similitud).toBeGreaterThanOrEqual(conIndice[i]!.similitud - 1e-9);
    }
  });

  it("el plan de la consulta usa el índice PerfilVector_embedding_hnsw_idx", async () => {
    const plan = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL enable_seqscan = off`;
      return tx.$queryRaw<{ "QUERY PLAN": string }[]>`
        EXPLAIN SELECT "jugadorId" FROM "PerfilVector"
         ORDER BY embedding <=> ${`[${new Array(64).fill(0.125).join(",")}]`}::vector LIMIT 200
      `;
    });
    expect(plan.map((f) => f["QUERY PLAN"]).join("\n")).toContain("PerfilVector_embedding_hnsw_idx");
  });

  it("el ranking de la oferta trae más de 40 candidatos", async () => {
    const cuerpo = rankingOfertaSchema.parse(
      (await conToken(tokenEquipo).post(`${RUTA}/${oferta}/recalcular?pageSize=100`)).body,
    );
    expect(cuerpo.meta.total).toBeGreaterThan(40);
  });
});

describe("límites de peticiones", () => {
  function appCon(opciones: Parameters<typeof rateLimit>[0]) {
    const app = express();
    app.set("trust proxy", false);
    app.use((req, _res, next) => {
      (req as unknown as { usuario: { id: string } }).usuario = { id: String(req.headers["x-usuario"]) };
      next();
    });
    app.get("/", rateLimit(opciones), (_req, res) => {
      res.sendStatus(204);
    });
    return app;
  }

  it("el ranking admite 60 consultas por minuto por usuario y después responde 429", async () => {
    const app = appCon(opcionesLimiteRanking);
    for (let i = 0; i < 60; i++) {
      expect((await request(app).get("/").set("x-usuario", "equipo-a")).status).toBe(204);
    }
    expect((await request(app).get("/").set("x-usuario", "equipo-a")).status).toBe(429);
    expect((await request(app).get("/").set("x-usuario", "equipo-b")).status).toBe(204);
  });

  it("el recálculo admite 10 cada 15 minutos por usuario", async () => {
    const app = appCon(opcionesLimiteRecalculoRanking);
    for (let i = 0; i < 10; i++) {
      expect((await request(app).get("/").set("x-usuario", "scout-a")).status).toBe(204);
    }
    expect((await request(app).get("/").set("x-usuario", "scout-a")).status).toBe(429);
  });
});
