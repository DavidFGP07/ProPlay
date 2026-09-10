import { NotImplementedError } from "../../utils/errors";

/**
 * Acceso a datos del módulo `matching`.
 *
 * Andamiaje: cuando se implemente, este archivo será el ÚNICO del módulo que
 * importe `prisma` desde ../../config/prisma. Ni el controlador ni el servicio
 * pueden tocar Prisma directamente.
 */

/** TODO: Calcular y persistir el ranking de jugadores compatibles con una oferta. */
export async function calcular(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "matching.repository.calcular todavía no consulta la base de datos",
  );
}

/** TODO: Devolver el ranking ya calculado de una oferta, ordenado por puntaje. */
export async function rankingPorOferta(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "matching.repository.rankingPorOferta todavía no consulta la base de datos",
  );
}

/** TODO: Devolver las ofertas más compatibles con el jugador autenticado. */
export async function ofertasCompatibles(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "matching.repository.ofertasCompatibles todavía no consulta la base de datos",
  );
}
