import { NotImplementedError } from "../../utils/errors";

/**
 * Acceso a datos del módulo `perfiles`.
 *
 * Andamiaje: cuando se implemente, este archivo será el ÚNICO del módulo que
 * importe `prisma` desde ../../config/prisma. Ni el controlador ni el servicio
 * pueden tocar Prisma directamente.
 */

/** TODO: Devolver el perfil (jugador o equipo) del usuario autenticado. */
export async function obtenerPropio(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "perfiles.repository.obtenerPropio todavía no consulta la base de datos",
  );
}

/** TODO: Actualizar el PerfilJugador del usuario autenticado. */
export async function actualizarJugador(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "perfiles.repository.actualizarJugador todavía no consulta la base de datos",
  );
}

/** TODO: Actualizar el PerfilEquipo del usuario autenticado. */
export async function actualizarEquipo(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "perfiles.repository.actualizarEquipo todavía no consulta la base de datos",
  );
}

/** TODO: Devolver el catálogo de habilidades (técnicas y blandas). */
export async function catalogoHabilidades(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "perfiles.repository.catalogoHabilidades todavía no consulta la base de datos",
  );
}

/** TODO: Asociar una habilidad al perfil del jugador con su nivel 1-5. */
export async function asignarHabilidad(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "perfiles.repository.asignarHabilidad todavía no consulta la base de datos",
  );
}

/** TODO: Registrar el endorsement de una HabilidadJugador por parte de otro usuario. */
export async function endosar(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "perfiles.repository.endosar todavía no consulta la base de datos",
  );
}

/** TODO: Vincular una cuenta externa vía OAuth y guardar sus tokens cifrados. */
export async function vincularCuenta(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "perfiles.repository.vincularCuenta todavía no consulta la base de datos",
  );
}

/** TODO: Devolver el perfil público de un usuario por su id. */
export async function obtenerPublico(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "perfiles.repository.obtenerPublico todavía no consulta la base de datos",
  );
}
