/**
 * Contrato del módulo `admin`.
 *
 * Los esquemas se definen una sola vez en @proplay/shared y se re-exportan
 * aquí: el backend valida con ellos y el frontend construye sus formularios
 * con los mismos. No declares esquemas nuevos en este archivo.
 */
export {
  cambiarRolSchema,
  suspenderUsuarioSchema,
  paginacionQuerySchema,
  metricasAdminSchema,
} from "@proplay/shared";

export type {
  CambiarRolInput,
  MetricasAdmin,
} from "@proplay/shared";
