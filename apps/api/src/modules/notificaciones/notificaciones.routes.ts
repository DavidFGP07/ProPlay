import { Router } from "express";
import { auth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import * as controlador from "./notificaciones.controller";
import { listarNotificacionesQuerySchema, marcarLeidasSchema } from "./notificaciones.schema";

/**
 * Rutas del módulo `notificaciones`: /api/v1/notificaciones
 * Notificaciones dentro de la app del usuario autenticado (RF-12). Cualquier
 * rol con sesión; cada uno sólo ve y marca las suyas.
 */
export const notificacionesRouter = Router();

// RF-12 · Las propias, paginadas, de la más reciente a la más antigua.
notificacionesRouter.get(
  "/",
  auth,
  validate(listarNotificacionesQuerySchema, "query"),
  controlador.listar,
);

// RF-12 · Número de notificaciones sin leer (la campana consulta cada 60 s).
notificacionesRouter.get("/contador", auth, controlador.contarNoLeidas);

// RF-12 · Marcar como leídas las indicadas (una o varias); los ids ajenos se ignoran.
notificacionesRouter.post("/leidas", auth, validate(marcarLeidasSchema), controlador.marcarLeidas);

// RF-12 · Marcar como leídas todas las propias.
notificacionesRouter.post("/leidas/todas", auth, controlador.marcarTodas);
