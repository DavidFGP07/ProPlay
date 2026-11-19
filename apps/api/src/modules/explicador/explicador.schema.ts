/**
 * Contrato del módulo `explicador` (RF-11).
 *
 * Los esquemas se definen una sola vez en @proplay/shared y se re-exportan
 * aquí: el backend valida con ellos y el frontend tipa sus respuestas con los
 * mismos. No declares esquemas nuevos en este archivo.
 */
export {
  explicacionGeneradaParamsSchema,
  explicacionGeneradaSchema,
} from "@proplay/shared";
export type { ExplicacionGenerada, ExplicacionGeneradaParams } from "@proplay/shared";
