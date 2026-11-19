import { asyncHandler } from "../../utils/asyncHandler";
import { UnauthorizedError } from "../../utils/errors";
import * as servicio from "./explicador.service";

/**
 * Controladores del módulo `explicador`: sólo traducen entre HTTP y el servicio.
 */

function actor(req: { usuario?: { id: string; rol: servicio.Actor["rol"] } }): servicio.Actor {
  if (!req.usuario) throw new UnauthorizedError("Sesión requerida");
  return { id: req.usuario.id, rol: req.usuario.rol };
}

/**
 * GET /api/v1/explicaciones/ofertas/:id/candidatos/:jugadorId
 * RF-11 · Explicación en lenguaje natural de por qué el candidato encaja. Sin
 * texto disponible responde igualmente 200 con `NO_DISPONIBLE`.
 */
export const explicacionCandidato = asyncHandler(async (req, res) => {
  res
    .status(200)
    .json(await servicio.explicar(String(req.params.id), String(req.params.jugadorId), actor(req)));
});
