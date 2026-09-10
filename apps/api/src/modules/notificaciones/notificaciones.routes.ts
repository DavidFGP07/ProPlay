import { Router } from "express";
import { auth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import * as controlador from "./notificaciones.controller";
import {
  marcarLeidasSchema,
  paginacionQuerySchema,
} from "./notificaciones.schema";

/**
 * Rutas del módulo `notificaciones`: /api/v1/notificaciones
 * Notificaciones in-app del usuario.
 */
export const notificacionesRouter = Router();

// TODO: Listar las notificaciones del usuario autenticado, las no leídas primero.
notificacionesRouter.get(
  "/",
  auth,
  validate(paginacionQuerySchema, "query"),
  controlador.listar,
);

// TODO: Devolver el número de notificaciones sin leer.
notificacionesRouter.get(
  "/contador",
  auth,
  controlador.contarNoLeidas,
);

// TODO: Marcar como leídas las notificaciones indicadas.
notificacionesRouter.post(
  "/leidas",
  auth,
  validate(marcarLeidasSchema),
  controlador.marcarLeidas,
);
