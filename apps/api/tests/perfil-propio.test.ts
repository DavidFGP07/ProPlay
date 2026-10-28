import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import {
  API_PREFIX,
  perfilPropioResponseSchema,
  type RolRegistrable,
} from "@proplay/shared";
import {
  CONSENTIMIENTO,
  app,
  cerrarConexiones,
  emailDePrueba,
  limpiarUsuariosDePrueba,
} from "./utils/entorno";

/**
 * RF-05 · Perfil propio: GET /perfiles/me y PATCH /perfiles/jugador, con la
 * ubicación del jugador (insumo de la dimensión geográfica de RF-09).
 */
const RUTA_ME = `${API_PREFIX}/perfiles/me`;
const RUTA_JUGADOR = `${API_PREFIX}/perfiles/jugador`;

async function registrar(etiqueta: string, rol: RolRegistrable): Promise<string> {
  const respuesta = await request(app)
    .post(`${API_PREFIX}/auth/register`)
    .send({
      email: emailDePrueba(etiqueta),
      password: "ProPlay123",
      nombre: "Cuenta de Prueba",
      rol,
      ...CONSENTIMIENTO,
    });
  expect(respuesta.status).toBe(201);
  return respuesta.body.accessToken as string;
}

function obtener(token: string) {
  return request(app).get(RUTA_ME).set("Authorization", `Bearer ${token}`);
}

function actualizar(token: string, cuerpo: Record<string, unknown>) {
  return request(app)
    .patch(RUTA_JUGADOR)
    .set("Authorization", `Bearer ${token}`)
    .send(cuerpo);
}

/** Campos con error de una respuesta 422. */
function camposConError(cuerpo: {
  error: { details: { campos: { campo: string }[] } };
}): string[] {
  return cuerpo.error.details.campos.map((c) => c.campo);
}

describe(`GET ${RUTA_ME}`, () => {
  beforeAll(async () => {
    await limpiarUsuariosDePrueba();
  });

  afterAll(async () => {
    await limpiarUsuariosDePrueba();
  });

  it("exige sesión", async () => {
    const respuesta = await request(app).get(RUTA_ME);
    expect(respuesta.status).toBe(401);
  });

  it("devuelve el perfil del jugador recién registrado, sin ubicación", async () => {
    const token = await registrar("me-jugador", "JUGADOR");
    const respuesta = await obtener(token);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.tipo).toBe("JUGADOR");
    expect(respuesta.body.perfil).toMatchObject({
      pais: null,
      departamento: null,
      dispuestoRelocalizar: false,
    });
    expect(respuesta.body.perfil).not.toHaveProperty("region");
    expect(respuesta.body.perfil).not.toHaveProperty("fechaNacimiento");
  });

  it("devuelve el perfil del equipo, sin la región de texto libre", async () => {
    const token = await registrar("me-equipo", "EQUIPO");
    const respuesta = await obtener(token);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.tipo).toBe("EQUIPO");
    expect(respuesta.body.perfil.nombreOrg).toBe("Cuenta de Prueba");
    expect(respuesta.body.perfil).not.toHaveProperty("region");
  });

  it("responde 200 con perfil nulo al scout, que no tiene perfil", async () => {
    const token = await registrar("me-scout", "SCOUT");
    const respuesta = await obtener(token);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ tipo: null, perfil: null });
    expect(perfilPropioResponseSchema.safeParse(respuesta.body).success).toBe(true);
  });
});

