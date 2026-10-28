import type { Prisma, Usuario } from "@prisma/client";
import type { Rol } from "@proplay/shared";
import { prisma } from "../../config/prisma";
import { calcularRango, type OpcionesPaginacion } from "../../utils/pagination";

/**
 * Único punto de acceso a Prisma para el módulo `usuarios`.
 * Ni el controlador ni el servicio hablan con la base de datos directamente.
 */

/** Campos que pueden salir hacia el cliente (nunca passwordHash). */
export const seleccionPublica = {
  id: true,
  email: true,
  nombre: true,
  rol: true,
  emailVerificado: true,
  activo: true,
  creadoEn: true,
} satisfies Prisma.UsuarioSelect;

export type UsuarioPublicoDb = Prisma.UsuarioGetPayload<{
  select: typeof seleccionPublica;
}>;

export interface DatosNuevoUsuario {
  email: string;
  passwordHash: string;
  nombre: string;
  rol: Rol;
  /** Autorización del tratamiento de datos (RNF-05). */
  avisoPrivacidadVersion: string;
  avisoPrivacidadAceptadoEn: Date;
  declaraMayorEdadEn: Date;
}

export interface DatosAuditoria {
  accion: string;
  entidad: string;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Crea el usuario y, en la misma transacción, el perfil que le corresponde por
 * rol (PerfilJugador para JUGADOR, PerfilEquipo para EQUIPO) y la traza de
 * auditoría del alta. Si la traza falla no queda un usuario sin prueba de su
 * autorización (Decreto 1377 de 2013).
 */
export async function crearConPerfil(
  datos: DatosNuevoUsuario,
  auditoria: DatosAuditoria,
): Promise<UsuarioPublicoDb> {
  return prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.create({
      data: datos,
      select: seleccionPublica,
    });

    if (datos.rol === "JUGADOR") {
      await tx.perfilJugador.create({ data: { usuarioId: usuario.id } });
    } else if (datos.rol === "EQUIPO") {
      await tx.perfilEquipo.create({
        data: { usuarioId: usuario.id, nombreOrg: datos.nombre },
      });
    }

    await tx.auditLog.create({
      data: {
        usuarioId: usuario.id,
        accion: auditoria.accion,
        entidad: auditoria.entidad,
        entidadId: usuario.id,
        metadata: auditoria.metadata,
      },
    });

    return usuario;
  });
}

export function buscarPorEmail(email: string): Promise<Usuario | null> {
  return prisma.usuario.findUnique({ where: { email } });
}

export function buscarPorId(id: string): Promise<UsuarioPublicoDb | null> {
  return prisma.usuario.findUnique({ where: { id }, select: seleccionPublica });
}

export function buscarConPasswordPorId(id: string): Promise<Usuario | null> {
  return prisma.usuario.findUnique({ where: { id } });
}

/** Datos para validar un refresco: los públicos más el último cambio de credenciales. */
export function buscarParaRefresco(
  id: string,
): Promise<(UsuarioPublicoDb & { credencialesCambiadasEn: Date | null }) | null> {
  return prisma.usuario.findUnique({
    where: { id },
    select: { ...seleccionPublica, credencialesCambiadasEn: true },
  });
}

/** Guarda la nueva contraseña y marca el momento del cambio de credenciales. */
export function cambiarPassword(
  id: string,
  passwordHash: string,
  cambiadasEn: Date,
): Promise<UsuarioPublicoDb> {
  return prisma.usuario.update({
    where: { id },
    data: { passwordHash, credencialesCambiadasEn: cambiadasEn },
    select: seleccionPublica,
  });
}

export function actualizar(
  id: string,
  datos: Prisma.UsuarioUpdateInput,
): Promise<UsuarioPublicoDb> {
  return prisma.usuario.update({
    where: { id },
    data: datos,
    select: seleccionPublica,
  });
}

/** Cuenta con lo necesario para decidir si puede pasar a administrador. */
export function buscarParaPromocion(email: string) {
  return prisma.usuario.findUnique({
    where: { email },
    select: {
      ...seleccionPublica,
      perfilJugador: { select: { id: true } },
      perfilEquipo: { select: { id: true } },
    },
  });
}

/**
 * Cambia el rol y deja su traza en AuditLog en la misma transacción: no puede
 * quedar un cambio de rol sin rastro, ni un rastro de un cambio que no ocurrió.
 */
export async function cambiarRolConAuditoria(
  id: string,
  rol: Rol,
  auditoria: DatosAuditoria,
): Promise<UsuarioPublicoDb> {
  return prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.update({
      where: { id },
      data: { rol },
      select: seleccionPublica,
    });

    await tx.auditLog.create({
      data: {
        usuarioId: id,
        accion: auditoria.accion,
        entidad: auditoria.entidad,
        entidadId: id,
        metadata: auditoria.metadata,
      },
    });

    return usuario;
  });
}

export interface FiltroUsuarios extends OpcionesPaginacion {
  rol?: Rol;
  q?: string;
}

export async function listar(filtro: FiltroUsuarios = {}) {
  const rango = calcularRango(filtro);

  const where: Prisma.UsuarioWhereInput = {
    ...(filtro.rol ? { rol: filtro.rol } : {}),
    ...(filtro.q
      ? {
          OR: [
            { nombre: { contains: filtro.q, mode: "insensitive" } },
            { email: { contains: filtro.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [registros, total] = await Promise.all([
    prisma.usuario.findMany({
      where,
      select: seleccionPublica,
      orderBy: { creadoEn: "desc" },
      skip: rango.skip,
      take: rango.take,
    }),
    prisma.usuario.count({ where }),
  ]);

  return { registros, total, rango };
}

/** Traza de auditoría (registro, login, cambios de rol...). */
export async function registrarAuditoria(datos: {
  usuarioId?: string;
  accion: string;
  entidad: string;
  entidadId?: string;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      usuarioId: datos.usuarioId ?? null,
      accion: datos.accion,
      entidad: datos.entidad,
      entidadId: datos.entidadId ?? null,
      metadata: datos.metadata,
    },
  });
}
