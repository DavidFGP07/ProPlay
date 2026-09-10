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
 * Métricas de rendimiento por jugador, juego y periodo.
 */
export const estadisticasRouter = Router();

// TODO: Listar las estadísticas de un jugador filtradas por juego y rango de fechas.
estadisticasRouter.get(
  "/jugador/:id",
  auth,
  validate(listarEstadisticasQuerySchema, "query"),
  controlador.listarPorJugador,
);

// TODO: Agregar KDA, win rate y partidas del jugador por juego.
estadisticasRouter.get(
  "/jugador/:id/resumen",
  auth,
  validate(idParamSchema, "params"),
  controlador.resumenPorJugador,
);

// TODO: Pedir al GameStatsProvider de la plataforma las estadísticas y persistirlas.
estadisticasRouter.post(
  "/sincronizar",
  auth,
  rbac("JUGADOR"),
  validate(sincronizarEstadisticasSchema),
  controlador.sincronizar,
);
