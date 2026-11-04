import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import rateLimit from "express-rate-limit";
import request from "supertest";
import {
  API_PREFIX,
  CAMPOS_JUGADOR_ENCONTRADO,
  JUEGO_PILOTO,
  type Departamento,
  type PosicionLol,
  type RangoLol,
  type RolRegistrable,
} from "@proplay/shared";
import { prisma } from "../src/config/prisma";
import { opcionesLimiteBusqueda } from "../src/middleware/rateLimit";
import * as repositorio from "../src/modules/scouting/scouting.repository";
import {
  CONSENTIMIENTO,
  app,
  cerrarConexiones,
  emailDePrueba,
  limpiarUsuariosDePrueba,
} from "./utils/entorno";

/**
 * RF-08 · Buscador de talento: GET /scouting/jugadores con filtros de
 * posición, rango mínimo y departamento, orden estable, paginación, permisos
 * por rol, límite de peticiones y la lista blanca de la respuesta.
 *
 * Los jugadores de prueba viven en Guainía, un departamento que el seed no
 * usa, y todas las búsquedas filtran por él: así la base puede tener datos de
 * demostración sin cambiar los resultados.
 */
const RUTA = `${API_PREFIX}/scouting/jugadores`;
const AQUI: Departamento = "GUAINIA";

interface Captura {
  posicion: PosicionLol;
  rango: RangoLol | null;
  haceDias: number;
  juego?: string;
}

async function registrar(etiqueta: string, rol: RolRegistrable) {
  const respuesta = await request(app)
    .post(`${API_PREFIX}/auth/register`)
    .send({
      email: emailDePrueba(etiqueta),
      password: "ProPlay123",
      nombre: `Jugador ${etiqueta}`,
      rol,
      ...CONSENTIMIENTO,
    });
  expect(respuesta.status).toBe(201);
  return { token: respuesta.body.accessToken as string, usuarioId: respuesta.body.usuario.id as string };
}

const haceDias = (dias: number) => new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

/** Crea un jugador en Guainía con cuenta de Riot verificada (o no) y sus capturas. */
async function jugador(
  etiqueta: string,
  { verificada = true, capturas = [] as Captura[], activo = true } = {},
): Promise<string> {
  const { usuarioId } = await registrar(etiqueta, "JUGADOR");
  const perfil = await prisma.perfilJugador.update({
    where: { usuarioId },
    data: { pais: "CO", departamento: AQUI, disponibilidadHoras: 20, dispuestoRelocalizar: true },
  });
  if (!activo) await prisma.usuario.update({ where: { id: usuarioId }, data: { activo: false } });
  if (verificada) {
    await prisma.cuentaGaming.create({
      data: {
        jugadorId: perfil.id,
        plataforma: "RIOT",
        externalId: `test-puuid-${perfil.id}`,
        verificadaEn: haceDias(40),
      },
    });
  }
  for (const captura of capturas) {
    await prisma.estadistica.create({
      data: {
        jugadorId: perfil.id,
        juego: captura.juego ?? JUEGO_PILOTO,
        rol: captura.posicion,
        rango: captura.rango,
        fuente: "RIOT",
        capturadaEn: haceDias(captura.haceDias),
      },
    });
  }
  return perfil.id;
}

let tokenScout: string;
let tokenEquipo: string;
let tokenJugador: string;
const ids: Record<string, string> = {};

function buscar(query: Record<string, string | number> = {}, token = tokenScout) {
  return request(app)
    .get(RUTA)
    .query({ departamento: AQUI, pageSize: 100, ...query })
    .set("Authorization", `Bearer ${token}`);
}

const idsDe = (cuerpo: { data: { id: string }[] }) => cuerpo.data.map((j) => j.id);

