import { Router } from "express";
import { auth } from "../../middleware/auth";
import { limiteRanking } from "../../middleware/rateLimit";
import { rbac } from "../../middleware/rbac";
import { validate } from "../../middleware/validate";
import * as controlador from "./explicador.controller";
import { explicacionGeneradaParamsSchema } from "./explicador.schema";

/**
 * Rutas del módulo `explicador`: /api/v1/explicaciones
 * Explicación con modelo de lenguaje del puntaje de un candidato. Complementa
 * al detalle del candidato; el ranking nunca depende de ella (tarea 4.3).
 */
export const explicadorRouter = Router();

// RF-11 · Por qué encaja el candidato, redactado por un modelo de lenguaje a
// partir del desglose. Mismos permisos, mismo límite de peticiones y mismo 404
// que el detalle del candidato. Responde 200 aunque no haya texto
// (NO_DISPONIBLE con su motivo): nunca un error por culpa del modelo.
explicadorRouter.get(
  "/ofertas/:id/candidatos/:jugadorId",
  auth,
  rbac("EQUIPO", "SCOUT", "ADMIN"),
  limiteRanking,
  validate(explicacionGeneradaParamsSchema, "params"),
  controlador.explicacionCandidato,
);
