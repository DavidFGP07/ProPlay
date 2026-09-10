import type { RequestHandler } from "express";
import { UnauthorizedError } from "../utils/errors";
import { verificarAccessToken } from "../utils/jwt";

const PREFIJO_BEARER = "Bearer ";

/**
 * Exige un access token válido en el header Authorization y deja el usuario
 * autenticado en `req.usuario`.
 */
export const auth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith(PREFIJO_BEARER)) {
    next(new UnauthorizedError("Falta el token de acceso"));
    return;
  }

  try {
    const payload = verificarAccessToken(header.slice(PREFIJO_BEARER.length));
    req.usuario = { id: payload.sub, email: payload.email, rol: payload.rol };
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Igual que `auth`, pero no falla si no hay token: sirve para endpoints
 * públicos que muestran más información a un usuario autenticado.
 */
export const authOpcional: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith(PREFIJO_BEARER)) {
    next();
    return;
  }

  try {
    const payload = verificarAccessToken(header.slice(PREFIJO_BEARER.length));
    req.usuario = { id: payload.sub, email: payload.email, rol: payload.rol };
  } catch {
    // Token inválido en una ruta pública: seguimos como anónimo.
  }
  next();
};