beforeAll(async () => {
  await limpiarUsuariosDePrueba();
  tokenScout = (await registrar("busqueda-scout", "SCOUT")).token;
  tokenEquipo = (await registrar("busqueda-equipo", "EQUIPO")).token;
  tokenJugador = (await registrar("busqueda-jugador", "JUGADOR")).token;

  ids.midDiamante = await jugador("mid-diamante", {
    capturas: [
      // La anterior era de otra posición y rango: debe contar la última.
      { posicion: "TOP", rango: "PLATINO_I", haceDias: 30 },
      { posicion: "MID", rango: "DIAMANTE_II", haceDias: 2 },
    ],
  });
  ids.midOro = await jugador("mid-oro", { capturas: [{ posicion: "MID", rango: "ORO_II", haceDias: 3 }] });
  ids.soporteMaestro = await jugador("soporte-maestro", {
    capturas: [{ posicion: "SOPORTE", rango: "MAESTRO", haceDias: 5 }],
  });
  ids.adcSinRango = await jugador("adc-sin-rango", {
    capturas: [{ posicion: "ADC", rango: null, haceDias: 1 }],
  });
  ids.verificadoSinCapturas = await jugador("verificado-sin-capturas");
  // Estadísticas sin cuenta verificada: no cuentan como datos de juego.
  ids.sinCuenta = await jugador("sin-cuenta", {
    verificada: false,
    capturas: [{ posicion: "MID", rango: "RETADOR", haceDias: 1 }],
  });
  ids.sinNada = await jugador("sin-nada", { verificada: false });
  // Sólo capturas de otro juego: no hay posición ni rango de LoL.
  ids.otroJuego = await jugador("otro-juego", {
    capturas: [{ posicion: "MID", rango: "RETADOR", haceDias: 1, juego: "VALORANT" }],
  });
  ids.desactivado = await jugador("desactivado", {
    activo: false,
    capturas: [{ posicion: "MID", rango: "RETADOR", haceDias: 1 }],
  });
});

afterAll(async () => {
  await limpiarUsuariosDePrueba();
  await cerrarConexiones();
});

