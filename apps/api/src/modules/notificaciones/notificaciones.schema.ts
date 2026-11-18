/**
 * Contrato del módulo `notificaciones` (RF-12).
 *
 * Los esquemas se definen una sola vez en @proplay/shared y se re-exportan
 * aquí: el backend valida con ellos y el frontend tipa sus respuestas con los
 * mismos. No declares esquemas nuevos en este archivo.
 */
export {
  contadorNotificacionesSchema,
  listarNotificacionesQuerySchema,
  marcarLeidasSchema,
  notificacionSchema,
  notificacionesMarcadasSchema,
  notificacionesSchema,
} from "@proplay/shared";

export type {
  ContadorNotificaciones,
  MarcarLeidasInput,
  Notificacion,
  Notificaciones,
  NotificacionesMarcadas,
} from "@proplay/shared";