describe(`PATCH ${RUTA_JUGADOR}`, () => {
  let token: string;

  beforeAll(async () => {
    await limpiarUsuariosDePrueba();
    token = await registrar("put-jugador", "JUGADOR");
  });

  afterAll(async () => {
    await limpiarUsuariosDePrueba();
    await cerrarConexiones();
  });

  it("exige sesión y rol de jugador", async () => {
    const sinSesion = await request(app).patch(RUTA_JUGADOR).send({ pais: "MX" });
    expect(sinSesion.status).toBe(401);

    const equipo = await registrar("put-equipo", "EQUIPO");
    const respuesta = await actualizar(equipo, { pais: "MX" });
    expect(respuesta.status).toBe(403);
  });

  it("las actualizaciones parciales van por PATCH: PUT ya no existe", async () => {
    const put = await request(app)
      .put(RUTA_JUGADOR)
      .set("Authorization", `Bearer ${token}`)
      .send({ pais: "MX" });
    expect(put.status).toBe(404);
  });

  it("guarda país, departamento y disposición a relocalizarse", async () => {
    const respuesta = await actualizar(token, {
      pais: "CO",
      departamento: "ATLANTICO",
      dispuestoRelocalizar: true,
    });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({
      tipo: "JUGADOR",
      perfil: { pais: "CO", departamento: "ATLANTICO", dispuestoRelocalizar: true },
    });
    const leido = await obtener(token);
    expect(leido.body.perfil).toMatchObject({ pais: "CO", departamento: "ATLANTICO" });
  });

  it("es parcial: lo que no se envía no cambia", async () => {
    const respuesta = await actualizar(token, { bio: "Jungla de LoL" });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.perfil).toMatchObject({
      bio: "Jungla de LoL",
      pais: "CO",
      departamento: "ATLANTICO",
      dispuestoRelocalizar: true,
    });
  });

  it("recorta la presentación y guarda una en blanco como nula", async () => {
    const recortada = await actualizar(token, { bio: "  Jungla de LoL\n" });
    expect(recortada.status).toBe(200);
    expect(recortada.body.perfil.bio).toBe("Jungla de LoL");

    const enBlanco = await actualizar(token, { bio: "   " });
    expect(enBlanco.status).toBe(200);
    expect(enBlanco.body.perfil.bio).toBeNull();

    await actualizar(token, { bio: "Jungla de LoL" });
  });

  it("guarda la disponibilidad semanal y rechaza la que pasa de 80 horas", async () => {
    const valida = await actualizar(token, { disponibilidadHoras: 20 });
    expect(valida.status).toBe(200);
    expect(valida.body.perfil.disponibilidadHoras).toBe(20);

    const excesiva = await actualizar(token, { disponibilidadHoras: 81 });
    expect(excesiva.status).toBe(422);
    expect(camposConError(excesiva.body)).toContain("disponibilidadHoras");
    expect((await obtener(token)).body.perfil.disponibilidadHoras).toBe(20);
  });

  it("al cambiar a otro país borra el departamento de Colombia", async () => {
    const respuesta = await actualizar(token, { pais: "MX" });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.perfil).toMatchObject({ pais: "MX", departamento: null });
  });

  it("con null borra la ubicación", async () => {
    await actualizar(token, { pais: "CO", departamento: "BOLIVAR" });
    const respuesta = await actualizar(token, { pais: null });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.perfil).toMatchObject({ pais: null, departamento: null });
  });

  it("descarta `region` y `fechaNacimiento`, que ya no son parte del contrato", async () => {
    const respuesta = await actualizar(token, {
      region: "LAN",
      fechaNacimiento: "2000-01-01",
    });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.perfil).not.toHaveProperty("region");
    expect(respuesta.body.perfil).not.toHaveProperty("fechaNacimiento");
  });

  it("con país guardado CO acepta sólo el departamento", async () => {
    await actualizar(token, { pais: "CO", departamento: "ATLANTICO" });
    const respuesta = await actualizar(token, { departamento: "SUCRE" });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.perfil).toMatchObject({ pais: "CO", departamento: "SUCRE" });
  });

  it.each([
    ["MX", { departamento: "BOLIVAR" }],
    ["sin país", { departamento: "BOLIVAR" }],
    ["CO, al quitarle el departamento", { departamento: null }],
  ])(
    "con país guardado %s rechaza sólo el departamento con 422 y no cambia nada",
    async (guardado, cuerpo) => {
      const ubicacion =
        guardado === "MX"
          ? { pais: "MX" }
          : guardado === "sin país"
            ? { pais: null }
            : { pais: "CO", departamento: "MAGDALENA" };
      await actualizar(token, ubicacion);
      const antes = (await obtener(token)).body.perfil;

      const respuesta = await actualizar(token, cuerpo);
      expect(respuesta.status).toBe(422);
      expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
      expect(camposConError(respuesta.body)).toContain("departamento");

      const despues = (await obtener(token)).body.perfil;
      expect(despues).toEqual(antes);
    },
  );

  it.each([
    ["Colombia sin departamento", { pais: "CO" }, "departamento"],
    ["departamento fuera de Colombia", { pais: "MX", departamento: "ATLANTICO" }, "departamento"],
    ["país como texto libre", { pais: "Colombia" }, "pais"],
    ["departamento fuera del catálogo", { pais: "CO", departamento: "BARRANQUILLA" }, "departamento"],
  ])("rechaza %s con 422 y no cambia nada", async (_caso, cuerpo, campo) => {
    await actualizar(token, { pais: "CO", departamento: "MAGDALENA" });

    const respuesta = await actualizar(token, cuerpo);
    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
    expect(camposConError(respuesta.body)).toContain(campo);

    const leido = await obtener(token);
    expect(leido.body.perfil).toMatchObject({ pais: "CO", departamento: "MAGDALENA" });
  });
});
