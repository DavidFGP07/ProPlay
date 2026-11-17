import { asyncHandler } from "../../utils/asyncHandler";
import { UnauthorizedError } from "../../utils/errors";
import * as servicio from "./analitica.service";

/**
 * Controladores del módulo `analitica`: sólo traducen entre HTTP y el servicio.
 */

function actor(req: { usuario?: { id: string; rol: servicio.Actor["rol"] } }): servicio.Actor {
  if (!req.usuario) throw new UnauthorizedError("Sesión requerida");
  return { id: req.usuario.id, rol: req.usuario.rol };
}

/**
 * GET /api/v1/analitica/embudo
 * RF-13 · Embudo agregado de las ofertas del equipo, con el tiempo hasta
 * cubrir (H1) y hasta el primer tryout.
 */
export const embudoEquipo = asyncHandler(async (req, res) => {
  res.status(200).json(await servicio.embudoEquipo(actor(req)));
});

/**
 * GET /api/v1/analitica/ofertas/:id/embudo
 * RF-13 · Embudo de una oferta del equipo.
 */
export const embudoOferta = asyncHandler(async (req, res) => {
  res.status(200).json(await servicio.embudoOferta(String(req.params.id), actor(req)));
});

/**
 * GET /api/v1/analitica/ofertas/:id/dimension-decisiva
 * RF-13 · Qué dimensión separa a los primeros del ranking del resto.
 */
export const dimensionDecisiva = asyncHandler(async (req, res) => {
  res.status(200).json(await servicio.dimensionDecisiva(String(req.params.id), actor(req)));
});

/**
 * GET /api/v1/analitica/talento
 * RF-13 · Mapa del talento verificado, con el umbral de privacidad aplicado.
 */
export const talento = asyncHandler(async (_req, res) => {
  res.status(200).json(await servicio.talento());
});
