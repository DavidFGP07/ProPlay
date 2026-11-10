import { Router } from "express";
import { auth } from "../../middleware/auth";
import { limiteRanking, limiteRecalculoRanking } from "../../middleware/rateLimit";
import { rbac } from "../../middleware/rbac";
import { validate } from "../../middleware/validate";
import * as controlador from "./matching.controller";
import { idParamSchema, rankingOfertaQuerySchema } from "./matching.schema";

/**
 * Rutas del módulo `matching`: /api/v1/matching
 * Algoritmo de compatibilidad entre jugadores y ofertas.
 */
export const matchingRouter = Router();

// RF-09 · Ranking de candidatos de una oferta con puntaje de compatibilidad y
// desglose por dimensión, paginado. El equipo dueño (también en borrador), y
// el scout y el administrador en ofertas publicadas.
matchingRouter.get(
  "/ofertas/:id/ranking",
  auth,
  rbac("EQUIPO", "SCOUT", "ADMIN"),
  limiteRanking,
  validate(idParamSchema, "params"),
  validate(rankingOfertaQuerySchema, "query"),
  controlador.ranking,
);

// RF-09 · Recalcular el ranking a demanda. El equipo dueño y el scout; una
// oferta cubierta o cerrada responde 409 OFERTA_FINALIZADA.
matchingRouter.post(
  "/ofertas/:id/recalcular",
  auth,
  rbac("EQUIPO", "SCOUT"),
  limiteRecalculoRanking,
  validate(idParamSchema, "params"),
  validate(rankingOfertaQuerySchema, "query"),
  controlador.recalcular,
);

// TODO: Devolver las ofertas más compatibles con el jugador autenticado.
matchingRouter.get(
  "/jugador/me",
  auth,
  rbac("JUGADOR"),
  controlador.ofertasCompatibles,
);
