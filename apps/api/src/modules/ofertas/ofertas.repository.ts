import { Prisma } from "@prisma/client";
import {
  FECHA_POR_ESTADO_POSTULACION,
  TRANSICIONES_POSTULACION,
  type EstadoOferta,
  type EstadoPostulacion,
} from "@proplay/shared";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/errors";
import type { RangoPrisma } from "../../utils/pagination";
import type { ListarOfertasQuery } from "./ofertas.schema";

/**
 * Acceso a datos del módulo `ofertas`: único archivo del módulo que importa
 * `prisma`. Cada cambio de estado escribe su traza en `AuditLog` en la misma
 * transacción (RNF-06).
 */

const seleccionOferta = {
  id: true,
  equipoId: true,
  titulo: true,
  juego: true,
  rol: true,
  rangoMinimo: true,
  modalidad: true,
  pais: true,
  departamento: true,
  horasSemana: true,
  descripcion: true,
  pesoTecnica: true,
  pesoExperiencia: true,
  pesoHabilidadesBlandas: true,
  pesoGeografica: true,
  pesoDisponibilidad: true,
  estado: true,
  publicadaEn: true,
  cerradaEn: true,
  creadoEn: true,
  actualizadoEn: true,
  // `usuarioId` sirve para comprobar la propiedad; no sale en la respuesta.
  equipo: { select: { id: true, nombreOrg: true, logoUrl: true, usuarioId: true } },
} satisfies Prisma.OfertaSelect;

export type OfertaDb = Prisma.OfertaGetPayload<{ select: typeof seleccionOferta }>;

const seleccionPostulacion = {
  id: true,
  ofertaId: true,
  jugadorId: true,
  estado: true,
  mensaje: true,
  creadoEn: true,
  revisadaEn: true,
  entrevistaEn: true,
  aceptadaEn: true,
  rechazadaEn: true,
  actualizadoEn: true,
} satisfies Prisma.PostulacionSelect;

export type PostulacionDb = Prisma.PostulacionGetPayload<{
  select: typeof seleccionPostulacion;
}>;

/** Del jugador, sólo campos de su perfil público (ver `postulacionRecibidaSchema`). */
const seleccionPostulacionRecibida = {
  ...seleccionPostulacion,
  jugador: {
    select: {
      id: true,
      avatarUrl: true,
      pais: true,
      departamento: true,
      usuario: { select: { nombre: true } },
    },
  },
} satisfies Prisma.PostulacionSelect;

export type PostulacionRecibidaDb = Prisma.PostulacionGetPayload<{
  select: typeof seleccionPostulacionRecibida;
}>;

const seleccionMiPostulacion = {
  ...seleccionPostulacion,
  oferta: {
    select: {
      id: true,
      titulo: true,
      rol: true,
      modalidad: true,
      estado: true,
      equipo: { select: { id: true, nombreOrg: true, logoUrl: true } },
    },
  },
} satisfies Prisma.PostulacionSelect;

export type MiPostulacionDb = Prisma.PostulacionGetPayload<{
  select: typeof seleccionMiPostulacion;
}>;

/** Estados de la postulación desde los que todavía se puede avanzar. */
const ESTADOS_NO_FINALES = (
  Object.keys(TRANSICIONES_POSTULACION) as EstadoPostulacion[]
).filter((estado) => TRANSICIONES_POSTULACION[estado].length > 0);

/** Otro proceso cambió el estado entre la lectura y la escritura. */
function transicionConcurrente(): AppError {
  return new AppError(
    409,
    "TRANSICION_NO_PERMITIDA",
    "El estado cambió mientras se procesaba la petición; vuelve a cargarlo",
  );
}

// ------------------------------------------------------------- perfiles

export async function buscarEquipoDeUsuario(usuarioId: string) {
  return prisma.perfilEquipo.findUnique({ where: { usuarioId }, select: { id: true } });
}

