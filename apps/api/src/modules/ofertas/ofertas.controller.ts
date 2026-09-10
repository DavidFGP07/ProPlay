import { asyncHandler } from "../../utils/asyncHandler";
import * as servicio from "./ofertas.service";

/**
 * Controladores del módulo `ofertas`: sólo traducen entre HTTP y el
 * servicio. Andamiaje: todos responden 501 NOT_IMPLEMENTED por ahora.
 */

/**
 * GET /api/v1/ofertas
 * TODO: Listar ofertas abiertas con filtros de juego, región, rol y estado.
 */
export const listar = asyncHandler(async (req, res) => {
  res.json(await servicio.listar(req.body ?? req.validado));
});

/**
 * POST /api/v1/ofertas
 * TODO: Crear una oferta asociada al PerfilEquipo del usuario autenticado.
 */
export const crear = asyncHandler(async (req, res) => {
  res.json(await servicio.crear(req.body ?? req.validado));
});

/**
 * GET /api/v1/ofertas/:id
 * TODO: Devolver el detalle de una oferta.
 */
export const obtener = asyncHandler(async (req, res) => {
  res.json(await servicio.obtener(req.body ?? req.validado));
});

/**
 * PATCH /api/v1/ofertas/:id
 * TODO: Actualizar los datos o el estado de una oferta propia.
 */
export const actualizar = asyncHandler(async (req, res) => {
  res.json(await servicio.actualizar(req.body ?? req.validado));
});

/**
 * POST /api/v1/ofertas/:id/postulaciones
 * TODO: Registrar la postulación del jugador autenticado a una oferta.
 */
export const postular = asyncHandler(async (req, res) => {
  res.json(await servicio.postular(req.body ?? req.validado));
});

/**
 * GET /api/v1/ofertas/:id/postulaciones
 * TODO: Listar las postulaciones recibidas por una oferta propia.
 */
export const listarPostulaciones = asyncHandler(async (req, res) => {
  res.json(await servicio.listarPostulaciones(req.body ?? req.validado));
});

/**
 * PATCH /api/v1/ofertas/postulaciones/:id
 * TODO: Cambiar el estado de una postulación (revisión, aceptada, rechazada).
 */
export const actualizarPostulacion = asyncHandler(async (req, res) => {
  res.json(await servicio.actualizarPostulacion(req.body ?? req.validado));
});
