import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import rateLimit from "express-rate-limit";
import request from "supertest";
import {
  API_PREFIX,
  CAMPOS_PERFIL_JUGADOR_PUBLICO,
  perfilJugadorPublicoSchema,
  type RolRegistrable,
} from "@proplay/shared";
import { prisma } from "../src/config/prisma";
import { opcionesLimitePerfilPublico } from "../src/middleware/rateLimit";
import {
  CONSENTIMIENTO,
  app,
  cerrarConexiones,
  emailDePrueba,
  limpiarUsuariosDePrueba,
} from "./utils/entorno";

/**
 * RF-05 · Perfil público del jugador: GET /perfiles/:id sin sesión, con la
 * lista blanca de campos y sólo las cuentas verificadas.
 */
const RUTA = `${API_PREFIX}/perfiles`;

async function registrar(etiqueta: string, rol: RolRegistrable) {
  const registro = await request(app)
    .post(`${API_PREFIX}/auth/register`)
    .send({
      email: emailDePrueba(etiqueta),
      password: "ProPlay123",
      nombre: "Jugadora Pública",
      rol,
      ...CONSENTIMIENTO,
    });
  expect(registro.status).toBe(201);
  const token = registro.body.accessToken as string;
  const me = await request(app).get(`${RUTA}/me`).set("Authorization", `Bearer ${token}`);
  return {
    token,
    usuarioId: registro.body.usuario.id as string,
    perfilId: me.body.perfil.id as string,
  };
}

describe(`GET ${RUTA}/:id`, () => {
  let jugador: Awaited<ReturnType<typeof registrar>>;

  beforeAll(async () => {
    await limpiarUsuariosDePrueba();
    jugador = await registrar("publico", "JUGADOR");
    await request(app)
      .patch(`${RUTA}/jugador`)
      .set("Authorization", `Bearer ${jugador.token}`)
      .send({
        bio: "Support de LoL",
        pais: "CO",
        departamento: "ATLANTICO",
        disponibilidadHoras: 20,
        dispuestoRelocalizar: true,
      });
    await prisma.cuentaGaming.createMany({
      data: [
        {
          jugadorId: jugador.perfilId,
          plataforma: "RIOT",
          externalId: `puuid-${jugador.perfilId}`,
          handle: "Jugadora#LAN",
          accessToken: "cifrado-de-prueba",
          verificadaEn: new Date("2026-10-01T12:00:00Z"),
        },
        {
          jugadorId: jugador.perfilId,
          plataforma: "TWITCH",
          externalId: `twitch-${jugador.perfilId}`,
        },
      ],
    });
  });

  afterAll(async () => {
    await limpiarUsuariosDePrueba();
    await cerrarConexiones();
  });

  it("responde sin sesión con exactamente los campos de la lista blanca", async () => {
    const respuesta = await request(app).get(`${RUTA}/${jugador.perfilId}`);

    expect(respuesta.status).toBe(200);
    expect(Object.keys(respuesta.body).sort()).toEqual(
      [...CAMPOS_PERFIL_JUGADOR_PUBLICO].sort(),
    );
    expect(perfilJugadorPublicoSchema.safeParse(respuesta.body).success).toBe(true);
    expect(respuesta.body).toMatchObject({
      id: jugador.perfilId,
      nombre: "Jugadora Pública",
      bio: "Support de LoL",
      pais: "CO",
      departamento: "ATLANTICO",
      avatarUrl: null,
    });
  });

  it("muestra sólo las cuentas verificadas, con plataforma y fecha", async () => {
    const respuesta = await request(app).get(`${RUTA}/${jugador.perfilId}`);

    expect(respuesta.body.cuentasVerificadas).toEqual([
      { plataforma: "RIOT", verificadaEn: "2026-10-01T12:00:00.000Z" },
    ]);
    const texto = JSON.stringify(respuesta.body);
    for (const privado of ["puuid-", "Jugadora#LAN", "cifrado-de-prueba", "@proplay.test"]) {
      expect(texto).not.toContain(privado);
    }
  });

  it("con sesión, o con un token inválido, devuelve lo mismo", async () => {
    const anonimo = await request(app).get(`${RUTA}/${jugador.perfilId}`);
    const otro = await registrar("publico-lector", "EQUIPO");
    const conSesion = await request(app)
      .get(`${RUTA}/${jugador.perfilId}`)
      .set("Authorization", `Bearer ${otro.token}`);
    const tokenInvalido = await request(app)
      .get(`${RUTA}/${jugador.perfilId}`)
      .set("Authorization", "Bearer no-es-un-jwt");

    expect(conSesion.status).toBe(200);
    expect(conSesion.body).toEqual(anonimo.body);
    expect(tokenInvalido.status).toBe(200);
    expect(tokenInvalido.body).toEqual(anonimo.body);
  });

  it("responde 404 a un id inexistente, al id de la cuenta y al de un perfil de equipo", async () => {
    const equipo = await registrar("publico-equipo", "EQUIPO");
    for (const id of ["no-existe", jugador.usuarioId, equipo.perfilId]) {
      const respuesta = await request(app).get(`${RUTA}/${id}`);
      expect(respuesta.status).toBe(404);
      expect(respuesta.body.error.code).toBe("NOT_FOUND");
    }
  });

  it("responde 404 si la cuenta está desactivada", async () => {
    const inactivo = await registrar("publico-inactivo", "JUGADOR");
    await prisma.usuario.update({ where: { id: inactivo.usuarioId }, data: { activo: false } });

    const respuesta = await request(app).get(`${RUTA}/${inactivo.perfilId}`);
    expect(respuesta.status).toBe(404);
  });
});

describe("límite del perfil público", () => {
  // La API desactiva los límites en NODE_ENV=test; aquí se prueba la misma
  // configuración sin ese `skip`, delante de un manejador trivial.
  const appLimitada = express();
  appLimitada.use((req, _res, next) => {
    const usuario = req.headers["x-usuario"];
    if (usuario) req.usuario = { id: String(usuario), email: "", rol: "SCOUT" };
    next();
  });
  appLimitada.get("/", rateLimit(opcionesLimitePerfilPublico), (_req, res) => {
    res.sendStatus(204);
  });

  it("admite 120 consultas anónimas cada 15 minutos por IP", async () => {
    for (let consulta = 0; consulta < 120; consulta++) {
      expect((await request(appLimitada).get("/")).status).toBe(204);
    }
    const siguiente = await request(appLimitada).get("/");
    expect(siguiente.status).toBe(429);
    expect(siguiente.body.error.code).toBe("TOO_MANY_REQUESTS");
  });

  it("con sesión cuenta por usuario: no gasta el cupo de los anónimos de su IP", async () => {
    expect((await request(appLimitada).get("/").set("x-usuario", "scout-1")).status).toBe(204);
  });
});
