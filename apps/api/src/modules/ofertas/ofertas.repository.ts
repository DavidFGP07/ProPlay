import { NotImplementedError } from "../../utils/errors";

/**
 * Acceso a datos del módulo `ofertas`.
 *
 * Andamiaje: cuando se implemente, este archivo será el ÚNICO del módulo que
 * importe `prisma` desde ../../config/prisma. Ni el controlador ni el servicio
 * pueden tocar Prisma directamente.
 */

/** TODO: Listar ofertas abiertas con filtros de juego, región, rol y estado. */
export async function listar(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "ofertas.repository.listar todavía no consulta la base de datos",
  );
}

/** TODO: Crear una oferta asociada al PerfilEquipo del usuario autenticado. */
export async function crear(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "ofertas.repository.crear todavía no consulta la base de datos",
  );
}

/** TODO: Devolver el detalle de una oferta. */
export async function obtener(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "ofertas.repository.obtener todavía no consulta la base de datos",
  );
}

/** TODO: Actualizar los datos o el estado de una oferta propia. */
export async function actualizar(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "ofertas.repository.actualizar todavía no consulta la base de datos",
  );
}

/** TODO: Registrar la postulación del jugador autenticado a una oferta. */
export async function postular(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "ofertas.repository.postular todavía no consulta la base de datos",
  );
}

/** TODO: Listar las postulaciones recibidas por una oferta propia. */
export async function listarPostulaciones(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "ofertas.repository.listarPostulaciones todavía no consulta la base de datos",
  );
}

/** TODO: Cambiar el estado de una postulación (revisión, aceptada, rechazada). */
export async function actualizarPostulacion(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "ofertas.repository.actualizarPostulacion todavía no consulta la base de datos",
  );
}
