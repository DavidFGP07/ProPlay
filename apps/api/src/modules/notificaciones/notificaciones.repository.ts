import { NotImplementedError } from "../../utils/errors";

/**
 * Acceso a datos del módulo `notificaciones`.
 *
 * Andamiaje: cuando se implemente, este archivo será el ÚNICO del módulo que
 * importe `prisma` desde ../../config/prisma. Ni el controlador ni el servicio
 * pueden tocar Prisma directamente.
 */

/** TODO: Listar las notificaciones del usuario autenticado, las no leídas primero. */
export async function listar(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "notificaciones.repository.listar todavía no consulta la base de datos",
  );
}

/** TODO: Devolver el número de notificaciones sin leer. */
export async function contarNoLeidas(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "notificaciones.repository.contarNoLeidas todavía no consulta la base de datos",
  );
}

/** TODO: Marcar como leídas las notificaciones indicadas. */
export async function marcarLeidas(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "notificaciones.repository.marcarLeidas todavía no consulta la base de datos",
  );
}
