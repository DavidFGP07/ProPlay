import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import rateLimit from "express-rate-limit";
import request from "supertest";
import { API_PREFIX, REFRESH_COOKIE_NAME } from "@proplay/shared";
import { prisma } from "../src/config/prisma";
import { opcionesLimiteCambioContrasena } from "../src/middleware/rateLimit";
import {
  CONSENTIMIENTO,
  app,
  cerrarConexiones,
  emailDePrueba,
  extraerCookie,
  limpiarUsuariosDePrueba,
} from "./utils/entorno";

/**
 * RF-01 · Cambio de contraseña: PATCH /usuarios/me/contrasena.
 */
const RUTA = `${API_PREFIX}/usuarios/me/contrasena`;
const PASSWORD = "ProPlay123";

interface Sesion {
  email: string;
  accessToken: string;
  /** Cookie de refresh lista para la cabecera Cookie. */
  cookie: string;
}

function cookieDe(cabecera: string | string[] | undefined): string {
  const cookie = extraerCookie(cabecera, REFRESH_COOKIE_NAME);
  if (!cookie) throw new Error("La respuesta no trae la cookie de refresh");
  return cookie.split(";")[0]!;
}

async function registrar(etiqueta: string): Promise<Sesion> {
  const email = emailDePrueba(etiqueta);
  const respuesta = await request(app)
    .post(`${API_PREFIX}/auth/register`)
    .send({
      email,
      password: PASSWORD,
      nombre: "Cuenta de Prueba",
      rol: "SCOUT",
      ...CONSENTIMIENTO,
    });
  expect(respuesta.status).toBe(201);
  return {
    email,
    accessToken: respuesta.body.accessToken as string,
    cookie: cookieDe(respuesta.headers["set-cookie"]),
  };
}

function cambiar(sesion: Sesion, cuerpo: Record<string, unknown>) {
  return request(app)
    .patch(RUTA)
    .set("Authorization", `Bearer ${sesion.accessToken}`)
    .send(cuerpo);
}

function refrescar(cookie: string) {
  return request(app).post(`${API_PREFIX}/auth/refresh`).set("Cookie", cookie);
}

/** jsonwebtoken firma con resolución de segundos: espera a que cambie el segundo. */
const pasarUnSegundo = () => new Promise((resolver) => setTimeout(resolver, 1100));

