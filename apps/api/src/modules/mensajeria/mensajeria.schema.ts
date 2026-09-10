/**
 * Contrato del módulo `mensajeria`.
 *
 * Los esquemas se definen una sola vez en @proplay/shared y se re-exportan
 * aquí: el backend valida con ellos y el frontend construye sus formularios
 * con los mismos. No declares esquemas nuevos en este archivo.
 */
export {
  crearConversacionSchema,
  crearMensajeSchema,
  paginacionQuerySchema,
  idParamSchema,
  mensajeSchema,
} from "@proplay/shared";

export type {
  CrearConversacionInput,
  CrearMensajeInput,
  Mensaje,
} from "@proplay/shared";
