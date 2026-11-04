import { queryValidada } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import * as servicio from "./scouting.service";
import { busquedaJugadoresSchema, paginacionQuerySchema } from "./scouting.schema";

/**
 * Controladores del módulo `scouting`: sólo traducen entre HTTP y el
 * servicio. La ficha ampliada y las búsquedas guardadas responden 501.
 */

/**
 * GET /api/v1/scouting/jugadores
 * RF-08 · Jugadores filtrados por posición, rango mínimo y departamento.
 */
export const buscarJugadores = asyncHandler(async (req, res) => {
  const query = queryValidada(req, busquedaJugadoresSchema.merge(paginacionQuerySchema));
  res.status(200).json(await servicio.buscarJugadores(query));
});

/**
 * GET /api/v1/scouting/jugadores/:id
 * TODO: Devolver la ficha ampliada de un jugador (perfil, habilidades y estadísticas).
 */
export const fichaJugador = asyncHandler(async (req, res) => {
  res.json(await servicio.fichaJugador(req.body ?? req.validado));
});

/**
 * POST /api/v1/scouting/busquedas
 * TODO: Guardar los filtros de una búsqueda para reutilizarla.
 */
export const guardarBusqueda = asyncHandler(async (req, res) => {
  res.json(await servicio.guardarBusqueda(req.body ?? req.validado));
});

/**
 * GET /api/v1/scouting/busquedas
 * TODO: Listar las búsquedas guardadas del usuario autenticado.
 */
export const listarBusquedas = asyncHandler(async (req, res) => {
  res.json(await servicio.listarBusquedas(req.body ?? req.validado));
});
