/**
 * Contrato del módulo `perfiles`.
 *
 * Los esquemas se definen una sola vez en @proplay/shared y se re-exportan
 * aquí: el backend valida con ellos y el frontend construye sus formularios
 * con los mismos. No declares esquemas nuevos en este archivo.
 */
export {
  perfilJugadorSchema,
  perfilEquipoSchema,
  asignarHabilidadSchema,
  crearEndorsementSchema,
  vincularCuentaGamingSchema,
  idParamSchema,
  habilidadSchema,
} from "@proplay/shared";

export type {
  PerfilJugadorInput,
  PerfilEquipoInput,
  AsignarHabilidadInput,
  VincularCuentaGamingInput,
  Habilidad,
} from "@proplay/shared";
