import { asyncHandler } from "../../utils/asyncHandler";
import * as servicio from "./mensajeria.service";

/**
 * Controladores del módulo `mensajeria`: sólo traducen entre HTTP y el
 * servicio. Andamiaje: todos responden 501 NOT_IMPLEMENTED por ahora.
 */

/**
 * GET /api/v1/mensajeria/conversaciones
 * TODO: Listar las conversaciones del usuario autenticado con su último mensaje.
 */
export const listarConversaciones = asyncHandler(async (req, res) => {
  res.json(await servicio.listarConversaciones(req.body ?? req.validado));
});

/**
 * POST /api/v1/mensajeria/conversaciones
 * TODO: Abrir una conversación con uno o varios participantes.
 */
export const crearConversacion = asyncHandler(async (req, res) => {
  res.json(await servicio.crearConversacion(req.body ?? req.validado));
});

/**
 * GET /api/v1/mensajeria/conversaciones/:id/mensajes
 * TODO: Listar los mensajes de una conversación en la que participa el usuario.
 */
export const listarMensajes = asyncHandler(async (req, res) => {
  res.json(await servicio.listarMensajes(req.body ?? req.validado));
});

/**
 * POST /api/v1/mensajeria/conversaciones/:id/mensajes
 * TODO: Publicar un mensaje en la conversación y notificar a los participantes.
 */
export const enviarMensaje = asyncHandler(async (req, res) => {
  res.json(await servicio.enviarMensaje(req.body ?? req.validado));
});
