import { Router } from "express";
import { auth } from "../../middleware/auth";
import { rbac } from "../../middleware/rbac";
import { validate } from "../../middleware/validate";
import * as controlador from "./ofertas.controller";
import {
  actualizarOfertaSchema,
  actualizarPostulacionSchema,
  cambiarEstadoOfertaSchema,
  crearOfertaSchema,
  crearPostulacionSchema,
  idParamSchema,
  listarMisOfertasQuerySchema,
  listarOfertasQuerySchema,
  paginacionQuerySchema,
} from "./ofertas.schema";

/**
 * Rutas del módulo `ofertas`: /api/v1/ofertas
 * Ofertas publicadas por los equipos y postulaciones de los jugadores. El
 * equipo gestiona; el scout y el administrador sólo leen. Las rutas fijas
 * (`/me`, `/postulaciones/...`) van antes de `/:id`.
 */
export const ofertasRouter = Router();

// RF-07 · Explorar ofertas abiertas (paginadas, por fecha de publicación)
ofertasRouter.get(
  "/",
  auth,
  validate(listarOfertasQuerySchema.merge(paginacionQuerySchema), "query"),
  controlador.listar,
);

// RF-07 · Ofertas propias del equipo, en cualquier estado
ofertasRouter.get(
  "/me",
  auth,
  rbac("EQUIPO"),
  validate(listarMisOfertasQuerySchema.merge(paginacionQuerySchema), "query"),
  controlador.listarPropias,
);

// RF-10 · Postulaciones del jugador autenticado (pestaña de Mi perfil)
ofertasRouter.get(
  "/postulaciones/me",
  auth,
  rbac("JUGADOR"),
  controlador.misPostulaciones,
);

// RF-10 · Avanzar o rechazar una postulación de una oferta propia
ofertasRouter.patch(
  "/postulaciones/:id",
  auth,
  rbac("EQUIPO"),
  validate(idParamSchema, "params"),
  validate(actualizarPostulacionSchema),
  controlador.actualizarPostulacion,
);

// RF-07 · Crear una oferta con los pesos de las cinco dimensiones
ofertasRouter.post(
  "/",
  auth,
  rbac("EQUIPO"),
  validate(crearOfertaSchema),
  controlador.crear,
);

// RF-07 · Detalle de una oferta
ofertasRouter.get(
  "/:id",
  auth,
  validate(idParamSchema, "params"),
  controlador.obtener,
);

// RF-07 · Editar una oferta propia
ofertasRouter.patch(
  "/:id",
  auth,
  rbac("EQUIPO"),
  validate(idParamSchema, "params"),
  validate(actualizarOfertaSchema),
  controlador.actualizar,
);

// RF-07 · Publicar, cubrir o cerrar una oferta propia
ofertasRouter.patch(
  "/:id/estado",
  auth,
  rbac("EQUIPO"),
  validate(idParamSchema, "params"),
  validate(cambiarEstadoOfertaSchema),
  controlador.cambiarEstado,
);

// RF-10 · Postularse a una oferta abierta
ofertasRouter.post(
  "/:id/postulaciones",
  auth,
  rbac("JUGADOR"),
  validate(idParamSchema, "params"),
  validate(crearPostulacionSchema),
  controlador.postular,
);

// RF-10 · Postulaciones recibidas: el equipo, de sus ofertas; scout y admin, de cualquiera
ofertasRouter.get(
  "/:id/postulaciones",
  auth,
  rbac("EQUIPO", "SCOUT", "ADMIN"),
  validate(idParamSchema, "params"),
  controlador.listarPostulaciones,
);
