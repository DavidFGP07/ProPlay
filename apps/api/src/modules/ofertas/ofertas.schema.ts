/**
 * Contrato del módulo `ofertas`.
 *
 * Los esquemas se definen una sola vez en @proplay/shared y se re-exportan
 * aquí: el backend valida con ellos y el frontend construye sus formularios
 * con los mismos. No declares esquemas nuevos en este archivo.
 */
export {
  crearOfertaSchema,
  actualizarOfertaSchema,
  listarOfertasQuerySchema,
  crearPostulacionSchema,
  actualizarPostulacionSchema,
  paginacionQuerySchema,
  idParamSchema,
  ofertaSchema,
} from "@proplay/shared";

export type {
  CrearOfertaInput,
  ActualizarOfertaInput,
  ListarOfertasQuery,
  CrearPostulacionInput,
  Oferta,
} from "@proplay/shared";
