/**
 * Contrato del módulo `matching`.
 *
 * Los esquemas se definen una sola vez en @proplay/shared y se re-exportan
 * aquí: el backend valida con ellos y el frontend construye sus formularios
 * con los mismos. No declares esquemas nuevos en este archivo.
 */
export {
  candidatoRankingSchema,
  desgloseMatchingSchema,
  explicacionMatchingSchema,
  idParamSchema,
  matchingSchema,
  rankingOfertaQuerySchema,
  rankingOfertaSchema,
} from "@proplay/shared";

export type {
  CandidatoRanking,
  DesgloseMatching,
  ExplicacionMatching,
  Matching,
  RankingOferta,
  RankingOfertaQuery,
} from "@proplay/shared";
