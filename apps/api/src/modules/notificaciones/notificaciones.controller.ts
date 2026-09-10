import { asyncHandler } from "../../utils/asyncHandler";
import * as servicio from "./notificaciones.service";

/**
 * Controladores del módulo `notificaciones`: sólo traducen entre HTTP y el
 * servicio. Andamiaje: todos responden 501 NOT_IMPLEMENTED por ahora.
 */

/**
 * GET /api/v1/notificaciones
 * TODO: Listar las notificaciones del usuario autenticado, las no leídas primero.
 */
export const listar = asyncHandler(async (req, res) => {
  res.json(await servicio.listar(req.body ?? req.validado));
});

/**
 * GET /api/v1/notificaciones/contador
 * TODO: Devolver el número de notificaciones sin leer.
 */
export const contarNoLeidas = asyncHandler(async (req, res) => {
  res.json(await servicio.contarNoLeidas(req.body ?? req.validado));
});

/**
 * POST /api/v1/notificaciones/leidas
 * TODO: Marcar como leídas las notificaciones indicadas.
 */
export const marcarLeidas = asyncHandler(async (req, res) => {
  res.json(await servicio.marcarLeidas(req.body ?? req.validado));
});
