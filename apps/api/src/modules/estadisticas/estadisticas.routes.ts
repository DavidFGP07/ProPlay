import { Router } from "express";
import { auth } from "../../middleware/auth";
import { rbac } from "../../middleware/rbac";
import { validate } from "../../middleware/validate";
import * as controlador from "./estadisticas.controller";
import {
  idParamSchema,
  listarEstadisticasQuerySchema,
  sincronizarEstadisticasSchema,
} from "./estadisticas.schema";

/**
 * Rutas del módulo `estadisticas`: /api/v1/estadisticas
 * Métricas de rendimiento por jugador, juego y periodo. `:id` es el id de
 * `PerfilJugador`, el mismo del perfil público.
 */
export const estadisticasRouter = Router();

// RF-04, RF-13 · Histórico de estadísticas verificadas del jugador
estadisticasRouter.get(
  "/jugador/:id",
  auth,
  validate(idParamSchema, "params"),
  validate(listarEstadisticasQuerySchema, "query"),
  controlador.listarPorJugador,
);

// RF-04, RF-13 · Resumen por juego con la tendencia del rendimiento
estadisticasRouter.get(
  "/jugador/:id/resumen",
  auth,
  validate(idParamSchema, "params"),
  controlador.resumenPorJugador,
);

// RF-03 · Ingesta de estadísticas desde la API de Riot para el jugador autenticado
estadisticasRouter.post(
  "/sincronizar",
  auth,
  rbac("JUGADOR"),
  validate(sincronizarEstadisticasSchema),
  controlador.sincronizar,
);
