import { NotImplementedError } from "../../utils/errors";

/**
 * Acceso a datos del módulo `scouting`.
 *
 * Andamiaje: cuando se implemente, este archivo será el ÚNICO del módulo que
 * importe `prisma` desde ../../config/prisma. Ni el controlador ni el servicio
 * pueden tocar Prisma directamente.
 */

/** TODO: Buscar jugadores por juego, rol, región, KDA, win rate y nivel de habilidad. */
export async function buscarJugadores(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "scouting.repository.buscarJugadores todavía no consulta la base de datos",
  );
}

/** TODO: Devolver la ficha ampliada de un jugador (perfil, habilidades y estadísticas). */
export async function fichaJugador(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "scouting.repository.fichaJugador todavía no consulta la base de datos",
  );
}

/** TODO: Guardar los filtros de una búsqueda para reutilizarla. */
export async function guardarBusqueda(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "scouting.repository.guardarBusqueda todavía no consulta la base de datos",
  );
}

/** TODO: Listar las búsquedas guardadas del usuario autenticado. */
export async function listarBusquedas(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "scouting.repository.listarBusquedas todavía no consulta la base de datos",
  );
}
