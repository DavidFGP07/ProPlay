import { queryValidada } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { UnauthorizedError } from "../../utils/errors";
import * as servicio from "./matching.service";
import { rankingOfertaQuerySchema } from "./matching.schema";

/**
 * Controladores del módulo `matching`: sólo traducen entre HTTP y el servicio.
 */

function actor(req: { usuario?: { id: string; rol: servicio.Actor["rol"] } }): servicio.Actor {
  if (!req.usuario) throw new UnauthorizedError("Sesión requerida");
  return { id: req.usuario.id, rol: req.usuario.rol };
}

/**
 * GET /api/v1/matching/ofertas/:id/ranking
 * RF-09 · Ranking de candidatos con puntaje de compatibilidad y desglose,
 * con el filtro de postulados y el orden de la query.
 */
export const ranking = asyncHandler(async (req, res) => {
  const query = queryValidada(req, rankingOfertaQuerySchema);
  res.status(200).json(await servicio.ranking(String(req.params.id), actor(req), query));
});

/**
 * GET /api/v1/matching/ofertas/:id/candidatos/:jugadorId
 * RF-09 · RF-11 · Un candidato del ranking con la explicación de su puntaje.
 */
export const candidato = asyncHandler(async (req, res) => {
  res
    .status(200)
    .json(await servicio.candidato(String(req.params.id), String(req.params.jugadorId), actor(req)));
});

/**
 * POST /api/v1/matching/ofertas/:id/recalcular
 * RF-09 · Fuerza el recálculo del ranking y devuelve la página pedida.
 */
export const recalcular = asyncHandler(async (req, res) => {
  const query = queryValidada(req, rankingOfertaQuerySchema);
  res.status(200).json(await servicio.recalcular(String(req.params.id), actor(req), query));
});

/**
 * GET /api/v1/matching/jugador/me
 * TODO: Devolver las ofertas más compatibles con el jugador autenticado.
 */
export const ofertasCompatibles = asyncHandler(async (req, res) => {
  res.json(await servicio.ofertasCompatibles(req.body ?? req.validado));
});
