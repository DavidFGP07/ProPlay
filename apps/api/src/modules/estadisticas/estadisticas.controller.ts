import { asyncHandler } from "../../utils/asyncHandler";
import { UnauthorizedError } from "../../utils/errors";
import * as servicio from "./estadisticas.service";

/**
 * Controladores del módulo `estadisticas`: sólo traducen entre HTTP y el
 * servicio.
 */

/**
 * GET /api/v1/estadisticas/jugador/:id
 * Listar las estadísticas de un jugador filtradas por juego y rango de fechas.
 */
export const listarPorJugador = asyncHandler(async (req, res) => {
  const jugadorId = typeof req.params.id === "string" ? req.params.id : "";
  res.json(
    await servicio.listarPorJugador(jugadorId, req.validado?.query ?? req.body ?? {}),
  );
});

/**
 * GET /api/v1/estadisticas/jugador/:id/resumen
 * Agregar KDA, win rate y partidas del jugador por juego.
 */
export const resumenPorJugador = asyncHandler(async (req, res) => {
  const jugadorId = typeof req.params.id === "string" ? req.params.id : "";
  res.json(
    await servicio.resumenPorJugador(jugadorId, req.validado?.params ?? req.body ?? {}),
  );
});

/**
 * POST /api/v1/estadisticas/sincronizar
 * Pedir al GameStatsProvider de la plataforma las estadísticas y persistirlas.
 */
export const sincronizar = asyncHandler(async (req, res) => {
  const usuarioId = req.usuario?.id;
  if (!usuarioId) {
    throw new UnauthorizedError("Falta el token de acceso");
  }
  res.json(await servicio.sincronizar(usuarioId, req.body ?? req.validado));
});
