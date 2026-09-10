import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { API_PREFIX } from "@proplay/shared";
import {
  app,
  cerrarConexiones,
  emailDePrueba,
  limpiarUsuariosDePrueba,
} from "./utils/entorno";

/**
 * Middlewares auth y rbac: una ruta protegida no responde sin token, y un rol
 * insuficiente recibe 403 aunque el token sea válido.
 */
describe("Rutas protegidas", () => {
  const email = emailDePrueba("rbac");
  const password = "ProPlay123";
  let accessToken = "";

  beforeAll(async () => {
    await limpiarUsuariosDePrueba();
    const registro = await request(app)
      .post(`${API_PREFIX}/auth/register`)
      .send({ email, password, nombre: "Jugador RBAC", rol: "JUGADOR" });
    accessToken = registro.body.accessToken;
  });

  afterAll(async () => {
    await limpiarUsuariosDePrueba();
    await cerrarConexiones();
  });

  it("deniega el acceso a /auth/me sin token", async () => {
    const respuesta = await request(app).get(`${API_PREFIX}/auth/me`);

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("deniega el acceso con un token inválido", async () => {
    const respuesta = await request(app)
      .get(`${API_PREFIX}/auth/me`)
      .set("Authorization", "Bearer token.que.no.vale");

    expect(respuesta.status).toBe(401);
  });

  it("deniega el listado de usuarios a un JUGADOR (rbac ADMIN)", async () => {
    const respuesta = await request(app)
      .get(`${API_PREFIX}/usuarios`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.code).toBe("FORBIDDEN");
  });

  it("responde 404 con la forma de error del contrato en una ruta inexistente", async () => {
    const respuesta = await request(app).get(`${API_PREFIX}/no-existe`);

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe("NOT_FOUND");
  });

  it("responde 501 en un módulo que todavía es andamiaje", async () => {
    const respuesta = await request(app)
      .get(`${API_PREFIX}/notificaciones`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(respuesta.status).toBe(501);
    expect(respuesta.body.error.code).toBe("NOT_IMPLEMENTED");
  });
});
