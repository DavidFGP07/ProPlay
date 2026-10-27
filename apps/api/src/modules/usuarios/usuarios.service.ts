import bcrypt from "bcryptjs";
import {
  VERSION_AVISO_PRIVACIDAD,
  type AuthResponse,
  type LoginInput,
  type RegisterInput,
  type Rol,
  type UsuarioPublico,
} from "@proplay/shared";
import { logger } from "../../config/logger";
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "../../utils/errors";
import {
  firmarAccessToken,
  firmarRefreshToken,
  segundosDeVidaAcceso,
  verificarRefreshToken,
} from "../../utils/jwt";
import * as repositorio from "./usuarios.repository";
import type { ActualizarUsuarioInput, CambioContrasenaInput } from "./usuarios.schema";

/**
 * Lógica de negocio del módulo `usuarios`: registro, autenticación, refresco
 * de sesión y gestión de cuentas. El acceso a datos pasa siempre por
 * usuarios.repository.
 */

const RONDAS_BCRYPT = 12;

function aPublico(usuario: repositorio.UsuarioPublicoDb): UsuarioPublico {
  return {
    id: usuario.id,
    email: usuario.email,
    nombre: usuario.nombre,
    rol: usuario.rol as Rol,
    emailVerificado: usuario.emailVerificado,
    activo: usuario.activo,
    creadoEn: usuario.creadoEn,
  };
}

export interface SesionCreada {
  respuesta: AuthResponse;
  refreshToken: string;
}

function crearSesion(usuario: UsuarioPublico): SesionCreada {
  return {
    respuesta: {
      usuario,
      accessToken: firmarAccessToken({
        sub: usuario.id,
        email: usuario.email,
        rol: usuario.rol,
      }),
      expiraEn: segundosDeVidaAcceso(),
    },
    refreshToken: firmarRefreshToken(usuario.id),
  };
}

export async function registrar(datos: RegisterInput): Promise<SesionCreada> {
  const existente = await repositorio.buscarPorEmail(datos.email);
  if (existente) {
    throw new ConflictError("Ya existe una cuenta con ese correo");
  }

  const passwordHash = await bcrypt.hash(datos.password, RONDAS_BCRYPT);
  // RNF-05 · La versión aceptada es la vigente en el servidor, nunca una que
  // llegue en la petición. registerSchema ya exige las dos casillas.
  const aceptadoEn = new Date();
  const creado = await repositorio.crearConPerfil(
    {
      email: datos.email,
      passwordHash,
      nombre: datos.nombre,
      rol: datos.rol,
      avisoPrivacidadVersion: VERSION_AVISO_PRIVACIDAD,
      avisoPrivacidadAceptadoEn: aceptadoEn,
      declaraMayorEdadEn: aceptadoEn,
    },
    {
      accion: "USUARIO_REGISTRADO",
      entidad: "Usuario",
      metadata: {
        rol: datos.rol,
        avisoPrivacidadVersion: VERSION_AVISO_PRIVACIDAD,
        declaraMayorEdad: true,
      },
    },
  );

  const usuario = aPublico(creado);
  logger.info({ usuarioId: usuario.id, rol: usuario.rol }, "Usuario registrado");

  return crearSesion(usuario);
}

export async function login(datos: LoginInput): Promise<SesionCreada> {
  const usuario = await repositorio.buscarPorEmail(datos.email);

  // Mismo mensaje para email inexistente y contraseña incorrecta: no revelamos
  // qué correos están registrados.
  const credencialesInvalidas = new UnauthorizedError(
    "Correo o contraseña incorrectos",
  );

  if (!usuario) {
    // Comparación en vacío para igualar el tiempo de respuesta.
    await bcrypt.compare(datos.password, `$2b$${RONDAS_BCRYPT}$${"x".repeat(53)}`).catch(() => false);
    throw credencialesInvalidas;
  }

  const coincide = await bcrypt.compare(datos.password, usuario.passwordHash);
  if (!coincide) {
    throw credencialesInvalidas;
  }

  if (!usuario.activo) {
    throw new ForbiddenError("Tu cuenta está suspendida");
  }

  await repositorio.registrarAuditoria({
    usuarioId: usuario.id,
    accion: "LOGIN",
    entidad: "Usuario",
    entidadId: usuario.id,
  });

  return crearSesion(aPublico(usuario));
}

