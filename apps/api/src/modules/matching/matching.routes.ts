import { Router } from "express";
import { auth } from "../../middleware/auth";
import { rbac } from "../../middleware/rbac";
import { validate } from "../../middleware/validate";
import * as controlador from "./matching.controller";
import {
  calcularMatchingSchema,
  idParamSchema,
} from "./matching.schema";

/**
 * Rutas del módulo `matching`: /api/v1/matching
 * Algoritmo de compatibilidad entre jugadores y ofertas.
 */
export const matchingRouter = Router();

// TODO: Calcular y persistir el ranking de jugadores compatibles con una oferta.
matchingRouter.post(
  "/calcular",
  auth,
  rbac("EQUIPO", "SCOUT", "ADMIN"),
  validate(calcularMatchingSchema),
  controlador.calcular,
);

// TODO: Devolver el ranking ya calculado de una oferta, ordenado por puntaje.
matchingRouter.get(
  "/oferta/:id",
  auth,
  rbac("EQUIPO", "SCOUT", "ADMIN"),
  validate(idParamSchema, "params"),
  controlador.rankingPorOferta,
);

// TODO: Devolver las ofertas más compatibles con el jugador autenticado.
matchingRouter.get(
  "/jugador/me",
  auth,
  rbac("JUGADOR"),
  controlador.ofertasCompatibles,
);
