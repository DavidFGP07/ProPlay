import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { API_PREFIX, cuentaGamingSchema, resumenEstadisticasSchema } from "@proplay/shared";
import express from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "../src/config/prisma";
import { opcionesLimiteVinculacionRiot } from "../src/middleware/rateLimit";
import * as repositorioPerfiles from "../src/modules/perfiles/perfiles.repository";
import {
  CONSENTIMIENTO,
  app,
  cerrarConexiones,
  emailDePrueba,
  limpiarUsuariosDePrueba,
} from "./utils/entorno";

/**
 * RF-02, RF-03, RF-04 · Cuentas vinculadas y estadísticas, en lo que no
 * necesita llamar a Riot: listado de cuentas, desvinculación, la guarda de
 * cuenta no vinculada al sincronizar, la de frecuencia y la consulta del
 * histórico con su tendencia. La normalización de Riot se prueba sin red en
 * riot-integracion.test.ts.
 */

async function registrar(etiqueta: string, rol: "JUGADOR" | "EQUIPO") {
  const registro = await request(app)
    .post(`${API_PREFIX}/auth/register`)
    .send({
      email: emailDePrueba(etiqueta),
      password: "ProPlay123",
      nombre: "Jugador Riot",
      rol,
      ...CONSENTIMIENTO,
    });
  expect(registro.status).toBe(201);
  const token = registro.body.accessToken as string;
  const me = await request(app)
    .get(`${API_PREFIX}/perfiles/me`)
    .set("Authorization", `Bearer ${token}`);
  return { token, perfilId: me.body.perfil?.id as string };
}