/** Emite un nuevo access token a partir del refresh token de la cookie. */
export async function refrescar(refreshToken?: string): Promise<SesionCreada> {
  if (!refreshToken) {
    throw new UnauthorizedError("No hay sesión activa");
  }

  const payload = verificarRefreshToken(refreshToken);
  const usuario = await repositorio.buscarParaRefresco(payload.sub);

  if (!usuario) {
    throw new UnauthorizedError("La cuenta de esta sesión ya no existe");
  }
  if (!usuario.activo) {
    throw new ForbiddenError("Tu cuenta está suspendida");
  }
  if (refrescoRevocado(payload.iat, usuario.credencialesCambiadasEn)) {
    throw new UnauthorizedError("Sesión expirada, vuelve a iniciar sesión");
  }

  return crearSesion(aPublico(usuario));
}

/**
 * Un refresh token queda revocado si se emitió antes del último cambio de
 * credenciales. `iat` va en segundos y la fecha en milisegundos: se compara en
 * segundos para que el token emitido en la misma respuesta del cambio siga
 * siendo válido.
 */
function refrescoRevocado(iat: number, cambiadasEn: Date | null): boolean {
  if (!cambiadasEn) return false;
  return iat < Math.floor(cambiadasEn.getTime() / 1000);
}

export async function obtenerPorId(id: string): Promise<UsuarioPublico> {
  const usuario = await repositorio.buscarPorId(id);
  if (!usuario) {
    throw new NotFoundError("Usuario no encontrado");
  }
  return aPublico(usuario);
}

export async function listar(filtro: repositorio.FiltroUsuarios) {
  const { registros, total, rango } = await repositorio.listar(filtro);
  return { usuarios: registros.map(aPublico), total, rango };
}

export async function actualizar(
  id: string,
  datos: ActualizarUsuarioInput,
): Promise<UsuarioPublico> {
  await obtenerPorId(id);
  const actualizado = await repositorio.actualizar(id, datos);
  return aPublico(actualizado);
}

/**
 * Cambio de la contraseña propia. Revoca todas las sesiones abiertas (los
 * refresh tokens emitidos antes del cambio) y devuelve una sesión nueva para
 * quien hizo el cambio, que así sigue dentro.
 */
export async function cambiarContrasena(
  id: string,
  datos: CambioContrasenaInput,
): Promise<SesionCreada> {
  const usuario = await repositorio.buscarConPasswordPorId(id);
  if (!usuario) {
    throw new UnauthorizedError("La cuenta de esta sesión ya no existe");
  }
  if (!usuario.activo) {
    throw new ForbiddenError("Tu cuenta está suspendida");
  }

  const coincide = await bcrypt.compare(datos.contrasenaActual, usuario.passwordHash);
  if (!coincide) {
    // 400 y no 401: el cliente trata un 401 como sesión caducada y cerraría
    // la sesión de quien sólo se equivocó de contraseña.
    throw new AppError(400, "CONTRASENA_ACTUAL_INVALIDA", "La contraseña actual no es correcta");
  }

  const passwordHash = await bcrypt.hash(datos.contrasenaNueva, RONDAS_BCRYPT);
  const actualizado = await repositorio.cambiarPassword(id, passwordHash, new Date());

  await repositorio.registrarAuditoria({
    usuarioId: id,
    accion: "CONTRASENA_CAMBIADA",
    entidad: "Usuario",
    entidadId: id,
  });
  logger.info({ usuarioId: id }, "Contraseña cambiada; sesiones anteriores revocadas");

  return crearSesion(aPublico(actualizado));
}
