import * as repositorio from "./perfiles.repository";

/**
 * Lógica de negocio del módulo `perfiles`: Perfiles de jugador y de equipo, habilidades, endorsements y cuentas gaming.
 *
 * Andamiaje: cada función delega en el repositorio, que todavía lanza
 * NotImplementedError (501).
 */

/** TODO: Devolver el perfil (jugador o equipo) del usuario autenticado. */
export async function obtenerPropio(datos?: unknown) {
  return repositorio.obtenerPropio(datos);
}

/** TODO: Actualizar el PerfilJugador del usuario autenticado. */
export async function actualizarJugador(datos?: unknown) {
  return repositorio.actualizarJugador(datos);
}

/** TODO: Actualizar el PerfilEquipo del usuario autenticado. */
export async function actualizarEquipo(datos?: unknown) {
  return repositorio.actualizarEquipo(datos);
}

/** TODO: Devolver el catálogo de habilidades (técnicas y blandas). */
export async function catalogoHabilidades(datos?: unknown) {
  return repositorio.catalogoHabilidades(datos);
}

/** TODO: Asociar una habilidad al perfil del jugador con su nivel 1-5. */
export async function asignarHabilidad(datos?: unknown) {
  return repositorio.asignarHabilidad(datos);
}

/** TODO: Registrar el endorsement de una HabilidadJugador por parte de otro usuario. */
export async function endosar(datos?: unknown) {
  return repositorio.endosar(datos);
}

/** TODO: Vincular una cuenta externa vía OAuth y guardar sus tokens cifrados. */
export async function vincularCuenta(datos?: unknown) {
  return repositorio.vincularCuenta(datos);
}

/** TODO: Devolver el perfil público de un usuario por su id. */
export async function obtenerPublico(datos?: unknown) {
  return repositorio.obtenerPublico(datos);
}
