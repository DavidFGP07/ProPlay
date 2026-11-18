import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import type { RangoPrisma } from "../../utils/pagination";

/**
 * Acceso a datos del módulo `notificaciones`. Único archivo del módulo que
 * importa `prisma`. Toda consulta va filtrada por `usuarioId`: nadie lee ni
 * marca las notificaciones de otro.
 */

const seleccion = {
  id: true,
  tipo: true,
  payload: true,
  leidaEn: true,
  creadoEn: true,
} satisfies Prisma.NotificacionSelect;

export type NotificacionDb = Prisma.NotificacionGetPayload<{ select: typeof seleccion }>;

export async function crear(datos: {
  usuarioId: string;
  tipo: string;
  payload: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.notificacion.create({ data: datos, select: { id: true } });
}

/** Las del usuario, de la más reciente a la más antigua, con el total. */
export async function listar(
  usuarioId: string,
  rango: Pick<RangoPrisma, "skip" | "take">,
): Promise<{ filas: NotificacionDb[]; total: number }> {
  const [filas, total] = await prisma.$transaction([
    prisma.notificacion.findMany({
      where: { usuarioId },
      orderBy: [{ creadoEn: "desc" }, { id: "desc" }],
      skip: rango.skip,
      take: rango.take,
      select: seleccion,
    }),
    prisma.notificacion.count({ where: { usuarioId } }),
  ]);
  return { filas, total };
}

export async function contarNoLeidas(usuarioId: string): Promise<number> {
  return prisma.notificacion.count({ where: { usuarioId, leidaEn: null } });
}

/**
 * Marca como leídas las indicadas que sean del usuario y no lo estuvieran
 * (sin `ids`, todas las suyas). Devuelve cuántas cambiaron.
 */
export async function marcarLeidas(usuarioId: string, ids?: string[]): Promise<number> {
  const { count } = await prisma.notificacion.updateMany({
    where: { usuarioId, leidaEn: null, ...(ids && { id: { in: ids } }) },
    data: { leidaEn: new Date() },
  });
  return count;
}
