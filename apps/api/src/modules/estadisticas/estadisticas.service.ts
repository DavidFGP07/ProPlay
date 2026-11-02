import {
  listarEstadisticasQuerySchema,
  sincronizarEstadisticasSchema,
} from "@proplay/shared";
import { descifrarOpcional } from "../../utils/crypto";
import { NotFoundError } from "../../utils/errors";
import { obtenerProveedor } from "../../integrations";
import * as repositorio from "./estadisticas.repository";
import type { EstadisticasExternas } from "../../integrations/GameStatsProvider";

/**
 * Lógica de negocio del módulo `estadisticas`: Métricas de rendimiento por
 * jugador, juego y periodo.
 *
 * El ciclo completo: el jugador (o el worker) pide la sincronización, el
 * GameStatsProvider de la plataforma descarga las estadísticas reales de las
 * APIs oficiales y se persisten en la base; los listados y resúmenes leen de
 * ahí.
 */

/** Resultado de una sincronización: cuántos registros se tocaron y cómo. */
export interface ResultadoIngesta {
  perfilesSincronizados: number;
  registrosActualizados: number;
  duracionMs: number;
  detalle: Array<{ perfilId: string; juego: string; partidas: number }>;
}

/** Sincroniza las estadísticas del jugador desde su provider de plataforma. */
export async function sincronizar(
  usuarioId: string,
  datos: unknown,
): Promise<ResultadoIngesta> {
  const cuerpo = sincronizarEstadisticasSchema.parse(datos);

  const inicio = Date.now();
  const perfil = await repositorio.buscarPerfilJugadorPorUsuario(usuarioId);
  if (!perfil) {
    throw new NotFoundError("Este usuario no tiene perfil");
  }

  const cuenta = await repositorio.buscarCuentaGaming(
    cuerpo.plataforma,
    perfil.id,
  );
  if (!cuenta) {
    throw new NotFoundError(
      "Este usuario no tiene la cuenta vinculada verificada",
    );
  }

  const estadisticas = await obtenerProveedor(cuenta.plataforma).obtenerEstadisticas(
    {
      externalId: cuenta.externalId,
      accessToken: descifrarOpcional(cuenta.accessToken),
      juego: cuerpo.juego,
    },
  );

  const guardadas: EstadisticasExternas[] = [];
  for (const estadistica of estadisticas) {
    await repositorio.guardarEstadistica({
      jugadorId: perfil.id,
      fuente: cuerpo.plataforma,
      estadistica,
    });
    guardadas.push(estadistica);
  }

  return {
    perfilesSincronizados: 1,
    registrosActualizados: guardadas.length,
    duracionMs: Date.now() - inicio,
    detalle: guardadas.map((estadistica) => ({
      perfilId: usuarioId,
      juego: estadistica.juego,
      partidas: estadistica.partidas,
    })),
  };
}

/** Lista las estadísticas de un jugador filtradas por juego y rango. */
export async function listarPorJugador(
  jugadorId: string,
  datos: unknown,
) {
  const query = listarEstadisticasQuerySchema.parse(datos ?? {});

  const estadisticas = await repositorio.listarEstadisticas(jugadorId, {
    juego: query.juego,
    desde: query.desde ?? undefined,
    hasta: query.hasta ?? undefined,
  });

  return estadisticas;
}

/** Resumen (KDA, win rate, partidas) de las estadísticas de un jugador. */
export async function resumenPorJugador(
  jugadorId: string,
  datos: unknown,
): Promise<EstadisticasExternas | null> {
  const query = listarEstadisticasQuerySchema.parse(datos ?? {});

  const estadisticas = await repositorio.listarEstadisticas(jugadorId, {
    juego: query.juego,
    desde: query.desde ?? undefined,
    hasta: query.hasta ?? undefined,
  });

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