export async function buscarJugadorDeUsuario(usuarioId: string) {
  return prisma.perfilJugador.findUnique({ where: { usuarioId }, select: { id: true } });
}

// --------------------------------------------------------------- ofertas

export async function listarAbiertas(
  filtros: ListarOfertasQuery,
  rango: RangoPrisma,
): Promise<[OfertaDb[], number]> {
  const where: Prisma.OfertaWhereInput = { estado: "ABIERTA", ...filtros };
  return prisma.$transaction([
    prisma.oferta.findMany({
      where,
      select: seleccionOferta,
      // El id desempata: la paginación no repite ni salta ofertas con la misma fecha.
      orderBy: [{ publicadaEn: "desc" }, { id: "desc" }],
      skip: rango.skip,
      take: rango.take,
    }),
    prisma.oferta.count({ where }),
  ]);
}

export async function listarDeEquipo(
  equipoId: string,
  estado: EstadoOferta | undefined,
  rango: RangoPrisma,
): Promise<[(OfertaDb & { _count: { postulaciones: number } })[], number]> {
  const where: Prisma.OfertaWhereInput = { equipoId, ...(estado && { estado }) };
  return prisma.$transaction([
    prisma.oferta.findMany({
      where,
      select: { ...seleccionOferta, _count: { select: { postulaciones: true } } },
      orderBy: [{ creadoEn: "desc" }, { id: "desc" }],
      skip: rango.skip,
      take: rango.take,
    }),
    prisma.oferta.count({ where }),
  ]);
}

export async function buscarOferta(id: string): Promise<OfertaDb | null> {
  return prisma.oferta.findUnique({ where: { id }, select: seleccionOferta });
}

export async function crearOferta(
  usuarioId: string,
  datos: Prisma.OfertaUncheckedCreateInput,
): Promise<OfertaDb> {
  return prisma.$transaction(async (tx) => {
    const oferta = await tx.oferta.create({ data: datos, select: seleccionOferta });
    await tx.auditLog.create({
      data: {
        usuarioId,
        accion: "OFERTA_CREADA",
        entidad: "Oferta",
        entidadId: oferta.id,
        metadata: { estado: oferta.estado },
      },
    });
    return oferta;
  });
}

export async function actualizarOferta(
  id: string,
  usuarioId: string,
  datos: Prisma.OfertaUpdateInput,
): Promise<OfertaDb> {
  return prisma.$transaction(async (tx) => {
    const oferta = await tx.oferta.update({ where: { id }, data: datos, select: seleccionOferta });
    await tx.auditLog.create({
      data: {
        usuarioId,
        accion: "OFERTA_ACTUALIZADA",
        entidad: "Oferta",
        entidadId: id,
        metadata: { campos: Object.keys(datos) },
      },
    });
    return oferta;
  });
}

export async function contarAceptadas(ofertaId: string): Promise<number> {
  return prisma.postulacion.count({ where: { ofertaId, estado: "ACEPTADA" } });
}

/**
 * Cambia el estado de la oferta con su fecha. Si el estado nuevo es final, las
 * postulaciones que aún no lo son pasan a `RECHAZADA` con su `rechazadaEn` y
 * su traza (`origen: "cierre_oferta"`), todo en la misma transacción. La
 * actualización exige que el estado guardado siga siendo `de`: si otra
 * petición lo cambió antes, responde 409.
 */
