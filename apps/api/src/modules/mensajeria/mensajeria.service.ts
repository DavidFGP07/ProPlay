import * as repositorio from "./mensajeria.repository";

/**
 * Lógica de negocio del módulo `mensajeria`: Conversaciones y mensajes 1:1 y de equipo.
 *
 * Andamiaje: cada función delega en el repositorio, que todavía lanza
 * NotImplementedError (501).
 */

/** TODO: Listar las conversaciones del usuario autenticado con su último mensaje. */
export async function listarConversaciones(datos?: unknown) {
  return repositorio.listarConversaciones(datos);
}

/** TODO: Abrir una conversación con uno o varios participantes. */
export async function crearConversacion(datos?: unknown) {
  return repositorio.crearConversacion(datos);
}

/** TODO: Listar los mensajes de una conversación en la que participa el usuario. */
export async function listarMensajes(datos?: unknown) {
  return repositorio.listarMensajes(datos);
}

/** TODO: Publicar un mensaje en la conversación y notificar a los participantes. */
export async function enviarMensaje(datos?: unknown) {
  return repositorio.enviarMensaje(datos);
}
