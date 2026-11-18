import { queryValidada } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { UnauthorizedError } from "../../utils/errors";
import * as servicio from "./notificaciones.service";
import { listarNotificacionesQuerySchema, type MarcarLeidasInput } from "./notificaciones.schema";

/**
 * Controladores del módulo `notificaciones`: sólo traducen entre HTTP y el servicio.
 * Todas actúan sobre las notificaciones del usuario autenticado.
 */

function usuarioId(req: { usuario?: { id: string } }): string {
  if (!req.usuario) throw new UnauthorizedError("Sesión requerida");
  return req.usuario.id;
}

/**
 * GET /api/v1/notificaciones
 * RF-12 · Las propias, paginadas, de la más reciente a la más antigua.
 */
export const listar = asyncHandler(async (req, res) => {
  const query = queryValidada(req, listarNotificacionesQuerySchema);
  res.status(200).json(await servicio.listar(usuarioId(req), query));
});

/**
 * GET /api/v1/notificaciones/contador
 * RF-12 · Número de notificaciones sin leer.
 */
export const contarNoLeidas = asyncHandler(async (req, res) => {
  res.status(200).json(await servicio.contarNoLeidas(usuarioId(req)));
});

/**
 * POST /api/v1/notificaciones/leidas
 * RF-12 · Marca como leídas las indicadas.
 */
export const marcarLeidas = asyncHandler(async (req, res) => {
  const { ids } = req.body as MarcarLeidasInput;
  res.status(200).json(await servicio.marcarLeidas(usuarioId(req), ids));
});

/**
 * POST /api/v1/notificaciones/leidas/todas
 * RF-12 · Marca como leídas todas las propias.
 */
export const marcarTodas = asyncHandler(async (req, res) => {
  res.status(200).json(await servicio.marcarTodas(usuarioId(req)));
});
