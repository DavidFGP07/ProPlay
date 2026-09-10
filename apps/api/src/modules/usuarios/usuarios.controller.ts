import type { CookieOptions, Request, RequestHandler, Response } from "express";
import {
  REFRESH_COOKIE_MAX_AGE_MS,
  REFRESH_COOKIE_NAME,
  API_PREFIX,
} from "@proplay/shared";
import { env } from "../../config/env";
import { asyncHandler } from "../../utils/asyncHandler";
import { UnauthorizedError } from "../../utils/errors";
import { paginar } from "../../utils/pagination";
import { queryValidada } from "../../middleware/validate";
import * as servicio from "./usuarios.service";
import {
  listarUsuariosQuerySchema,
  paginacionQuerySchema,
  type ActualizarUsuarioInput,
  type LoginInput,
  type RegisterInput,
} from "./usuarios.schema";

/**
 * Controladores del módulo: sólo traducen entre HTTP y el servicio.
 * Aquí no hay lógica de negocio ni acceso a Prisma.
 */

/** Petición cuyo body ya validó el middleware validate() con su esquema Zod. */
type PeticionCon<Body> = Request<Record<string, string>, unknown, Body>;

function opcionesCookieRefresh(): CookieOptions {
  return {
    httpOnly: true,
    // En producción la web (Vercel) y la API (Railway) están en dominios
    // distintos: la cookie necesita SameSite=None sobre HTTPS.
    secure: env.esProduccion,
    sameSite: env.esProduccion ? "none" : "lax",
    path: `${API_PREFIX}/auth`,
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  };
}

function enviarSesion(res: Response, sesion: servicio.SesionCreada, status = 200) {
  res.cookie(REFRESH_COOKIE_NAME, sesion.refreshToken, opcionesCookieRefresh());
  res.status(status).json(sesion.respuesta);
}

export const registrar = asyncHandler<PeticionCon<RegisterInput>>(
  async (req, res) => {
    const sesion = await servicio.registrar(req.body);
    enviarSesion(res, sesion, 201);
  },
);

export const login = asyncHandler<PeticionCon<LoginInput>>(
  async (req, res) => {
    const sesion = await servicio.login(req.body);
    enviarSesion(res, sesion);
  },
);

export const refrescar = asyncHandler(async (req, res) => {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  const sesion = await servicio.refrescar(cookies?.[REFRESH_COOKIE_NAME]);
  res.cookie(REFRESH_COOKIE_NAME, sesion.refreshToken, opcionesCookieRefresh());
  res.status(200).json({
    accessToken: sesion.respuesta.accessToken,
    expiraEn: sesion.respuesta.expiraEn,
  });
});

export const logout: RequestHandler = (_req, res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, opcionesCookieRefresh());
  res.status(204).send();
};

export const yo = asyncHandler(async (req, res) => {
  if (!req.usuario) throw new UnauthorizedError();
  const usuario = await servicio.obtenerPorId(req.usuario.id);
  res.status(200).json({ usuario });
});

export const listar = asyncHandler(async (req, res) => {
  const filtros = queryValidada(req, listarUsuariosQuerySchema.merge(paginacionQuerySchema));
  const { usuarios, total, rango } = await servicio.listar(filtros);
  res.status(200).json(paginar(usuarios, total, rango));
});

export const obtener = asyncHandler(async (req, res) => {
  const usuario = await servicio.obtenerPorId(req.params.id as string);
  res.status(200).json({ usuario });
});

export const actualizarPropio = asyncHandler<
  PeticionCon<ActualizarUsuarioInput>
>(async (req, res) => {
  if (!req.usuario) throw new UnauthorizedError();
  const usuario = await servicio.actualizar(req.usuario.id, req.body);
  res.status(200).json({ usuario });
});
