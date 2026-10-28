import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { NotImplementedError } from "../../utils/errors";

/**
 * Único punto de acceso a Prisma para el módulo `perfiles`.
 * Ni el controlador ni el servicio hablan con la base de datos directamente.
 */

/** Campos del perfil del jugador que puede ver su dueño. */
const seleccionJugador = {
  id: true,
  usuarioId: true,
  bio: true,
  pais: true,
  departamento: true,
  disponibilidadHoras: true,
  dispuestoRelocalizar: true,
  avatarUrl: true,
  creadoEn: true,
  actualizadoEn: true,
} satisfies Prisma.PerfilJugadorSelect;

/** Campos del perfil del equipo que puede ver su dueño. */
const seleccionEquipo = {
  id: true,
  usuarioId: true,
  nombreOrg: true,
  descripcion: true,
  sitioWeb: true,
  logoUrl: true,
  creadoEn: true,
  actualizadoEn: true,
} satisfies Prisma.PerfilEquipoSelect;

/**
 * Campos del perfil público (lista blanca, RF-05). Sólo las cuentas
 * verificadas, y de ellas plataforma y fecha: nunca el id externo, el handle
 * ni los tokens.
 */
const seleccionJugadorPublico = {
  id: true,
  bio: true,
  pais: true,
  departamento: true,
  avatarUrl: true,
  usuario: { select: { nombre: true } },
  cuentasGaming: {
    where: { verificadaEn: { not: null } },
    select: { plataforma: true, verificadaEn: true },
    orderBy: { verificadaEn: "asc" },
  },
} satisfies Prisma.PerfilJugadorSelect;

export type PerfilJugadorDb = Prisma.PerfilJugadorGetPayload<{
  select: typeof seleccionJugador;
}>;
export type PerfilEquipoDb = Prisma.PerfilEquipoGetPayload<{
  select: typeof seleccionEquipo;
}>;

export type PerfilJugadorPublicoDb = Prisma.PerfilJugadorGetPayload<{
  select: typeof seleccionJugadorPublico;
}>;

/** Perfil público por id de perfil; nulo si no existe o la cuenta está inactiva. */
export async function buscarJugadorPublico(
  perfilId: string,
): Promise<PerfilJugadorPublicoDb | null> {
  return prisma.perfilJugador.findFirst({
    where: { id: perfilId, usuario: { activo: true } },
    select: seleccionJugadorPublico,
  });
}

export async function buscarJugadorPorUsuario(
  usuarioId: string,
): Promise<PerfilJugadorDb | null> {
  return prisma.perfilJugador.findUnique({
    where: { usuarioId },
    select: seleccionJugador,
  });
}

export async function buscarEquipoPorUsuario(
  usuarioId: string,
): Promise<PerfilEquipoDb | null> {
  return prisma.perfilEquipo.findUnique({
    where: { usuarioId },
    select: seleccionEquipo,
  });
}

export async function actualizarJugador(
  usuarioId: string,
  datos: Prisma.PerfilJugadorUpdateInput,
): Promise<PerfilJugadorDb> {
  return prisma.perfilJugador.update({
    where: { usuarioId },
    data: datos,
    select: seleccionJugador,
  });
}

export async function actualizarEquipo(
  usuarioId: string,
  datos: Prisma.PerfilEquipoUpdateInput,
): Promise<PerfilEquipoDb> {
  return prisma.perfilEquipo.update({
    where: { usuarioId },
    data: datos,
    select: seleccionEquipo,
  });
}

/** TODO: Devolver el catálogo de habilidades (técnicas y blandas). */
export async function catalogoHabilidades(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "perfiles.repository.catalogoHabilidades todavía no consulta la base de datos",
  );
}

/** TODO: Asociar una habilidad al perfil del jugador con su nivel 1-5. */
export async function asignarHabilidad(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "perfiles.repository.asignarHabilidad todavía no consulta la base de datos",
  );
}

/** TODO: Registrar el endorsement de una HabilidadJugador por parte de otro usuario. */
export async function endosar(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "perfiles.repository.endosar todavía no consulta la base de datos",
  );
}

/** TODO: Vincular una cuenta externa vía OAuth y guardar sus tokens cifrados. */
export async function vincularCuenta(_datos?: unknown): Promise<never> {
  throw new NotImplementedError(
    "perfiles.repository.vincularCuenta todavía no consulta la base de datos",
  );
}
