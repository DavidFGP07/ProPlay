import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { REFRESH_COOKIE_NAME } from "@proplay/shared";
import { claveRefresh } from "../src/middleware/rateLimit";
import { firmarAccessToken, firmarRefreshToken } from "../src/utils/jwt";

function peticion(cookie?: string, ip = "10.0.0.7"): Request {
  return {
    ip,
    cookies: cookie ? { [REFRESH_COOKIE_NAME]: cookie } : {},
  } as unknown as Request;
}

describe("límite de /auth/refresh", () => {
  it("cuenta por usuario cuando el refresh token es válido", () => {
    expect(claveRefresh(peticion(firmarRefreshToken("usuario-1")))).toBe(
      "usuario:usuario-1",
    );
  });

  it("dos usuarios detrás de la misma IP no comparten contador", () => {
    const a = claveRefresh(peticion(firmarRefreshToken("usuario-a")));
    const b = claveRefresh(peticion(firmarRefreshToken("usuario-b")));
    expect(a).not.toBe(b);
  });

  it("el mismo usuario conserva la clave aunque el token rote", async () => {
    const primero = claveRefresh(peticion(firmarRefreshToken("usuario-1")));
    // jsonwebtoken firma con resolución de segundos: espera para obtener otro token.
    await new Promise((resolver) => setTimeout(resolver, 1100));
    const segundo = claveRefresh(peticion(firmarRefreshToken("usuario-1")));
    expect(segundo).toBe(primero);
  });

  it("sin cookie, o con un token falso o de otro tipo, cuenta por IP", () => {
    expect(claveRefresh(peticion())).toBe("ip:10.0.0.7");
    expect(claveRefresh(peticion("no-es-un-jwt"))).toBe("ip:10.0.0.7");
    const acceso = firmarAccessToken({ sub: "usuario-1", email: "a@b.co", rol: "JUGADOR" });
    expect(claveRefresh(peticion(acceso))).toBe("ip:10.0.0.7");
  });
});
