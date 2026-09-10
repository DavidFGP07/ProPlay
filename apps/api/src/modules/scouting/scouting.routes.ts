import { Router } from "express";
import { auth } from "../../middleware/auth";
import { rbac } from "../../middleware/rbac";
import { validate } from "../../middleware/validate";
import * as controlador from "./scouting.controller";
import {
  busquedaJugadoresSchema,
  guardarBusquedaSchema,
  idParamSchema,
  paginacionQuerySchema,
} from "./scouting.schema";

/**
 * Rutas del módulo `scouting`: /api/v1/scouting
 * Búsqueda y descubrimiento de jugadores por parte de scouts y equipos.
 */
export const scoutingRouter = Router();

// TODO: Buscar jugadores por juego, rol, región, KDA, win rate y nivel de habilidad.
scoutingRouter.get(
  "/jugadores",
  auth,
  rbac("SCOUT", "EQUIPO", "ADMIN"),
  validate(busquedaJugadoresSchema.merge(paginacionQuerySchema), "query"),
  controlador.buscarJugadores,
);

// TODO: Devolver la ficha ampliada de un jugador (perfil, habilidades y estadísticas).
scoutingRouter.get(
  "/jugadores/:id",
  auth,
  rbac("SCOUT", "EQUIPO", "ADMIN"),
  validate(idParamSchema, "params"),
  controlador.fichaJugador,
);

// TODO: Guardar los filtros de una búsqueda para reutilizarla.
scoutingRouter.post(
  "/busquedas",
  auth,
  rbac("SCOUT", "EQUIPO"),
  validate(guardarBusquedaSchema),
  controlador.guardarBusqueda,
);

// TODO: Listar las búsquedas guardadas del usuario autenticado.
scoutingRouter.get(
  "/busquedas",
  auth,
  rbac("SCOUT", "EQUIPO"),
  controlador.listarBusquedas,
);
