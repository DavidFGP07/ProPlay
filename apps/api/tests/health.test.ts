import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { API_PREFIX } from "@proplay/shared";
import { app, cerrarConexiones } from "./utils/entorno";

describe(`GET ${API_PREFIX}/health`, () => {
  afterAll(async () => {
    await cerrarConexiones();
  });

  it("informa el estado de Postgres y Redis", async () => {
    const respuesta = await request(app).get(`${API_PREFIX}/health`);

    expect([200, 503]).toContain(respuesta.status);
    expect(respuesta.body.servicios).toHaveProperty("postgres");
    expect(respuesta.body.servicios).toHaveProperty("redis");
    expect(typeof respuesta.body.uptime).toBe("number");
  });
});
