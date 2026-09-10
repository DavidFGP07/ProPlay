import bcrypt from "bcrypt";
import type { AuthResponse, LoginInput, RegisterInput, Rol, UsuarioPublico } from "@proplay/shared";
import { logger } from "../../config/logger";
import {
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
import type { ActualizarUsuarioInput } from "./usuarios.schema";

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
  const creado = await repositorio.crearConPerfil({
    email: datos.email,
    passwordHash,
    nombre: datos.nombre,
    rol: datos.rol,
  });

  const usuario = aPublico(creado);
  await repositorio.registrarAuditoria({
    usuarioId: usuario.id,
    accion: "USUARIO_REGISTRADO",
    entidad: "Usuario",
    entidadId: usuario.id,
    metadata: { rol: usuario.rol },
  });
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
  const usuario = await repositorio.buscarPorId(payload.sub);

  if (!usuario) {
    throw new UnauthorizedError("La cuenta de esta sesión ya no existe");
  }
  if (!usuario.activo) {
    throw new ForbiddenError("Tu cuenta está suspendida");
  }

  return crearSesion(aPublico(usuario));
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
