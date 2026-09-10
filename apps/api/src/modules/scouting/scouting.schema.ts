/**
 * Contrato del módulo `scouting`.
 *
 * Los esquemas se definen una sola vez en @proplay/shared y se re-exportan
 * aquí: el backend valida con ellos y el frontend construye sus formularios
 * con los mismos. No declares esquemas nuevos en este archivo.
 */
export {
  busquedaJugadoresSchema,
  guardarBusquedaSchema,
  paginacionQuerySchema,
  idParamSchema,
} from "@proplay/shared";

export type {
  BusquedaJugadores,
} from "@proplay/shared";
