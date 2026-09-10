import * as repositorio from "./scouting.repository";

/**
 * Lógica de negocio del módulo `scouting`: Búsqueda y descubrimiento de jugadores por parte de scouts y equipos.
 *
 * Andamiaje: cada función delega en el repositorio, que todavía lanza
 * NotImplementedError (501).
 */

/** TODO: Buscar jugadores por juego, rol, región, KDA, win rate y nivel de habilidad. */
export async function buscarJugadores(datos?: unknown) {
  return repositorio.buscarJugadores(datos);
}

/** TODO: Devolver la ficha ampliada de un jugador (perfil, habilidades y estadísticas). */
export async function fichaJugador(datos?: unknown) {
  return repositorio.fichaJugador(datos);
}

/** TODO: Guardar los filtros de una búsqueda para reutilizarla. */
export async function guardarBusqueda(datos?: unknown) {
  return repositorio.guardarBusqueda(datos);
}

/** TODO: Listar las búsquedas guardadas del usuario autenticado. */
export async function listarBusquedas(datos?: unknown) {
  return repositorio.listarBusquedas(datos);
}
