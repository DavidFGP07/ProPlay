import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import type { EstadisticasExternas } from "../../integrations/GameStatsProvider";
import type { Plataforma } from "@proplay/shared";

/**
 * Acceso a datos del módulo `estadisticas`.
 *
 * Andamiaje: al implementar, este archivo es el ÚNICO del módulo que importa
 * `prisma` desde ../../config/prisma. Ni el controlador ni el servicio hablan
 * con la base de datos directamente.
 */

/** Perfil del jugador al que pertenece la cuenta de juego. */
export async function buscarPerfilJugadorPorUsuario(
  usuarioId: string,
) {
  return prisma.perfilJugador.findUnique({
    where: { usuarioId },
  });
}

/** Cuenta de juego (Riot, Steam, ...) del jugador, con tokens cifrados. */
export async function buscarCuentaGaming(
  plataforma: Plataforma,
  jugadorId: string,
) {
  return prisma.cuentaGaming.findFirst({
    where: { jugadorId, plataforma },
  });
}

/** Persiste la estadística descargada de la API oficial del juego. */
export async function guardarEstadistica(input: {
  jugadorId: string;
  fuente: Plataforma;
  estadistica: EstadisticasExternas;
}) {
  const creada = await prisma.estadistica.create({
    data: {
      jugadorId: input.jugadorId,
      juego: input.estadistica.juego,
      rol: input.estadistica.rol,
      partidas: input.estadistica.partidas,
      victorias: input.estadistica.victorias,
      kda: input.estadistica.kda,
      winRate: input.estadistica.winRate,
      metricas: (input.estadistica.metricas ??
        undefined) as Prisma.InputJsonValue,
      fuente: input.fuente,
      capturadaEn: input.estadistica.capturadaEn,
    },
  });
  return creada;
}

/** Estadísticas de un jugador filtradas por juego y rango de fechas. */
export async function listarEstadisticas(
  jugadorId: string,
  query: { juego?: string; desde?: Date; hasta?: Date },
) {
  return prisma.estadistica.findMany({
    where: {
      jugadorId,
      ...(query.juego ? { juego: query.juego } : {}),
      ...(query.desde || query.hasta
        ? {
            capturadaEn: {
              ...(query.desde ? { gte: query.desde } : {}),
              ...(query.hasta ? { lte: query.hasta } : {}),
            },
          }
        : {}),
    },
    orderBy: { capturadaEn: "desc" },
  });
}

/** Resumen (KDA, win rate, partidas) de las estadísticas de un jugador. */
export async function resumenEstadisticas(
  jugadorId: string,
  juego?: string,
): Promise<EstadisticasExternas | null> {
  const estadisticas = await listarEstadisticas(jugadorId, { juego });
  const [primera] = estadisticas;
  if (!primera) {
    return null;
  }

  return {
    juego: primera.juego,
    rol: primera.rol,
    partidas: primera.partidas,
    victorias: primera.victorias,
    kda: primera.kda,
    winRate: primera.winRate,
    metricas: (primera.metricas ?? {}) as Record<string, number | string | null>,
    capturadaEn: primera.capturadaEn,
  };
}
