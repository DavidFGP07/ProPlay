import { asyncHandler } from "../../utils/asyncHandler";
import * as servicio from "./admin.service";

/**
 * Controladores del módulo `admin`: sólo traducen entre HTTP y el
 * servicio. Andamiaje: todos responden 501 NOT_IMPLEMENTED por ahora.
 */

/**
 * GET /api/v1/admin/metricas
 * TODO: Devolver los totales de usuarios, jugadores, equipos, ofertas y postulaciones.
 */
export const metricas = asyncHandler(async (req, res) => {
  res.json(await servicio.metricas(req.body ?? req.validado));
});

/**
 * POST /api/v1/admin/usuarios/rol
 * TODO: Cambiar el rol de un usuario y dejar traza en AuditLog.
 */
export const cambiarRol = asyncHandler(async (req, res) => {
  res.json(await servicio.cambiarRol(req.body ?? req.validado));
});

/**
 * POST /api/v1/admin/usuarios/suspender
 * TODO: Desactivar una cuenta indicando el motivo y dejar traza en AuditLog.
 */
export const suspender = asyncHandler(async (req, res) => {
  res.json(await servicio.suspender(req.body ?? req.validado));
});

/**
 * GET /api/v1/admin/auditoria
 * TODO: Listar el AuditLog paginado y filtrable.
 */
export const auditoria = asyncHandler(async (req, res) => {
  res.json(await servicio.auditoria(req.body ?? req.validado));
});
