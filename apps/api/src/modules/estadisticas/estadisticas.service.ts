import * as repositorio from "./estadisticas.repository";

/**
 * Lógica de negocio del módulo `estadisticas`: Métricas de rendimiento por jugador, juego y periodo.
 *
 * Andamiaje: cada función delega en el repositorio, que todavía lanza
 * NotImplementedError (501).
 */

/** TODO: Listar las estadísticas de un jugador filtradas por juego y rango de fechas. */
export async function listarPorJugador(datos?: unknown) {
  return repositorio.listarPorJugador(datos);
}

/** TODO: Agregar KDA, win rate y partidas del jugador por juego. */
export async function resumenPorJugador(datos?: unknown) {
  return repositorio.resumenPorJugador(datos);
}

/** TODO: Pedir al GameStatsProvider de la plataforma las estadísticas y persistirlas. */
export async function sincronizar(datos?: unknown) {
  return repositorio.sincronizar(datos);
}
