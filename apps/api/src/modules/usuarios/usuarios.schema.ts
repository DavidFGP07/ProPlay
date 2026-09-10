/**
 * Contrato del módulo `usuarios`.
 *
 * No se define nada nuevo aquí: los esquemas viven en @proplay/shared para que
 * el frontend valide exactamente lo mismo. Este archivo sólo re-exporta lo que
 * usa el módulo, de modo que routes/controller importen desde un único sitio.
 */
export {
  actualizarUsuarioSchema,
  authResponseSchema,
  cambiarPasswordSchema,
  listarUsuariosQuerySchema,
  loginSchema,
  meResponseSchema,
  paginacionQuerySchema,
  refreshResponseSchema,
  registerSchema,
  usuarioPublicoSchema,
} from "@proplay/shared";

export type {
  ActualizarUsuarioInput,
  AuthResponse,
  LoginInput,
  MeResponse,
  Paginacion,
  RegisterInput,
  UsuarioPublico,
} from "@proplay/shared";
