/**
 * Contrato del módulo `matching`.
 *
 * Los esquemas se definen una sola vez en @proplay/shared y se re-exportan
 * aquí: el backend valida con ellos y el frontend construye sus formularios
 * con los mismos. No declares esquemas nuevos en este archivo.
 */
export {
  calcularMatchingSchema,
  idParamSchema,
  matchingSchema,
  desgloseMatchingSchema,
} from "@proplay/shared";

export type {
  CalcularMatchingInput,
  DesgloseMatching,
  Matching,
} from "@proplay/shared";
