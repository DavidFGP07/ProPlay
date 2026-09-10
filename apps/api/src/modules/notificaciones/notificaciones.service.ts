import * as repositorio from "./notificaciones.repository";

/**
 * Lógica de negocio del módulo `notificaciones`: Notificaciones in-app del usuario.
 *
 * Andamiaje: cada función delega en el repositorio, que todavía lanza
 * NotImplementedError (501).
 */

/** TODO: Listar las notificaciones del usuario autenticado, las no leídas primero. */
export async function listar(datos?: unknown) {
  return repositorio.listar(datos);
}

/** TODO: Devolver el número de notificaciones sin leer. */
export async function contarNoLeidas(datos?: unknown) {
  return repositorio.contarNoLeidas(datos);
}

/** TODO: Marcar como leídas las notificaciones indicadas. */
export async function marcarLeidas(datos?: unknown) {
  return repositorio.marcarLeidas(datos);
}
