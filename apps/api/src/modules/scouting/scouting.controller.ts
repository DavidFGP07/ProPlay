import { asyncHandler } from "../../utils/asyncHandler";
import * as servicio from "./scouting.service";

/**
 * Controladores del módulo `scouting`: sólo traducen entre HTTP y el
 * servicio. Andamiaje: todos responden 501 NOT_IMPLEMENTED por ahora.
 */

/**
 * GET /api/v1/scouting/jugadores
 * TODO: Buscar jugadores por juego, rol, región, KDA, win rate y nivel de habilidad.
 */
export const buscarJugadores = asyncHandler(async (req, res) => {
  res.json(await servicio.buscarJugadores(req.body ?? req.validado));
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
