import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { API_PREFIX, cuentaGamingSchema, resumenEstadisticasSchema } from "@proplay/shared";
import { prisma } from "../src/config/prisma";
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
        },
      });
      await prisma.estadistica.createMany({
        data: [
          {
            jugadorId: jugador.perfilId,
            juego: "League of Legends",
            rol: "MIDDLE",
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
            juego: "League of Legends",
            rol: "MIDDLE",
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

    it("desvincula la cuenta y conserva las estadísticas", async () => {
      const borrar = await request(app)
        .delete(`${API_PREFIX}/perfiles/cuentas-gaming/RIOT`)
        .set("Authorization", `Bearer ${jugador.token}`);
      expect(borrar.status).toBe(204);
      const otraVez = await request(app)
        .delete(`${API_PREFIX}/perfiles/cuentas-gaming/RIOT`)
        .set("Authorization", `Bearer ${jugador.token}`);
      expect(otraVez.status).toBe(404);
      expect(await prisma.estadistica.count({ where: { jugadorId: jugador.perfilId } })).toBe(2);
    });
  });
});