describe("cuentas vinculadas y estadísticas", () => {
  let jugador: Awaited<ReturnType<typeof registrar>>;
  let equipo: Awaited<ReturnType<typeof registrar>>;

  beforeAll(async () => {
    await limpiarUsuariosDePrueba();
    jugador = await registrar("riot-jugador", "JUGADOR");
    equipo = await registrar("riot-equipo", "EQUIPO");
  });

  afterAll(async () => {
    await limpiarUsuariosDePrueba();
    await cerrarConexiones();
  });

  it("sin cuenta vinculada, sincronizar responde 409 CUENTA_NO_VINCULADA", async () => {
    const respuesta = await request(app)
      .post(`${API_PREFIX}/estadisticas/sincronizar`)
      .set("Authorization", `Bearer ${jugador.token}`)
      .send({});
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe("CUENTA_NO_VINCULADA");
  });

  it("el equipo no puede sincronizar ni ver cuentas de jugador", async () => {
    const sincronizar = await request(app)
      .post(`${API_PREFIX}/estadisticas/sincronizar`)
      .set("Authorization", `Bearer ${equipo.token}`)
      .send({});
    expect(sincronizar.status).toBe(403);
    const cuentas = await request(app)
      .get(`${API_PREFIX}/perfiles/cuentas-gaming`)
      .set("Authorization", `Bearer ${equipo.token}`);
    expect(cuentas.status).toBe(403);
  });

  it("valida el Riot ID antes de llamar a Riot", async () => {
    const respuesta = await request(app)
      .post(`${API_PREFIX}/perfiles/cuentas-gaming/riot`)
      .set("Authorization", `Bearer ${jugador.token}`)
      .send({ gameName: "ab", tagLine: "LAN", servidor: "XX1" });
    expect(respuesta.status).toBe(422);
  });

  it("rechaza un desafío de verificación falsificado", async () => {
    const respuesta = await request(app)
      .post(`${API_PREFIX}/perfiles/cuentas-gaming/riot/verificar`)
      .set("Authorization", `Bearer ${jugador.token}`)
      .send({ tokenDesafio: "no-es-un-token" });
    expect(respuesta.status).toBe(400);
  });

  describe("con una cuenta de Riot verificada", () => {
    beforeAll(async () => {
      const cuenta = await prisma.cuentaGaming.create({
        data: {
          jugadorId: jugador.perfilId,
          plataforma: "RIOT",
          externalId: `puuid-${jugador.perfilId}`,
          handle: "Jugador#LAN",
          servidor: "LA1",
          verificadaEn: new Date("2026-11-01T12:00:00Z"),
          sincronizadaEn: new Date(),
          intentoSincronizacionEn: new Date(),
        },
      });
      await prisma.estadistica.createMany({
        data: [
          {
            jugadorId: jugador.perfilId,
            cuentaId: cuenta.id,
            juego: "League of Legends",
            rol: "MID",
            partidas: 20,
            victorias: 10,
            kda: 2.5,
            winRate: 0.5,
            metricas: { csPorMinuto: 6.5, ultimaPartidaId: "LA1_1" },
            fuente: "RIOT",
            capturadaEn: new Date("2026-11-01T12:00:00Z"),
          },
          {
            jugadorId: jugador.perfilId,
            cuentaId: cuenta.id,
            juego: "League of Legends",
            rol: "MID",
            partidas: 20,
            victorias: 12,
            kda: 3,
            winRate: 0.6,
            metricas: { csPorMinuto: 7, ultimaPartidaId: "LA1_2" },
            fuente: "RIOT",
            capturadaEn: new Date("2026-11-05T12:00:00Z"),
          },
        ],
      });
      expect(cuenta.id).toBeTruthy();
    });

    it("lista la cuenta sin el puuid ni los tokens", async () => {
      const respuesta = await request(app)
        .get(`${API_PREFIX}/perfiles/cuentas-gaming`)
        .set("Authorization", `Bearer ${jugador.token}`);
      expect(respuesta.status).toBe(200);
      expect(respuesta.body).toHaveLength(1);
      const cuenta = cuentaGamingSchema.strict().parse(respuesta.body[0]);
      expect(cuenta.handle).toBe("Jugador#LAN");
      expect(cuenta.servidor).toBe("LA1");
    });

    it("no deja sincronizar dos veces seguidas", async () => {
      const respuesta = await request(app)
        .post(`${API_PREFIX}/estadisticas/sincronizar`)
        .set("Authorization", `Bearer ${jugador.token}`)
        .send({});
      expect(respuesta.status).toBe(429);
      expect(respuesta.body.error.details.reintentarEnSegundos).toBeGreaterThan(0);
    });

    it("devuelve el histórico de la más reciente a la más antigua", async () => {
      const respuesta = await request(app)
        .get(`${API_PREFIX}/estadisticas/jugador/${jugador.perfilId}`)
        .set("Authorization", `Bearer ${equipo.token}`);
      expect(respuesta.status).toBe(200);
      expect(respuesta.body.map((e: { winRate: number }) => e.winRate)).toEqual([0.6, 0.5]);
    });

    it("filtra el histórico por fecha", async () => {
      const respuesta = await request(app)
        .get(`${API_PREFIX}/estadisticas/jugador/${jugador.perfilId}`)
        .query({ desde: "2026-11-03T00:00:00Z" })
        .set("Authorization", `Bearer ${equipo.token}`);
      expect(respuesta.status).toBe(200);
      expect(respuesta.body).toHaveLength(1);
    });

    it("resume la última captura con su tendencia", async () => {
      const respuesta = await request(app)
        .get(`${API_PREFIX}/estadisticas/jugador/${jugador.perfilId}/resumen`)
        .set("Authorization", `Bearer ${equipo.token}`);
      expect(respuesta.status).toBe(200);
      const resumen = resumenEstadisticasSchema.parse(respuesta.body);
      expect(resumen.juegos).toHaveLength(1);
      expect(resumen.juegos[0]?.tendencia).toEqual({ winRate: 0.1, kda: 0.5, csPorMinuto: 0.5 });
    });

    it("un jugador inexistente da 404", async () => {
      const respuesta = await request(app)
        .get(`${API_PREFIX}/estadisticas/jugador/no-existe/resumen`)
        .set("Authorization", `Bearer ${equipo.token}`);
      expect(respuesta.status).toBe(404);
    });

    it("desvincula la cuenta y borra las estadísticas que salieron de ella", async () => {
      const borrar = await request(app)
        .delete(`${API_PREFIX}/perfiles/cuentas-gaming/RIOT`)
        .set("Authorization", `Bearer ${jugador.token}`);
      expect(borrar.status).toBe(204);
      const otraVez = await request(app)
        .delete(`${API_PREFIX}/perfiles/cuentas-gaming/RIOT`)
        .set("Authorization", `Bearer ${jugador.token}`);
      expect(otraVez.status).toBe(404);
      expect(await prisma.estadistica.count({ where: { jugadorId: jugador.perfilId } })).toBe(0);
    });
  });

  describe("espera entre sincronizaciones", () => {
    it("una sincronización fallida también activa la espera de 10 minutos", async () => {
      const otro = await registrar("riot-fallida", "JUGADOR");
      await prisma.cuentaGaming.create({
        data: {
          jugadorId: otro.perfilId,
          plataforma: "RIOT",
          externalId: `puuid-${otro.perfilId}`,
          servidor: "LA1",
          verificadaEn: new Date(),
        },
      });
      // En las pruebas no hay clave de Riot: el primer intento falla sin red.
      const primero = await request(app)
        .post(`${API_PREFIX}/estadisticas/sincronizar`)
        .set("Authorization", `Bearer ${otro.token}`)
        .send({});
      expect(primero.status).toBeGreaterThanOrEqual(500);

      const segundo = await request(app)
        .post(`${API_PREFIX}/estadisticas/sincronizar`)
        .set("Authorization", `Bearer ${otro.token}`)
        .send({});
      expect(segundo.status).toBe(429);
      expect(segundo.body.error.details.reintentarEnSegundos).toBeGreaterThan(500);
    });
  });

  describe("cambiar de cuenta de Riot", () => {
    it("verificar otra cuenta borra las capturas de la anterior; volver a verificar la misma las conserva", async () => {
      const otro = await registrar("riot-cambio", "JUGADOR");
      const base = { jugadorId: otro.perfilId, plataforma: "RIOT" as const, servidor: "LA1" };
      const primera = await repositorioPerfiles.guardarCuentaVerificada({
        ...base,
        externalId: `puuid-a-${otro.perfilId}`,
        handle: "A#LAN",
        verificadaEn: new Date(),
      });
      await prisma.estadistica.create({
        data: { jugadorId: otro.perfilId, cuentaId: primera.id, juego: "League of Legends", rol: "MID", fuente: "RIOT" },
      });

      await repositorioPerfiles.guardarCuentaVerificada({
        ...base,
        externalId: `puuid-a-${otro.perfilId}`,
        handle: "A#LAN",
        verificadaEn: new Date(),
      });
      expect(await prisma.estadistica.count({ where: { jugadorId: otro.perfilId } })).toBe(1);

      await repositorioPerfiles.guardarCuentaVerificada({
        ...base,
        externalId: `puuid-b-${otro.perfilId}`,
        handle: "B#LAN",
        verificadaEn: new Date(),
      });
      expect(await prisma.estadistica.count({ where: { jugadorId: otro.perfilId } })).toBe(0);
    });
  });
});

