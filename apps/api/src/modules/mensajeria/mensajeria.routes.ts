import { Router } from "express";
import { auth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import * as controlador from "./mensajeria.controller";
import {
  crearConversacionSchema,
  crearMensajeSchema,
  paginacionQuerySchema,
} from "./mensajeria.schema";

/**
 * Rutas del módulo `mensajeria`: /api/v1/mensajeria
 * Conversaciones y mensajes 1:1 y de equipo.
 */
export const mensajeriaRouter = Router();

// TODO: Listar las conversaciones del usuario autenticado con su último mensaje.
mensajeriaRouter.get(
  "/conversaciones",
  auth,
  validate(paginacionQuerySchema, "query"),
  controlador.listarConversaciones,
);

// TODO: Abrir una conversación con uno o varios participantes.
mensajeriaRouter.post(
  "/conversaciones",
  auth,
  validate(crearConversacionSchema),
  controlador.crearConversacion,
);

// TODO: Listar los mensajes de una conversación en la que participa el usuario.
mensajeriaRouter.get(
  "/conversaciones/:id/mensajes",
  auth,
  validate(paginacionQuerySchema, "query"),
  controlador.listarMensajes,
);

// TODO: Publicar un mensaje en la conversación y notificar a los participantes.
mensajeriaRouter.post(
  "/conversaciones/:id/mensajes",
  auth,
  validate(crearMensajeSchema),
  controlador.enviarMensaje,
);
