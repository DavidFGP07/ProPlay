import { asyncHandler } from "../../utils/asyncHandler";
import * as servicio from "./matching.service";

/**
 * Controladores del módulo `matching`: sólo traducen entre HTTP y el
 * servicio. Andamiaje: todos responden 501 NOT_IMPLEMENTED por ahora.
 */

/**
 * POST /api/v1/matching/calcular
 * TODO: Calcular y persistir el ranking de jugadores compatibles con una oferta.
 */
export const calcular = asyncHandler(async (req, res) => {
  res.json(await servicio.calcular(req.body ?? req.validado));
});

/**
 * GET /api/v1/matching/oferta/:id
 * TODO: Devolver el ranking ya calculado de una oferta, ordenado por puntaje.
 */
export const rankingPorOferta = asyncHandler(async (req, res) => {
  res.json(await servicio.rankingPorOferta(req.body ?? req.validado));
});

/**
 * GET /api/v1/matching/jugador/me
 * TODO: Devolver las ofertas más compatibles con el jugador autenticado.
 */
export const ofertasCompatibles = asyncHandler(async (req, res) => {
  res.json(await servicio.ofertasCompatibles(req.body ?? req.validado));
});
