import * as repositorio from "./ofertas.repository";

/**
 * Lógica de negocio del módulo `ofertas`: Ofertas publicadas por los equipos y postulaciones de los jugadores.
 *
 * Andamiaje: cada función delega en el repositorio, que todavía lanza
 * NotImplementedError (501).
 */

/** TODO: Listar ofertas abiertas con filtros de juego, región, rol y estado. */
export async function listar(datos?: unknown) {
  return repositorio.listar(datos);
}

/** TODO: Crear una oferta asociada al PerfilEquipo del usuario autenticado. */
export async function crear(datos?: unknown) {
  return repositorio.crear(datos);
}

/** TODO: Devolver el detalle de una oferta. */
export async function obtener(datos?: unknown) {
  return repositorio.obtener(datos);
}

/** TODO: Actualizar los datos o el estado de una oferta propia. */
export async function actualizar(datos?: unknown) {
  return repositorio.actualizar(datos);
}

/** TODO: Registrar la postulación del jugador autenticado a una oferta. */
export async function postular(datos?: unknown) {
  return repositorio.postular(datos);
}

/** TODO: Listar las postulaciones recibidas por una oferta propia. */
export async function listarPostulaciones(datos?: unknown) {
  return repositorio.listarPostulaciones(datos);
}

/** TODO: Cambiar el estado de una postulación (revisión, aceptada, rechazada). */
export async function actualizarPostulacion(datos?: unknown) {
  return repositorio.actualizarPostulacion(datos);
}
