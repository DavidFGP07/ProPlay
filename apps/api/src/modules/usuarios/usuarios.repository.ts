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
}

/**
 * Crea el usuario y, en la misma transacción, el perfil que le corresponde por
 * rol: PerfilJugador para JUGADOR y PerfilEquipo para EQUIPO.
 */
export async function crearConPerfil(
  datos: DatosNuevoUsuario,
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
