import type { Request } from "express";
import { queryValidada } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { UnauthorizedError } from "../../utils/errors";
import * as servicio from "./ofertas.service";
import {
  listarMisOfertasQuerySchema,
  listarOfertasQuerySchema,
  paginacionQuerySchema,
  type ActualizarOfertaInput,
  type ActualizarPostulacionInput,
  type CambiarEstadoOfertaInput,
  type CrearOfertaInput,
  type CrearPostulacionInput,
} from "./ofertas.schema";

/**
 * Controladores del módulo `ofertas`: sólo traducen entre HTTP y el servicio.
 */

/** Petición con `:id` en la ruta y el body ya validado por validate(). */
type PeticionCon<Body> = Request<{ id: string }, unknown, Body>;

function actor(req: Request) {
  if (!req.usuario) throw new UnauthorizedError();
  return { id: req.usuario.id, rol: req.usuario.rol };
}

/**
 * GET /api/v1/ofertas
 * RF-07 · Ofertas abiertas, paginadas y filtradas por rol, departamento y modalidad.
 */
export const listar = asyncHandler(async (req, res) => {
  const query = queryValidada(req, listarOfertasQuerySchema.merge(paginacionQuerySchema));
  res.status(200).json(await servicio.listar(query));
});

/**
 * GET /api/v1/ofertas/me
 * RF-07 · Ofertas del equipo autenticado, en cualquier estado.
 */
export const listarPropias = asyncHandler(async (req, res) => {
  const query = queryValidada(req, listarMisOfertasQuerySchema.merge(paginacionQuerySchema));
  res.status(200).json(await servicio.listarPropias(actor(req).id, query));
});

/**
 * POST /api/v1/ofertas
 * RF-07 · Publicar o guardar como borrador una oferta del equipo autenticado.
 */
export const crear = asyncHandler<PeticionCon<CrearOfertaInput>>(async (req, res) => {
  res.status(201).json(await servicio.crear(actor(req).id, req.body));
});

/**
 * GET /api/v1/ofertas/:id
 * RF-07 · Detalle de una oferta.
 */
export const obtener = asyncHandler<PeticionCon<unknown>>(async (req, res) => {
  res.status(200).json(await servicio.obtener(req.params.id, actor(req)));
});

/**
 * PATCH /api/v1/ofertas/:id
 * RF-07 · Edición parcial de una oferta propia.
 */
export const actualizar = asyncHandler<PeticionCon<ActualizarOfertaInput>>(async (req, res) => {
  res.status(200).json(await servicio.actualizar(req.params.id, actor(req), req.body));
});

/**
 * PATCH /api/v1/ofertas/:id/estado
 * RF-07 · Publicar, cubrir o cerrar una oferta propia.
 */
export const cambiarEstado = asyncHandler<PeticionCon<CambiarEstadoOfertaInput>>(
  async (req, res) => {
    res
      .status(200)
      .json(await servicio.cambiarEstado(req.params.id, actor(req), req.body.estado));
  },
);

/**
 * POST /api/v1/ofertas/:id/postulaciones
 * RF-10 · Postulación del jugador autenticado.
 */
export const postular = asyncHandler<PeticionCon<CrearPostulacionInput>>(async (req, res) => {
  res.status(201).json(await servicio.postular(req.params.id, actor(req), req.body.mensaje));
});

/**
 * GET /api/v1/ofertas/:id/postulaciones
 * RF-10 · Postulaciones recibidas por una oferta.
 */
export const listarPostulaciones = asyncHandler<PeticionCon<unknown>>(async (req, res) => {
  res.status(200).json(await servicio.listarPostulaciones(req.params.id, actor(req)));
});

/**
 * GET /api/v1/ofertas/postulaciones/me
 * RF-10 · Postulaciones del jugador autenticado.
 */
export const misPostulaciones = asyncHandler(async (req, res) => {
  res.status(200).json(await servicio.misPostulaciones(actor(req).id));
});

/**
 * PATCH /api/v1/ofertas/postulaciones/:id
 * RF-10 · Avanzar o rechazar una postulación recibida.
 */
export const actualizarPostulacion = asyncHandler<PeticionCon<ActualizarPostulacionInput>>(
  async (req, res) => {
    res
      .status(200)
      .json(await servicio.actualizarPostulacion(req.params.id, actor(req), req.body.estado));
  },
);
