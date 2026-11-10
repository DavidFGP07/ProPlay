import type { Request } from "express";
import { JUEGO_PILOTO } from "@proplay/shared";
import { asyncHandler } from "../../utils/asyncHandler";
import { UnauthorizedError } from "../../utils/errors";
import * as servicio from "./estadisticas.service";
import type {
  ListarEstadisticasQuery,
  SincronizarEstadisticasInput,
} from "./estadisticas.schema";

/**
 * Controladores del módulo `estadisticas`: sólo traducen entre HTTP y el
 * servicio.
 */

/**
 * GET /api/v1/estadisticas/jugador/:id
 * Histórico de capturas de un jugador, filtrable por juego y fechas.
 */
export const listarPorJugador = asyncHandler<Request<{ id: string }>>(async (req, res) => {
  const filtro = (req.validado?.query ?? {}) as ListarEstadisticasQuery;
  res.status(200).json(await servicio.listarPorJugador(req.params.id, filtro));
});

/**
 * GET /api/v1/estadisticas/jugador/:id/resumen
 * Última captura por juego con su tendencia.
 */
export const resumenPorJugador = asyncHandler<Request<{ id: string }>>(async (req, res) => {
  res.status(200).json(await servicio.resumenPorJugador(req.params.id));
});

/**
 * POST /api/v1/estadisticas/sincronizar
 * Encola la ingesta del jugador (202) y devuelve su estado.
 */
export const sincronizar = asyncHandler<
  Request<Record<string, string>, unknown, SincronizarEstadisticasInput>
>(async (req, res) => {
  if (!req.usuario) throw new UnauthorizedError();
  res.status(202).json(await servicio.solicitarSincronizacion(req.usuario.id, req.body));
});

/**
 * GET /api/v1/estadisticas/sincronizacion
 * Estado de la sincronización del jugador: en cola, en curso o terminada.
 */
export const estadoSincronizacion = asyncHandler(async (req, res) => {
  if (!req.usuario) throw new UnauthorizedError();
  res.status(200).json(
    await servicio.consultarSincronizacion(req.usuario.id, { plataforma: "RIOT", juego: JUEGO_PILOTO }),
  );
});
