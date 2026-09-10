import { NotImplementedError } from "../../utils/errors";

/**
 * Acceso a datos del módulo `mensajeria`.
 *
 * Andamiaje: cuando se implemente, este archivo será el ÚNICO del módulo que
 * importe `prisma` desde ../../config/prisma. Ni el controlador ni el servicio
 * pueden tocar Prisma directamente.
 */

/** TODO: Listar las conversaciones del usuario autenticado con su último mensaje. */
export async function listarConversaciones(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "mensajeria.repository.listarConversaciones todavía no consulta la base de datos",
  );
}

/** TODO: Abrir una conversación con uno o varios participantes. */
export async function crearConversacion(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "mensajeria.repository.crearConversacion todavía no consulta la base de datos",
  );
}

/** TODO: Listar los mensajes de una conversación en la que participa el usuario. */
export async function listarMensajes(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "mensajeria.repository.listarMensajes todavía no consulta la base de datos",
  );
}

/** TODO: Publicar un mensaje en la conversación y notificar a los participantes. */
export async function enviarMensaje(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "mensajeria.repository.enviarMensaje todavía no consulta la base de datos",
  );
}
