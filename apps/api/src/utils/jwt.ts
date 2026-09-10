import jwt, { type SignOptions, type VerifyOptions } from "jsonwebtoken";
import {
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL,
  type Rol,
} from "@proplay/shared";
import { env } from "../config/env";
import { UnauthorizedError } from "./errors";

/** Contenido del access token. */
export interface PayloadAcceso {
  sub: string;
  email: string;
  rol: Rol;
}

/** Contenido del refresh token: sólo el sujeto y la versión. */
export interface PayloadRefresh {
  sub: string;
  tipo: "refresh";
}

const EMISOR = "proplay-api";
const AUDIENCIA = "proplay-web";

const opcionesFirma: SignOptions = { issuer: EMISOR, audience: AUDIENCIA };
const opcionesVerificacion: VerifyOptions = {
  issuer: EMISOR,
  audience: AUDIENCIA,
};

export function firmarAccessToken(payload: PayloadAcceso): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    ...opcionesFirma,
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

export function firmarRefreshToken(usuarioId: string): string {
  return jwt.sign({ sub: usuarioId, tipo: "refresh" }, env.JWT_REFRESH_SECRET, {
    ...opcionesFirma,
    expiresIn: REFRESH_TOKEN_TTL,
  });
}

export function verificarAccessToken(token: string): PayloadAcceso {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, opcionesVerificacion);
    if (typeof payload === "string") throw new Error("Payload inesperado");
    return payload as unknown as PayloadAcceso;
  } catch {
    throw new UnauthorizedError("Token de acceso inválido o expirado");
  }
}

export function verificarRefreshToken(token: string): PayloadRefresh {
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET, opcionesVerificacion);
    if (typeof payload === "string") throw new Error("Payload inesperado");
    const datos = payload as unknown as PayloadRefresh;
    if (datos.tipo !== "refresh") {
      throw new Error("Tipo de token incorrecto");
    }
    return datos;
  } catch {
    throw new UnauthorizedError("Sesión expirada, vuelve a iniciar sesión");
  }
}

/** Segundos de vida del access token, para informarlo al cliente. */
export function segundosDeVidaAcceso(): number {
  const minutos = Number.parseInt(ACCESS_TOKEN_TTL, 10);
  return Number.isFinite(minutos) ? minutos * 60 : 900;
}
