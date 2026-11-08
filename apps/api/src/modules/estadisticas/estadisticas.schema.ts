/**
 * Contrato del módulo `estadisticas`.
 *
 * Los esquemas se definen una sola vez en @proplay/shared y se re-exportan
 * aquí: el backend valida con ellos y el frontend construye sus formularios
 * con los mismos. No declares esquemas nuevos en este archivo.
 */
export {
  idParamSchema,
  listarEstadisticasQuerySchema,
  sincronizarEstadisticasSchema,
  sincronizarEstadisticasRespuestaSchema,
  resumenEstadisticasSchema,
  estadisticaSchema,
  metricasLolSchema,
} from "@proplay/shared";

export type {
  Estadistica,
  ListarEstadisticasQuery,
  ResumenEstadisticas,
  SincronizarEstadisticasInput,
  SincronizarEstadisticasRespuesta,
} from "@proplay/shared";
