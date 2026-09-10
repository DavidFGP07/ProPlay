import { Router } from "express";
import { auth } from "../../middleware/auth";
import { rbac } from "../../middleware/rbac";
import { validate } from "../../middleware/validate";
import * as controlador from "./admin.controller";
import {
  cambiarRolSchema,
  paginacionQuerySchema,
  suspenderUsuarioSchema,
} from "./admin.schema";

/**
 * Rutas del módulo `admin`: /api/v1/admin
 * Panel de administración: métricas, moderación y auditoría.
 */
export const adminRouter = Router();

// TODO: Devolver los totales de usuarios, jugadores, equipos, ofertas y postulaciones.
adminRouter.get(
  "/metricas",
  auth,
  rbac("ADMIN"),
  controlador.metricas,
);

// TODO: Cambiar el rol de un usuario y dejar traza en AuditLog.
adminRouter.post(
  "/usuarios/rol",
  auth,
  rbac("ADMIN"),
  validate(cambiarRolSchema),
  controlador.cambiarRol,
);

// TODO: Desactivar una cuenta indicando el motivo y dejar traza en AuditLog.
adminRouter.post(
  "/usuarios/suspender",
  auth,
  rbac("ADMIN"),
  validate(suspenderUsuarioSchema),
  controlador.suspender,
);

// TODO: Listar el AuditLog paginado y filtrable.
adminRouter.get(
  "/auditoria",
  auth,
  rbac("ADMIN"),
  validate(paginacionQuerySchema, "query"),
  controlador.auditoria,
);
