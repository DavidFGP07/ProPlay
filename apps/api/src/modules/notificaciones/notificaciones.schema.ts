/**
 * Contrato del módulo `notificaciones`.
 *
 * Los esquemas se definen una sola vez en @proplay/shared y se re-exportan
 * aquí: el backend valida con ellos y el frontend construye sus formularios
 * con los mismos. No declares esquemas nuevos en este archivo.
 */
export {
  marcarLeidasSchema,
  paginacionQuerySchema,
  notificacionSchema,
} from "@proplay/shared";

export type {
  MarcarLeidasInput,
  Notificacion,
} from "@proplay/shared";
