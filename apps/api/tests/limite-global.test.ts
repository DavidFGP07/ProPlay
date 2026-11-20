import { describe, expect, it } from "vitest";
import express from "express";
import rateLimit from "express-rate-limit";
import request from "supertest";
import { API_PREFIX } from "@proplay/shared";
import { envSchema } from "../src/config/env";
import { opcionesLimiteGlobal } from "../src/middleware/rateLimit";

/**
 * Límite global de la API: configurable con LIMITE_GLOBAL_PETICIONES y sin
 * frenar nunca el cierre de sesión. La API desactiva los límites en
 * NODE_ENV=test; aquí se prueba la misma configuración sin ese `skip`.
 */
function appConLimite(limite: number) {
  const app = express();
  app.use(rateLimit(opcionesLimiteGlobal(limite)));
  app.use((_req, res) => {
    res.sendStatus(204);
  });
  return app;
}

describe("límite global de peticiones", () => {
  it("corta al pasar el número de peticiones configurado", async () => {
    const app = appConLimite(3);
    for (let i = 0; i < 3; i++) {
      expect((await request(app).get(`${API_PREFIX}/ofertas`)).status).toBe(204);
    }
    expect((await request(app).get(`${API_PREFIX}/ofertas`)).status).toBe(429);
  });

  it("el cierre de sesión pasa aunque el límite esté agotado, y no gasta cupo", async () => {
    const app = appConLimite(1);
    expect((await request(app).get(`${API_PREFIX}/auth/me`)).status).toBe(204);
    expect((await request(app).get(`${API_PREFIX}/auth/me`)).status).toBe(429);
    for (let i = 0; i < 3; i++) {
      expect((await request(app).post(`${API_PREFIX}/auth/logout`)).status).toBe(204);
    }
  });

  it("LIMITE_GLOBAL_PETICIONES vale 300 por defecto y admite otro entero positivo", () => {
    const base = {
      DATABASE_URL: "postgresql://u:p@localhost:5432/db",
      REDIS_URL: "redis://localhost:6379",
      JWT_SECRET: "x".repeat(32),
      JWT_REFRESH_SECRET: "y".repeat(32),
      ENCRYPTION_KEY: "a".repeat(64),
    };
    expect(envSchema.parse(base).LIMITE_GLOBAL_PETICIONES).toBe(300);
    expect(envSchema.parse({ ...base, LIMITE_GLOBAL_PETICIONES: "100000" }).LIMITE_GLOBAL_PETICIONES).toBe(
      100000,
    );
    expect(envSchema.safeParse({ ...base, LIMITE_GLOBAL_PETICIONES: "0" }).success).toBe(false);
  });
});
