import { asyncHandler } from "../../utils/asyncHandler";
import * as servicio from "./perfiles.service";

/**
 * Controladores del módulo `perfiles`: sólo traducen entre HTTP y el
 * servicio. Andamiaje: todos responden 501 NOT_IMPLEMENTED por ahora.
 */

/**
 * GET /api/v1/perfiles/me
 * TODO: Devolver el perfil (jugador o equipo) del usuario autenticado.
 */
export const obtenerPropio = asyncHandler(async (req, res) => {
  res.json(await servicio.obtenerPropio(req.body ?? req.validado));
});

/**
 * PUT /api/v1/perfiles/jugador
 * TODO: Actualizar el PerfilJugador del usuario autenticado.
 */
export const actualizarJugador = asyncHandler(async (req, res) => {
  res.json(await servicio.actualizarJugador(req.body ?? req.validado));
});

/**
 * PUT /api/v1/perfiles/equipo
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
