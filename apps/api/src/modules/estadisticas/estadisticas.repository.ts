import { NotImplementedError } from "../../utils/errors";

/**
 * Acceso a datos del módulo `estadisticas`.
 *
 * Andamiaje: cuando se implemente, este archivo será el ÚNICO del módulo que
 * importe `prisma` desde ../../config/prisma. Ni el controlador ni el servicio
 * pueden tocar Prisma directamente.
 */

/** TODO: Listar las estadísticas de un jugador filtradas por juego y rango de fechas. */
export async function listarPorJugador(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "estadisticas.repository.listarPorJugador todavía no consulta la base de datos",
  );
}

/** TODO: Agregar KDA, win rate y partidas del jugador por juego. */
export async function resumenPorJugador(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "estadisticas.repository.resumenPorJugador todavía no consulta la base de datos",
  );
}

/** TODO: Pedir al GameStatsProvider de la plataforma las estadísticas y persistirlas. */
export async function sincronizar(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "estadisticas.repository.sincronizar todavía no consulta la base de datos",
  );
}
