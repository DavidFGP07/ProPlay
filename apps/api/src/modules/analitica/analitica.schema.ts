/**
 * Contrato del módulo `analitica` (RF-13).
 *
 * Los esquemas se definen una sola vez en @proplay/shared y se re-exportan
 * aquí: el backend valida con ellos y el frontend tipa sus respuestas con los
 * mismos. No declares esquemas nuevos en este archivo.
 */
export {
  dimensionDecisivaSchema,
  embudoEquipoSchema,
  embudoOfertaSchema,
  ofertaAnaliticaParamsSchema,
  talentoVerificadoSchema,
} from "@proplay/shared";

export type {
  DimensionDecisiva,
  EmbudoEquipo,
  EmbudoOferta,
  TalentoVerificado,
} from "@proplay/shared";