describe("límite de la vinculación con Riot", () => {
  const appLimitada = express();
  appLimitada.use((req, _res, next) => {
    const usuario = req.header("x-usuario");
    if (usuario) req.usuario = { id: usuario, email: `${usuario}@proplay.test`, rol: "JUGADOR" };
    next();
  });
  const limite = rateLimit(opcionesLimiteVinculacionRiot);
  // Pedir el desafío y «generar otro icono» comparten la misma instancia, como
  // en perfiles.routes.ts; verificar no pasa por este límite.
  appLimitada.post("/riot", limite, (_req, res) => res.sendStatus(204));
  appLimitada.post("/riot/desafio/regenerar", limite, (_req, res) => res.sendStatus(204));

  it("admite 10 intentos cada 15 minutos por usuario sumando pedir y regenerar el desafío", async () => {
    for (let i = 0; i < 5; i++) {
      expect((await request(appLimitada).post("/riot").set("x-usuario", "j1")).status).toBe(204);
      expect(
        (await request(appLimitada).post("/riot/desafio/regenerar").set("x-usuario", "j1")).status,
      ).toBe(204);
    }
    const siguiente = await request(appLimitada).post("/riot/desafio/regenerar").set("x-usuario", "j1");
    expect(siguiente.status).toBe(429);
    expect((await request(appLimitada).post("/riot").set("x-usuario", "j2")).status).toBe(204);
  });
});
