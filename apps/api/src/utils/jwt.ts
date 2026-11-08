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

/** Contenido del refresh token: sólo el sujeto y el tipo. */
export interface PayloadRefresh {
  sub: string;
  tipo: "refresh";
  /** Emisión, en segundos desde epoch (lo añade jsonwebtoken al firmar). */
  iat: number;
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

/**
 * Desafío de verificación de una cuenta de Riot: qué icono debe poner el
 * jugador en qué cuenta. Va firmado para que la API no tenga que guardar
 * nada entre el paso 1 y el 2 y para que el cliente no pueda cambiar el puuid
 * ni el icono pedido. Sólo vale para el usuario que lo pidió (`sub`).
 */
export interface PayloadDesafioRiot {
  sub: string;
  puuid: string;
  riotId: string;
  servidor: string;
  icono: number;
}

const AUDIENCIA_DESAFIO_RIOT = "proplay-verificacion-riot";

export function firmarDesafioRiot(
  payload: PayloadDesafioRiot,
  minutosVigencia: number,
): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    issuer: EMISOR,
    audience: AUDIENCIA_DESAFIO_RIOT,
    expiresIn: minutosVigencia * 60,
  });
}

/** `null` si el token no es válido, caducó o es de otro usuario. */
export function verificarDesafioRiot(
  token: string,
  usuarioId: string,
): PayloadDesafioRiot | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      issuer: EMISOR,
      audience: AUDIENCIA_DESAFIO_RIOT,
      subject: usuarioId,
    });
    if (typeof payload === "string") return null;
    const datos = payload as unknown as PayloadDesafioRiot;
    if (typeof datos.puuid !== "string" || typeof datos.icono !== "number") return null;
    return datos;
  } catch {
    return null;
  }
}
