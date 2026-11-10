import type { Plataforma, Prisma, RangoLol } from "@prisma/client";
import { prisma } from "../../config/prisma";

/**
 * Acceso a datos del módulo `estadisticas`. Único archivo del módulo que
 * importa `prisma`.
 *
 * Lee `PerfilJugador` y `CuentaGaming`, que son del módulo `perfiles`, porque
 * `estadisticas` depende de él (CLAUDE.md §3.3); nunca al revés.
 */

const seleccionEstadistica = {
  id: true,
  jugadorId: true,
  juego: true,
  rol: true,
  rango: true,
  partidas: true,
  victorias: true,
  kda: true,
  winRate: true,
  metricas: true,
  fuente: true,
  capturadaEn: true,
} satisfies Prisma.EstadisticaSelect;

export type EstadisticaDb = Prisma.EstadisticaGetPayload<{
  select: typeof seleccionEstadistica;
}>;

/** Id del perfil de jugador del usuario, o null. */
export async function idJugadorDeUsuario(usuarioId: string): Promise<string | null> {
  const perfil = await prisma.perfilJugador.findUnique({
    where: { usuarioId },
    select: { id: true },
  });
  return perfil?.id ?? null;
}

/** true si el perfil existe y su cuenta está activa (mismo criterio que el perfil público). */
export async function existeJugadorActivo(jugadorId: string): Promise<boolean> {
  const perfil = await prisma.perfilJugador.findFirst({
    where: { id: jugadorId, usuario: { activo: true } },
    select: { id: true },
  });
  return perfil !== null;
}

/** Cuenta verificada del jugador en la plataforma, con lo necesario para la ingesta. */
export async function cuentaVerificada(jugadorId: string, plataforma: Plataforma) {
  return prisma.cuentaGaming.findFirst({
    where: { jugadorId, plataforma, verificadaEn: { not: null } },
    select: {
      id: true,
      externalId: true,
      accessToken: true,
      servidor: true,
      sincronizadaEn: true,
      intentoSincronizacionEn: true,
    },
  });
}

/**
 * Reserva un intento de sincronización: marca `intentoSincronizacionEn` sólo
 * si el anterior es más antiguo que `desde` (o no hay). La comprobación y la
 * marca son una sola actualización condicionada, así dos peticiones a la vez
 * no pueden pasar las dos. Devuelve `true` si el intento quedó reservado.
 */
export async function reservarIntentoSincronizacion(
  cuentaId: string,
  ahora: Date,
  desde: Date,
): Promise<boolean> {
  const { count } = await prisma.cuentaGaming.updateMany({
    where: {
      id: cuentaId,
      OR: [{ intentoSincronizacionEn: null }, { intentoSincronizacionEn: { lte: desde } }],
    },
    data: { intentoSincronizacionEn: ahora },
  });
  return count === 1;
}

/** Última captura del jugador para un juego y una fuente. */
export async function ultimaEstadistica(
  jugadorId: string,
  juego: string,
  fuente: Plataforma,
): Promise<EstadisticaDb | null> {
  return prisma.estadistica.findFirst({
    where: { jugadorId, juego, fuente },
    orderBy: { capturadaEn: "desc" },
    select: seleccionEstadistica,
  });
}

export interface NuevaEstadistica {
  juego: string;
  rol: string | null;
  rango: RangoLol | null;
  partidas: number;
  victorias: number;
  kda: number;
  winRate: number;
  metricas: Prisma.InputJsonValue;
  capturadaEn: Date;
}

/**
 * Guarda las capturas nuevas, ligadas a la cuenta de la que salen (`cuentaId`),
 * y marca la cuenta como sincronizada, en una sola transacción: o queda todo o
 * nada.
 */
export async function guardarSincronizacion(datos: {
  jugadorId: string;
  cuentaId: string;
  fuente: Plataforma;
  nuevas: NuevaEstadistica[];
  sincronizadaEn: Date;
}): Promise<EstadisticaDb[]> {
  const { jugadorId, cuentaId, fuente, nuevas, sincronizadaEn } = datos;
  return prisma.$transaction(async (tx) => {
    const creadas: EstadisticaDb[] = [];
    for (const nueva of nuevas) {
      creadas.push(
        await tx.estadistica.create({
          data: { ...nueva, jugadorId, fuente, cuentaId },
          select: seleccionEstadistica,
        }),
      );
    }
    await tx.cuentaGaming.update({ where: { id: cuentaId }, data: { sincronizadaEn } });
    return creadas;
  });
}

/** Capturas del jugador, de la más reciente a la más antigua. */
export async function listarPorJugador(
  jugadorId: string,
  filtro: { juego?: string; desde?: Date; hasta?: Date },
  limite: number,
): Promise<EstadisticaDb[]> {
  return prisma.estadistica.findMany({
    where: {
      jugadorId,
      ...(filtro.juego && { juego: filtro.juego }),
      ...((filtro.desde || filtro.hasta) && {
        capturadaEn: {
          ...(filtro.desde && { gte: filtro.desde }),
          ...(filtro.hasta && { lte: filtro.hasta }),
        },
      }),
    },
    orderBy: { capturadaEn: "desc" },
    take: limite,
    select: seleccionEstadistica,
  });
}

/** Las dos capturas más recientes de cada juego y fuente del jugador. */
export async function dosUltimasPorJuego(jugadorId: string): Promise<EstadisticaDb[]> {
  const grupos = await prisma.estadistica.groupBy({
    by: ["juego", "fuente"],
    where: { jugadorId },
  });
  const porGrupo = await Promise.all(
    grupos.map((grupo) =>
      prisma.estadistica.findMany({
        where: { jugadorId, juego: grupo.juego, fuente: grupo.fuente },
        orderBy: { capturadaEn: "desc" },
        take: 2,
        select: seleccionEstadistica,
      }),
    ),
  );
  return porGrupo.flat();
}
