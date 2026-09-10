import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { API_PREFIX, REFRESH_COOKIE_NAME } from "@proplay/shared";
import {
  app,
  cerrarConexiones,
  emailDePrueba,
  extraerCookie,
  limpiarUsuariosDePrueba,
} from "./utils/entorno";

/**
 * Camino feliz de la autenticación de punta a punta: registro, login, refresco
 * y /me, más los errores esperados.
 */
describe(`${API_PREFIX}/auth`, () => {
  const password = "ProPlay123";
  const emailRegistro = emailDePrueba("registro");
  const emailLogin = emailDePrueba("login");

  beforeAll(async () => {
    await limpiarUsuariosDePrueba();
  });

  afterAll(async () => {
    await limpiarUsuariosDePrueba();
    await cerrarConexiones();
  });

  describe("POST /auth/register", () => {
    it("registra un jugador, devuelve el access token y la cookie de refresh", async () => {
      const respuesta = await request(app)
        .post(`${API_PREFIX}/auth/register`)
        .send({
          email: emailRegistro,
          password,
          nombre: "Jugador de Prueba",
          rol: "JUGADOR",
        });

      expect(respuesta.status).toBe(201);
      expect(respuesta.body.usuario).toMatchObject({
        email: emailRegistro.toLowerCase(),
        nombre: "Jugador de Prueba",
        rol: "JUGADOR",
        activo: true,
      });
      expect(respuesta.body.usuario.passwordHash).toBeUndefined();
      expect(typeof respuesta.body.accessToken).toBe("string");
      expect(respuesta.body.expiraEn).toBe(900);

      const cookie = extraerCookie(
        respuesta.headers["set-cookie"],
        REFRESH_COOKIE_NAME,
      );
      expect(cookie).toBeDefined();
      expect(cookie).toContain("HttpOnly");
    });

    it("rechaza un correo ya registrado con 409", async () => {
      const respuesta = await request(app)
        .post(`${API_PREFIX}/auth/register`)
        .send({
          email: emailRegistro,
          password,
          nombre: "Otro Jugador",
          rol: "JUGADOR",
        });

      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error.code).toBe("CONFLICT");
    });

    it("rechaza datos inválidos con 422 y detalla los campos", async () => {
      const respuesta = await request(app)
        .post(`${API_PREFIX}/auth/register`)
        .send({ email: "no-es-un-correo", password: "corta", nombre: "A", rol: "ALIEN" });

      expect(respuesta.status).toBe(422);
      expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
      const campos = respuesta.body.error.details.campos.map(
        (campo: { campo: string }) => campo.campo,
      );
      expect(campos).toContain("email");
      expect(campos).toContain("password");
      expect(campos).toContain("rol");
    });
  });

  describe("POST /auth/login", () => {
    beforeAll(async () => {
      await request(app).post(`${API_PREFIX}/auth/register`).send({
        email: emailLogin,
        password,
        nombre: "Equipo de Prueba",
        rol: "EQUIPO",
      });
    });

    it("autentica con credenciales correctas", async () => {
      const respuesta = await request(app)
        .post(`${API_PREFIX}/auth/login`)
        .send({ email: emailLogin, password });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.usuario.rol).toBe("EQUIPO");
      expect(typeof respuesta.body.accessToken).toBe("string");
    });

    it("devuelve 401 con la contraseña incorrecta", async () => {
      const respuesta = await request(app)
        .post(`${API_PREFIX}/auth/login`)
        .send({ email: emailLogin, password: "IncorrectA123" });

      expect(respuesta.status).toBe(401);
      expect(respuesta.body.error.code).toBe("UNAUTHORIZED");
    });

    it("devuelve 401 con un correo que no existe", async () => {
      const respuesta = await request(app)
        .post(`${API_PREFIX}/auth/login`)
        .send({ email: emailDePrueba("fantasma"), password });

      expect(respuesta.status).toBe(401);
    });
  });

  describe("POST /auth/refresh y GET /auth/me", () => {
    it("refresca la sesión con la cookie httpOnly y devuelve el usuario en /me", async () => {
      const login = await request(app)
        .post(`${API_PREFIX}/auth/login`)
        .send({ email: emailLogin, password });

      const cookie = extraerCookie(
        login.headers["set-cookie"],
        REFRESH_COOKIE_NAME,
      );
      expect(cookie).toBeDefined();

      const refresh = await request(app)
        .post(`${API_PREFIX}/auth/refresh`)
        .set("Cookie", cookie as string);

      expect(refresh.status).toBe(200);
      expect(typeof refresh.body.accessToken).toBe("string");

      const yo = await request(app)
        .get(`${API_PREFIX}/auth/me`)
        .set("Authorization", `Bearer ${refresh.body.accessToken}`);

      expect(yo.status).toBe(200);
      expect(yo.body.usuario.email).toBe(emailLogin.toLowerCase());
    });

    it("devuelve 401 al refrescar sin cookie", async () => {
      const respuesta = await request(app).post(`${API_PREFIX}/auth/refresh`);

      expect(respuesta.status).toBe(401);
      expect(respuesta.body.error.code).toBe("UNAUTHORIZED");
    });
  });
});