export async function cambiarEstadoOferta(
  id: string,
  usuarioId: string,
  de: EstadoOferta,
  a: EstadoOferta,
  fechas: { publicadaEn?: Date; cerradaEn?: Date },
  esFinal: boolean,
): Promise<OfertaDb> {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.oferta.updateMany({
      where: { id, estado: de },
      data: { estado: a, ...fechas },
    });
    if (count === 0) throw transicionConcurrente();

    await tx.auditLog.create({
      data: {
        usuarioId,
        accion: "OFERTA_ESTADO_CAMBIADO",
        entidad: "Oferta",
        entidadId: id,
        metadata: { estadoAnterior: de, estadoNuevo: a },
      },
    });

    if (esFinal) {
      const pendientes = await tx.postulacion.findMany({
        where: { ofertaId: id, estado: { in: ESTADOS_NO_FINALES } },
        select: { id: true, estado: true },
      });
      if (pendientes.length > 0) {
        const ahora = fechas.cerradaEn ?? new Date();
        await tx.postulacion.updateMany({
          where: { id: { in: pendientes.map((p) => p.id) } },
          data: { estado: "RECHAZADA", rechazadaEn: ahora },
        });
        await tx.auditLog.createMany({
          data: pendientes.map((p) => ({
            usuarioId,
            accion: "POSTULACION_ESTADO_CAMBIADO",
            entidad: "Postulacion",
            entidadId: p.id,
            metadata: {
              estadoAnterior: p.estado,
              estadoNuevo: "RECHAZADA",
              origen: "cierre_oferta",
              ofertaId: id,
            },
          })),
        });
      }
    }

    return tx.oferta.findUniqueOrThrow({ where: { id }, select: seleccionOferta });
  });
}

// ---------------------------------------------------------- postulaciones

/** Registra la postulación; si el jugador ya se había postulado, 409. */
export async function crearPostulacion(
  usuarioId: string,
  datos: { ofertaId: string; jugadorId: string; mensaje: string | null },
): Promise<PostulacionDb> {
  try {
    return await prisma.$transaction(async (tx) => {
      const postulacion = await tx.postulacion.create({
        data: datos,
        select: seleccionPostulacion,
      });
      await tx.auditLog.create({
        data: {
          usuarioId,
          accion: "POSTULACION_CREADA",
          entidad: "Postulacion",
          entidadId: postulacion.id,
          metadata: { ofertaId: datos.ofertaId },
        },
      });
      return postulacion;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError(409, "POSTULACION_DUPLICADA", "Ya te postulaste a esta oferta");
    }
    throw error;
  }
}

export async function listarPostulacionesDeOferta(
  ofertaId: string,
): Promise<PostulacionRecibidaDb[]> {
  return prisma.postulacion.findMany({
    where: { ofertaId },
    select: seleccionPostulacionRecibida,
    orderBy: [{ creadoEn: "asc" }, { id: "asc" }],
  });
}

export async function listarPostulacionesDeJugador(
  jugadorId: string,
): Promise<MiPostulacionDb[]> {
  return prisma.postulacion.findMany({
    where: { jugadorId },
    select: seleccionMiPostulacion,
    orderBy: [{ creadoEn: "desc" }, { id: "desc" }],
  });
}

export async function buscarPostulacion(id: string) {
  return prisma.postulacion.findUnique({
    where: { id },
    select: {
      ...seleccionPostulacion,
      oferta: { select: { estado: true, equipo: { select: { usuarioId: true } } } },
    },
  });
}

/**
 * Cambia el estado de la postulación y guarda la fecha en su columna de
 * `FECHA_POR_ESTADO_POSTULACION`. Igual que con la oferta, exige que el estado
 * guardado siga siendo `de`.
 */
export async function cambiarEstadoPostulacion(
  id: string,
  usuarioId: string,
  de: EstadoPostulacion,
  a: EstadoPostulacion,
): Promise<PostulacionDb> {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.postulacion.updateMany({
      where: { id, estado: de },
      data: { estado: a, [FECHA_POR_ESTADO_POSTULACION[a]]: new Date() },
    });
    if (count === 0) throw transicionConcurrente();

    await tx.auditLog.create({
      data: {
        usuarioId,
        accion: "POSTULACION_ESTADO_CAMBIADO",
        entidad: "Postulacion",
        entidadId: id,
        metadata: { estadoAnterior: de, estadoNuevo: a, origen: "equipo" },
      },
    });
    return tx.postulacion.findUniqueOrThrow({ where: { id }, select: seleccionPostulacion });
  });
}
