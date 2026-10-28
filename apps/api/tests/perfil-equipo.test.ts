import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { API_PREFIX, perfilPropioResponseSchema, type RolRegistrable } from "@proplay/shared";
import {
  CONSENTIMIENTO,
  app,
  cerrarConexiones,
  emailDePrueba,
  limpiarUsuariosDePrueba,
} from "./utils/entorno";

/**
 * RF-07 · PATCH /perfiles/equipo: edición parcial del perfil de la
 * organización. Campo ausente, no cambia; `null`, se borra.
 */
const RUTA = `${API_PREFIX}/perfiles/equipo`;
const RUTA_ME = `${API_PREFIX}/perfiles/me`;

async function registrar(etiqueta: string, rol: RolRegistrable): Promise<string> {
  const respuesta = await request(app)
    .post(`${API_PREFIX}/auth/register`)
    .send({
      email: emailDePrueba(etiqueta),
      password: "ProPlay123",
      nombre: "Organización de Prueba",
      rol,
      ...CONSENTIMIENTO,
    });
  expect(respuesta.status).toBe(201);
  return respuesta.body.accessToken as string;
}

function actualizar(token: string, cuerpo: Record<string, unknown>) {
  return request(app).patch(RUTA).set("Authorization", `Bearer ${token}`).send(cuerpo);
}

async function leer(token: string) {
  const respuesta = await request(app).get(RUTA_ME).set("Authorization", `Bearer ${token}`);
  return respuesta.body.perfil;
}

function camposConError(cuerpo: {
  error: { details: { campos: { campo: string }[] } };
}): string[] {
  return cuerpo.error.details.campos.map((c) => c.campo);
}

describe(`PATCH ${RUTA}`, () => {
  let token: string;

  beforeAll(async () => {
    await limpiarUsuariosDePrueba();
    token = await registrar("patch-org", "EQUIPO");
  });

  afterAll(async () => {
    await limpiarUsuariosDePrueba();
    await cerrarConexiones();
  });

  it("exige sesión", async () => {
    const respuesta = await request(app).patch(RUTA).send({ descripcion: "Club" });
    expect(respuesta.status).toBe(401);
  });

  it.each(["JUGADOR", "SCOUT"] as const)("responde 403 al rol %s", async (rol) => {
    const otro = await registrar(`patch-org-${rol.toLowerCase()}`, rol);
    const respuesta = await actualizar(otro, { descripcion: "Club" });
    expect(respuesta.status).toBe(403);
  });

  it("guarda nombre, descripción y sitio web y responde como GET /perfiles/me", async () => {
    const respuesta = await actualizar(token, {
      nombreOrg: "  Lobos del Caribe  ",
      descripcion: "Club de League of Legends de Barranquilla.",
      sitioWeb: "https://lobos.gg",
    });

    expect(respuesta.status).toBe(200);
    expect(perfilPropioResponseSchema.safeParse(respuesta.body).success).toBe(true);
    expect(respuesta.body).toMatchObject({
      tipo: "EQUIPO",
      perfil: {
        nombreOrg: "Lobos del Caribe",
        descripcion: "Club de League of Legends de Barranquilla.",
        sitioWeb: "https://lobos.gg",
      },
    });
    expect(await leer(token)).toEqual(respuesta.body.perfil);
  });

  it("es parcial: lo que no se envía no cambia, y un cuerpo vacío no cambia nada", async () => {
    const parcial = await actualizar(token, { descripcion: "Nueva descripción" });
    expect(parcial.status).toBe(200);
    expect(parcial.body.perfil).toMatchObject({
      nombreOrg: "Lobos del Caribe",
      descripcion: "Nueva descripción",
      sitioWeb: "https://lobos.gg",
    });

    const antes = await leer(token);
    const vacio = await actualizar(token, {});
    expect(vacio.status).toBe(200);
    expect(vacio.body.perfil).toMatchObject({
      nombreOrg: antes.nombreOrg,
      descripcion: antes.descripcion,
      sitioWeb: antes.sitioWeb,
    });
  });

  it("con null borra la descripción y el sitio web", async () => {
    const respuesta = await actualizar(token, { descripcion: null, sitioWeb: null });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.perfil).toMatchObject({
      nombreOrg: "Lobos del Caribe",
      descripcion: null,
      sitioWeb: null,
    });
  });

  it("guarda una descripción en blanco como nula", async () => {
    const respuesta = await actualizar(token, { descripcion: "   " });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.perfil.descripcion).toBeNull();
  });

  it.each([
    ["un sitio web javascript:", { sitioWeb: "javascript:alert(1)" }, "sitioWeb"],
    ["un sitio web data:", { sitioWeb: "data:text/html,hola" }, "sitioWeb"],
    ["un sitio web sin esquema", { sitioWeb: "lobos.gg" }, "sitioWeb"],
    ["borrar el nombre", { nombreOrg: null }, "nombreOrg"],
    ["un nombre de un carácter", { nombreOrg: " X " }, "nombreOrg"],
    ["una descripción de más de 1000 caracteres", { descripcion: "a".repeat(1001) }, "descripcion"],
  ])("rechaza %s con 422 y no cambia nada", async (_caso, cuerpo, campo) => {
    await actualizar(token, { sitioWeb: "https://lobos.gg" });
    const antes = await leer(token);

    const respuesta = await actualizar(token, cuerpo);
    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
    expect(camposConError(respuesta.body)).toContain(campo);
    expect(await leer(token)).toEqual(antes);
  });
});
