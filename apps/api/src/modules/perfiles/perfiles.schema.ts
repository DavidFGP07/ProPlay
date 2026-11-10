/**
 * Contrato del módulo `perfiles`.
 *
 * Los esquemas se definen una sola vez en @proplay/shared y se re-exportan
 * aquí: el backend valida con ellos y el frontend construye sus formularios
 * con los mismos. No declares esquemas nuevos en este archivo.
 */
export {
  perfilJugadorSchema,
  perfilJugadorPublicoSchema,
  ubicacionJugadorSchema,
  paisDepartamentoSchema,
  perfilEquipoSchema,
  asignarHabilidadSchema,
  crearEndorsementSchema,
  vincularCuentaGamingSchema,
  vincularCuentaRiotSchema,
  verificarCuentaRiotSchema,
  cuentaGamingSchema,
  desafioVerificacionRiotSchema,
  desafioActivoRiotSchema,
  resultadoVerificacionRiotSchema,
  plataformaParamSchema,
  idParamSchema,
  habilidadSchema,
} from "@proplay/shared";

export type {
  PerfilJugadorInput,
  PerfilJugadorPublico,
  PerfilEquipoInput,
  AsignarHabilidadInput,
  VincularCuentaGamingInput,
  VincularCuentaRiotInput,
  VerificarCuentaRiotInput,
  CuentaGaming,
  DesafioVerificacionRiot,
  DesafioActivoRiot,
  ResultadoVerificacionRiot,
  Habilidad,
} from "@proplay/shared";