describe(`GET ${RUTA}`, () => {
  describe("permisos", () => {
    it("exige sesión", async () => {
      expect((await request(app).get(RUTA)).status).toBe(401);
    });

    it("responde 403 al jugador", async () => {
      const respuesta = await buscar({}, tokenJugador);
      expect(respuesta.status).toBe(403);
    });

    it("el equipo y el scout buscan", async () => {
      expect((await buscar({}, tokenEquipo)).status).toBe(200);
      expect((await buscar({}, tokenScout)).status).toBe(200);
    });
  });

  describe("sin filtros de juego", () => {
    it("incluye a los jugadores sin datos verificados, sin posición ni rango, y excluye a los desactivados", async () => {
      const respuesta = await buscar();
      expect(respuesta.status).toBe(200);
      const porId = Object.fromEntries(respuesta.body.data.map((j: { id: string }) => [j.id, j]));

      expect(porId[ids.sinNada!]).toMatchObject({ verificacion: null, posicion: null, rango: null, datosDel: null });
      // Las estadísticas de alguien sin cuenta verificada no se muestran.
      expect(porId[ids.sinCuenta!]).toMatchObject({ verificacion: null, posicion: null, rango: null });
      expect(porId[ids.otroJuego!]).toMatchObject({ posicion: null, rango: null });
      expect(porId[ids.otroJuego!].verificacion).toMatchObject({ plataforma: "RIOT" });
      expect(porId[ids.desactivado!]).toBeUndefined();
      expect(respuesta.body.meta.total).toBe(8);
    });

    it("lee la última captura del jugador", async () => {
      const respuesta = await buscar();
      const mid = respuesta.body.data.find((j: { id: string }) => j.id === ids.midDiamante);
      expect(mid).toMatchObject({ posicion: "MID", rango: "DIAMANTE_II" });
    });

    it("ordena: verificados primero, rango de mayor a menor y después el dato más reciente", async () => {
      const orden = idsDe((await buscar()).body);
      // Con rango: Maestro > Diamante II > Oro II.
      expect(orden.slice(0, 3)).toEqual([ids.soporteMaestro, ids.midDiamante, ids.midOro]);
      // Verificados sin rango, del dato más reciente al más antiguo: sin captura
      // cuenta la última edición del perfil (creados ahora, después de la
      // captura de hace un día del ADC).
      expect(orden.slice(3, 6)).toEqual([ids.otroJuego, ids.verificadoSinCapturas, ids.adcSinRango]);
      // Al final, los no verificados.
      expect(new Set(orden.slice(6))).toEqual(new Set([ids.sinCuenta, ids.sinNada]));
    });

    it("cada resultado lleva exactamente las claves de la lista blanca", async () => {
      const respuesta = await buscar();
      for (const resultado of respuesta.body.data) {
        expect(Object.keys(resultado).sort()).toEqual([...CAMPOS_JUGADOR_ENCONTRADO].sort());
      }
      const texto = JSON.stringify(respuesta.body);
      expect(texto).not.toContain("test-puuid");
      expect(texto).not.toContain("@proplay.test");
    });
  });

  describe("filtros", () => {
    it("por posición deja fuera a quien no tiene datos verificados", async () => {
      const respuesta = await buscar({ posicion: "MID" });
      expect(new Set(idsDe(respuesta.body))).toEqual(new Set([ids.midDiamante, ids.midOro]));
    });

    it("la posición es la de la última captura, no la de una anterior", async () => {
      expect(idsDe((await buscar({ posicion: "TOP" })).body)).toEqual([]);
    });

    it("por rango mínimo incluye el propio rango y los superiores, también sin división", async () => {
      expect(idsDe((await buscar({ rangoMinimo: "DIAMANTE_II" })).body)).toEqual([
        ids.soporteMaestro,
        ids.midDiamante,
      ]);
      expect(idsDe((await buscar({ rangoMinimo: "DIAMANTE_I" })).body)).toEqual([ids.soporteMaestro]);
      expect(idsDe((await buscar({ rangoMinimo: "HIERRO_IV" })).body)).toEqual([
        ids.soporteMaestro,
        ids.midDiamante,
        ids.midOro,
      ]);
    });

    it("combina posición y rango mínimo", async () => {
      expect(idsDe((await buscar({ posicion: "MID", rangoMinimo: "PLATINO_IV" })).body)).toEqual([
        ids.midDiamante,
      ]);
    });

    it("por departamento filtra a todos, verificados o no", async () => {
      const otro = await buscar({ departamento: "VICHADA" });
      expect(otro.status).toBe(200);
      expect(idsDe(otro.body)).not.toContain(ids.sinNada);
      expect(idsDe(otro.body)).not.toContain(ids.midDiamante);
    });

    it.each([
      ["una posición de otro juego", { posicion: "AWPER" }],
      ["un rango escrito a mano", { rangoMinimo: "Diamante II" }],
      ["un rango con SQL", { rangoMinimo: "ORO_II' OR '1'='1" }],
      ["un departamento con SQL", { departamento: `${AQUI}'; DROP TABLE "Usuario"; --` }],
    ])("rechaza %s con 422", async (_caso, query) => {
      const respuesta = await buscar(query);
      expect(respuesta.status).toBe(422);
      expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("paginación", () => {
    it("pagina sin repetir ni saltar jugadores y con el orden estable", async () => {
      const completa = idsDe((await buscar()).body);
      const paginas: string[] = [];
      for (let page = 1; page <= 4; page++) {
        const respuesta = await buscar({ pageSize: 3, page });
        expect(respuesta.body.meta).toMatchObject({ page, pageSize: 3, total: 8, totalPages: 3 });
        paginas.push(...idsDe(respuesta.body));
      }
      expect(paginas).toEqual(completa);
      // La misma consulta dos veces, el mismo orden.
      expect(idsDe((await buscar()).body)).toEqual(completa);
    });
  });
});

describe("la consulta del buscador está parametrizada", () => {
  it("un valor malicioso que esquiva la validación llega como parámetro y no ejecuta nada", async () => {
    const usuariosAntes = await prisma.usuario.count();
    const malicioso = `MID' OR '1'='1`;
    const [filas, total] = await repositorio.buscarJugadores(
      { posicion: malicioso as PosicionLol, departamento: AQUI },
      { skip: 0, take: 100, page: 1, pageSize: 100 },
    );
    // Se compara como texto literal: ninguna posición se llama así.
    expect(filas).toEqual([]);
    expect(total).toBe(0);

    const destructivo = `${AQUI}'; DROP TABLE "Usuario"; --` as Departamento;
    // Como parámetro de tipo enum, Postgres lo rechaza por valor inválido.
    await expect(
      repositorio.buscarJugadores({ departamento: destructivo }, { skip: 0, take: 10, page: 1, pageSize: 10 }),
    ).rejects.toThrow();
    expect(await prisma.usuario.count()).toBe(usuariosAntes);
  });
});

describe("límite de peticiones del buscador", () => {
  const appLimitada = express();
  appLimitada.use((req, _res, next) => {
    const usuario = req.header("x-usuario");
    if (usuario) req.usuario = { id: usuario, email: `${usuario}@proplay.test`, rol: "SCOUT" };
    next();
  });
  appLimitada.get("/", rateLimit(opcionesLimiteBusqueda), (_req, res) => {
    res.sendStatus(204);
  });

  it("admite 120 búsquedas cada 15 minutos por usuario y después responde 429", async () => {
    for (let consulta = 0; consulta < 120; consulta++) {
      expect((await request(appLimitada).get("/").set("x-usuario", "scout-a")).status).toBe(204);
    }
    const siguiente = await request(appLimitada).get("/").set("x-usuario", "scout-a");
    expect(siguiente.status).toBe(429);
    expect(siguiente.body.error.code).toBe("TOO_MANY_REQUESTS");
  });

  it("cuenta por usuario: otro scout tiene su propio cupo", async () => {
    expect((await request(appLimitada).get("/").set("x-usuario", "scout-b")).status).toBe(204);
  });
});
