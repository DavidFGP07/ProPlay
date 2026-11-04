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
  cambiarEstadoOfertaSchema,
  ubicacionOfertaSchema,
  listarOfertasQuerySchema,
  listarMisOfertasQuerySchema,
  crearPostulacionSchema,
  actualizarPostulacionSchema,
  paginacionQuerySchema,
  idParamSchema,
  ofertaSchema,
  ofertaPropiaSchema,
  postulacionSchema,
  postulacionRecibidaSchema,
  miPostulacionSchema,
} from "@proplay/shared";

export type {
  CrearOfertaInput,
  ActualizarOfertaInput,
  CambiarEstadoOfertaInput,
  ListarOfertasQuery,
  ListarMisOfertasQuery,
  CrearPostulacionInput,
  ActualizarPostulacionInput,
  Oferta,
  OfertaPropia,
  Postulacion,
  PostulacionRecibida,
  MiPostulacion,
} from "@proplay/shared";
