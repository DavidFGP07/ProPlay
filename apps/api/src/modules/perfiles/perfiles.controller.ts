import type { Request } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { UnauthorizedError } from "../../utils/errors";
import * as servicio from "./perfiles.service";
import type { PerfilJugadorInput } from "./perfiles.schema";

/**
 * Controladores del módulo `perfiles`: sólo traducen entre HTTP y el
 * servicio. Andamiaje: los que conservan su TODO responden 501.
 */

/** Petición cuyo body ya validó el middleware validate() con su esquema Zod. */
type PeticionCon<Body> = Request<Record<string, string>, unknown, Body>;

/**
 * GET /api/v1/perfiles/me
 * Perfil del usuario autenticado según su rol.
 */
export const obtenerPropio = asyncHandler(async (req, res) => {
  if (!req.usuario) throw new UnauthorizedError();
  res.status(200).json(await servicio.obtenerPropio(req.usuario.id, req.usuario.rol));
});

/**
 * PATCH /api/v1/perfiles/jugador
 * Actualización parcial del perfil del jugador autenticado.
 */
export const actualizarJugador = asyncHandler<PeticionCon<PerfilJugadorInput>>(
  async (req, res) => {
    if (!req.usuario) throw new UnauthorizedError();
    res.status(200).json(await servicio.actualizarJugador(req.usuario.id, req.body));
  },
);

/**
 * PATCH /api/v1/perfiles/equipo
 * TODO: Actualizar el PerfilEquipo del usuario autenticado.
 */
export const actualizarEquipo = asyncHandler(async (req, res) => {
  res.json(await servicio.actualizarEquipo(req.body ?? req.validado));
});

/**
 * GET /api/v1/perfiles/habilidades
 * TODO: Devolver el catálogo de habilidades (técnicas y blandas).
 */
export const catalogoHabilidades = asyncHandler(async (req, res) => {
  res.json(await servicio.catalogoHabilidades(req.body ?? req.validado));
});

/**
 * POST /api/v1/perfiles/habilidades
 * TODO: Asociar una habilidad al perfil del jugador con su nivel 1-5.
 */
export const asignarHabilidad = asyncHandler(async (req, res) => {
  res.json(await servicio.asignarHabilidad(req.body ?? req.validado));
});

/**
 * POST /api/v1/perfiles/endorsements
 * TODO: Registrar el endorsement de una HabilidadJugador por parte de otro usuario.
 */
export const endosar = asyncHandler(async (req, res) => {
  res.json(await servicio.endosar(req.body ?? req.validado));
});

/**
 * POST /api/v1/perfiles/cuentas-gaming
 * TODO: Vincular una cuenta externa vía OAuth y guardar sus tokens cifrados.
 */
export const vincularCuenta = asyncHandler(async (req, res) => {
  res.json(await servicio.vincularCuenta(req.body ?? req.validado));
});

/**
 * GET /api/v1/perfiles/:id
 * TODO: Devolver el perfil público de un usuario por su id.
 */
export const obtenerPublico = asyncHandler(async (req, res) => {
  res.json(await servicio.obtenerPublico(req.body ?? req.validado));
});
