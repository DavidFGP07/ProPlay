import * as repositorio from "./admin.repository";

/**
 * Lógica de negocio del módulo `admin`: Panel de administración: métricas, moderación y auditoría.
 *
 * Andamiaje: cada función delega en el repositorio, que todavía lanza
 * NotImplementedError (501).
 */

/** TODO: Devolver los totales de usuarios, jugadores, equipos, ofertas y postulaciones. */
export async function metricas(datos?: unknown) {
  return repositorio.metricas(datos);
}

/** TODO: Cambiar el rol de un usuario y dejar traza en AuditLog. */
export async function cambiarRol(datos?: unknown) {
  return repositorio.cambiarRol(datos);
}

/** TODO: Desactivar una cuenta indicando el motivo y dejar traza en AuditLog. */
export async function suspender(datos?: unknown) {
  return repositorio.suspender(datos);
}

/** TODO: Listar el AuditLog paginado y filtrable. */
export async function auditoria(datos?: unknown) {
  return repositorio.auditoria(datos);
}
