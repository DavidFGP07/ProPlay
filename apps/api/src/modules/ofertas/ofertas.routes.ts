import { Router } from "express";
import { auth } from "../../middleware/auth";
import { rbac } from "../../middleware/rbac";
import { validate } from "../../middleware/validate";
import * as controlador from "./ofertas.controller";
import {
  actualizarOfertaSchema,
  actualizarPostulacionSchema,
  crearOfertaSchema,
  crearPostulacionSchema,
  idParamSchema,
  listarOfertasQuerySchema,
  paginacionQuerySchema,
} from "./ofertas.schema";

/**
 * Rutas del módulo `ofertas`: /api/v1/ofertas
 * Ofertas publicadas por los equipos y postulaciones de los jugadores.
 */
export const ofertasRouter = Router();

// TODO: Listar ofertas abiertas con filtros de juego, región, rol y estado.
ofertasRouter.get(
  "/",
  auth,
  validate(listarOfertasQuerySchema.merge(paginacionQuerySchema), "query"),
  controlador.listar,
);

// TODO: Crear una oferta asociada al PerfilEquipo del usuario autenticado.
ofertasRouter.post(
  "/",
  auth,
  rbac("EQUIPO"),
  validate(crearOfertaSchema),
  controlador.crear,
);

// TODO: Devolver el detalle de una oferta.
ofertasRouter.get(
  "/:id",
  auth,
  validate(idParamSchema, "params"),
  controlador.obtener,
);

// TODO: Actualizar los datos o el estado de una oferta propia.
ofertasRouter.patch(
  "/:id",
  auth,
  rbac("EQUIPO"),
  validate(actualizarOfertaSchema),
  controlador.actualizar,
);

// TODO: Registrar la postulación del jugador autenticado a una oferta.
ofertasRouter.post(
  "/:id/postulaciones",
  auth,
  rbac("JUGADOR"),
  validate(crearPostulacionSchema),
  controlador.postular,
);

// TODO: Listar las postulaciones recibidas por una oferta propia.
ofertasRouter.get(
  "/:id/postulaciones",
  auth,
  rbac("EQUIPO", "ADMIN"),
  validate(idParamSchema, "params"),
  controlador.listarPostulaciones,
);

// TODO: Cambiar el estado de una postulación (revisión, aceptada, rechazada).
ofertasRouter.patch(
  "/postulaciones/:id",
  auth,
  rbac("EQUIPO", "ADMIN"),
  validate(actualizarPostulacionSchema),
  controlador.actualizarPostulacion,
);