describe(`PATCH ${RUTA}`, () => {
  beforeAll(async () => {
    await limpiarUsuariosDePrueba();
  });

  afterAll(async () => {
    await limpiarUsuariosDePrueba();
    await cerrarConexiones();
  });

  it("cambia la contraseña con la actual correcta y devuelve una sesión nueva", async () => {
    const sesion = await registrar("cambio-ok");
    const respuesta = await cambiar(sesion, {
      contrasenaActual: PASSWORD,
      contrasenaNueva: "NuevaClave2026",
    });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.usuario.email).toBe(sesion.email.toLowerCase());
    expect(respuesta.body.usuario.passwordHash).toBeUndefined();
    expect(respuesta.body.usuario.credencialesCambiadasEn).toBeUndefined();
    expect(typeof respuesta.body.accessToken).toBe("string");
    expect(cookieDe(respuesta.headers["set-cookie"])).toBeTruthy();

    const conNueva = await request(app)
      .post(`${API_PREFIX}/auth/login`)
      .send({ email: sesion.email, password: "NuevaClave2026" });
    expect(conNueva.status).toBe(200);

    const conAnterior = await request(app)
      .post(`${API_PREFIX}/auth/login`)
      .send({ email: sesion.email, password: PASSWORD });
    expect(conAnterior.status).toBe(401);
  });

  it("deja traza en AuditLog sin ningún dato de la contraseña", async () => {
    const sesion = await registrar("cambio-auditoria");
    await cambiar(sesion, { contrasenaActual: PASSWORD, contrasenaNueva: "NuevaClave2026" });

    const usuario = await prisma.usuario.findUniqueOrThrow({
      where: { email: sesion.email.toLowerCase() },
    });
    const traza = await prisma.auditLog.findFirst({
      where: { usuarioId: usuario.id, accion: "CONTRASENA_CAMBIADA" },
    });
    expect(traza).not.toBeNull();
    expect(traza?.metadata).toBeNull();
  });

  it("rechaza una contraseña actual incorrecta con 400 y no cierra la sesión", async () => {
    const sesion = await registrar("cambio-actual-mal");
    const respuesta = await cambiar(sesion, {
      contrasenaActual: "NoEsLaActual1",
      contrasenaNueva: "NuevaClave2026",
    });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("CONTRASENA_ACTUAL_INVALIDA");
    expect((await refrescar(sesion.cookie)).status).toBe(200);
  });

  it("rechaza una contraseña nueva igual a la actual con 422", async () => {
    const sesion = await registrar("cambio-igual");
    const respuesta = await cambiar(sesion, {
      contrasenaActual: PASSWORD,
      contrasenaNueva: PASSWORD,
    });

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
    expect(respuesta.body.error.details.campos).toEqual(
      expect.arrayContaining([expect.objectContaining({ campo: "contrasenaNueva" })]),
    );
  });

  it("rechaza una contraseña nueva que no cumple la política con 422", async () => {
    const sesion = await registrar("cambio-politica");
    const respuesta = await cambiar(sesion, {
      contrasenaActual: PASSWORD,
      contrasenaNueva: "sinnumeros",
    });

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.details.campos[0].campo).toBe("contrasenaNueva");
  });

  it("exige autenticación", async () => {
    const respuesta = await request(app)
      .patch(RUTA)
      .send({ contrasenaActual: PASSWORD, contrasenaNueva: "NuevaClave2026" });
    expect(respuesta.status).toBe(401);
  });

  it("revoca las sesiones anteriores y conserva la del cambio", async () => {
    const sesion = await registrar("cambio-revocacion");
    // Una segunda sesión del mismo usuario, en otro dispositivo.
    const otroDispositivo = await request(app)
      .post(`${API_PREFIX}/auth/login`)
      .send({ email: sesion.email, password: PASSWORD });
    const cookieOtro = cookieDe(otroDispositivo.headers["set-cookie"]);

    await pasarUnSegundo();
    const cambio = await cambiar(sesion, {
      contrasenaActual: PASSWORD,
      contrasenaNueva: "NuevaClave2026",
    });
    expect(cambio.status).toBe(200);
    const cookieNueva = cookieDe(cambio.headers["set-cookie"]);

    // El token emitido en la misma respuesta del cambio sigue valiendo...
    expect((await refrescar(cookieNueva)).status).toBe(200);
    // ...y los emitidos antes, de este y de otro dispositivo, quedan revocados.
    expect((await refrescar(sesion.cookie)).status).toBe(401);
    expect((await refrescar(cookieOtro)).status).toBe(401);
  });
});

describe("límite de cambio de contraseña", () => {
  // La API desactiva los límites en NODE_ENV=test; aquí se prueba la misma
  // configuración sin ese `skip`, delante de un manejador trivial.
  const appLimitada = express();
  appLimitada.use((req, _res, next) => {
    req.usuario = { id: String(req.headers["x-usuario"]), email: "", rol: "SCOUT" };
    next();
  });
  appLimitada.patch("/", rateLimit(opcionesLimiteCambioContrasena), (_req, res) => {
    res.sendStatus(204);
  });

  it("admite 5 intentos cada 15 minutos por usuario", async () => {
    for (let intento = 0; intento < 5; intento++) {
      expect((await request(appLimitada).patch("/").set("x-usuario", "a")).status).toBe(204);
    }
    const sexto = await request(appLimitada).patch("/").set("x-usuario", "a");
    expect(sexto.status).toBe(429);
    expect(sexto.body.error.code).toBe("TOO_MANY_REQUESTS");
  });

  it("cuenta por usuario: otro usuario de la misma IP no queda bloqueado", async () => {
    expect((await request(appLimitada).patch("/").set("x-usuario", "b")).status).toBe(204);
  });
});
