import { NotImplementedError } from "../../utils/errors";

/**
 * Acceso a datos del módulo `admin`.
 *
 * Andamiaje: cuando se implemente, este archivo será el ÚNICO del módulo que
 * importe `prisma` desde ../../config/prisma. Ni el controlador ni el servicio
 * pueden tocar Prisma directamente.
 */

/** TODO: Devolver los totales de usuarios, jugadores, equipos, ofertas y postulaciones. */
export async function metricas(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "admin.repository.metricas todavía no consulta la base de datos",
  );
}

/** TODO: Cambiar el rol de un usuario y dejar traza en AuditLog. */
export async function cambiarRol(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "admin.repository.cambiarRol todavía no consulta la base de datos",
  );
}

/** TODO: Desactivar una cuenta indicando el motivo y dejar traza en AuditLog. */
export async function suspender(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "admin.repository.suspender todavía no consulta la base de datos",
  );
}

/** TODO: Listar el AuditLog paginado y filtrable. */
export async function auditoria(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "admin.repository.auditoria todavía no consulta la base de datos",
  );
}
