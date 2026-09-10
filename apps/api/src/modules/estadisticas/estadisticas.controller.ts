import { asyncHandler } from "../../utils/asyncHandler";
import * as servicio from "./estadisticas.service";

/**
 * Controladores del módulo `estadisticas`: sólo traducen entre HTTP y el
 * servicio. Andamiaje: todos responden 501 NOT_IMPLEMENTED por ahora.
 */

/**
 * GET /api/v1/estadisticas/jugador/:id
 * TODO: Listar las estadísticas de un jugador filtradas por juego y rango de fechas.
 */
export const listarPorJugador = asyncHandler(async (req, res) => {
  res.json(await servicio.listarPorJugador(req.body ?? req.validado));
});

/**
 * GET /api/v1/estadisticas/jugador/:id/resumen
 * TODO: Agregar KDA, win rate y partidas del jugador por juego.
 */
export const resumenPorJugador = asyncHandler(async (req, res) => {
  res.json(await servicio.resumenPorJugador(req.body ?? req.validado));
});

/**
 * POST /api/v1/estadisticas/sincronizar
 * TODO: Pedir al GameStatsProvider de la plataforma las estadísticas y persistirlas.
 */
export const sincronizar = asyncHandler(async (req, res) => {
  res.json(await servicio.sincronizar(req.body ?? req.validado));
});
