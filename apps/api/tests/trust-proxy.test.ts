import { describe, expect, it } from "vitest";
import express, { type Express } from "express";
import rateLimit from "express-rate-limit";
import request from "supertest";
import { configurarProxy } from "../src/app";
import { env, envSchema, interpretarTrustProxy } from "../src/config/env";
import { app } from "./utils/entorno";

/**
 * TRUST_PROXY decide si `req.ip`, clave de los límites por IP, se toma de
 * X-Forwarded-For. Sin proxy delante esa cabecera la escribe el cliente, así
 * que por defecto se ignora.
 */
function appConIp(trustProxy: false | number | string[]): Express {
  const prueba = express();
  configurarProxy(prueba, trustProxy);
  prueba.get("/", (req, res) => {
    res.json({ ip: req.ip });
  });
  return prueba;
}

/** Igual, con un límite de una petición por IP delante. */
function appLimitada(trustProxy: false | number | string[]): Express {
  const prueba = express();
  configurarProxy(prueba, trustProxy);
  // Sin la validación que avisa de X-Forwarded-For sin "trust proxy": aquí
  // la cabecera es justo lo que se prueba.
  const limite = rateLimit({
    windowMs: 60_000,
    limit: 1,
    validate: { xForwardedForHeader: false },
  });
  prueba.get("/", limite, (_req, res) => {
    res.sendStatus(204);
  });
  return prueba;
}

describe("TRUST_PROXY", () => {
  it("sin la variable no se confía en ningún proxy, y la app lo aplica", () => {
    expect(interpretarTrustProxy(undefined)).toBe(false);
    expect(interpretarTrustProxy("")).toBe(false);
    expect(app.get("trust proxy")).toBe(env.trustProxy);
  });

  it("sin TRUST_PROXY la IP no se toma de X-Forwarded-For", async () => {
    const respuesta = await request(appConIp(interpretarTrustProxy(undefined) ?? false))
      .get("/")
      .set("X-Forwarded-For", "203.0.113.9");

    expect(respuesta.body.ip).not.toBe("203.0.113.9");
    expect(respuesta.body.ip).toMatch(/127\.0\.0\.1|::1/);
  });

  it("sin TRUST_PROXY, cambiar X-Forwarded-For no salta el límite por IP", async () => {
    const limitada = appLimitada(false);
    const primera = await request(limitada).get("/").set("X-Forwarded-For", "203.0.113.1");
    const segunda = await request(limitada).get("/").set("X-Forwarded-For", "203.0.113.2");

    expect(primera.status).toBe(204);
    expect(segunda.status).toBe(429);
  });

  it("con TRUST_PROXY=1 toma la IP que añade el proxy", async () => {
    const respuesta = await request(appConIp(1))
      .get("/")
      .set("X-Forwarded-For", "198.51.100.4, 203.0.113.9");

    expect(respuesta.body.ip).toBe("203.0.113.9");
  });

  it.each([
    ["0", false],
    ["false", false],
    ["1", 1],
    ["2", 2],
    ["loopback", ["loopback"]],
    ["10.0.0.0/8, 192.168.1.1", ["10.0.0.0/8", "192.168.1.1"]],
    ["fd00::/8", ["fd00::/8"]],
  ])("interpreta %j", (valor, esperado) => {
    expect(interpretarTrustProxy(valor)).toEqual(esperado);
  });

  it.each(["true", "uno", "10.0.0.0/33", "999.1.1.1", "-1"])("rechaza %j", (valor) => {
    expect(interpretarTrustProxy(valor)).toBeNull();
    const resultado = envSchema.safeParse({ ...process.env, TRUST_PROXY: valor });
    expect(resultado.error?.issues.map((i) => i.path[0])).toContain("TRUST_PROXY");
  });

  it("es obligatoria en producción, pero 0 es un valor válido", () => {
    const produccion = { ...process.env, NODE_ENV: "production" };
    for (const valor of [undefined, ""]) {
      const resultado = envSchema.safeParse({ ...produccion, TRUST_PROXY: valor });
      expect(resultado.error?.issues.map((i) => i.path[0])).toContain("TRUST_PROXY");
    }
    expect(envSchema.safeParse({ ...produccion, TRUST_PROXY: "0" }).success).toBe(true);
  });
});
