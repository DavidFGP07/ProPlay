import type { Request } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { UnauthorizedError } from "../../utils/errors";
import * as servicio from "./perfiles.service";
import type { Plataforma } from "@proplay/shared";
import type {
  PerfilEquipoInput,
  PerfilJugadorInput,
  VerificarCuentaRiotInput,
  VincularCuentaRiotInput,
} from "./perfiles.schema";

/**
 * Controladores del módulo `perfiles`: sólo traducen entre HTTP y el
 * servicio. Andamiaje: los que conservan su TODO responden 501.
 */

/** Petición cuyo body ya validó el middleware validate() con su esquema Zod. */
type PeticionCon<Body> = Request<Record<string, string>, unknown, Body>;

/**
 * GET /api/v1/perfiles/me
 * Perfil del usuario autenticado según su rol.
 */
export const obtenerPropio = asyncHandler(async (req, res) => {
  if (!req.usuario) throw new UnauthorizedError();
  res.status(200).json(await servicio.obtenerPropio(req.usuario.id, req.usuario.rol));
});

/**
 * PATCH /api/v1/perfiles/jugador
 * Actualización parcial del perfil del jugador autenticado.
 */
export const actualizarJugador = asyncHandler<PeticionCon<PerfilJugadorInput>>(
  async (req, res) => {
    if (!req.usuario) throw new UnauthorizedError();
    res.status(200).json(await servicio.actualizarJugador(req.usuario.id, req.body));
  },
);

/**
 * PATCH /api/v1/perfiles/equipo
 * Actualización parcial del perfil de la organización autenticada.
 */
export const actualizarEquipo = asyncHandler<PeticionCon<PerfilEquipoInput>>(
  async (req, res) => {
    if (!req.usuario) throw new UnauthorizedError();
    res.status(200).json(await servicio.actualizarEquipo(req.usuario.id, req.body));
  },
);

/**
 * GET /api/v1/perfiles/habilidades
 * TODO: Devolver el catálogo de habilidades (técnicas y blandas).
 */
export const catalogoHabilidades = asyncHandler(async (req, res) => {
  res.json(await servicio.catalogoHabilidades(req.body ?? req.validado));
});

/**
 * POST /api/v1/perfiles/habilidades
 * TODO: Asociar una habilidad al perfil del jugador con su nivel 1-5.
 */
export const asignarHabilidad = asyncHandler(async (req, res) => {
  res.json(await servicio.asignarHabilidad(req.body ?? req.validado));
});

/**
 * POST /api/v1/perfiles/endorsements
 * TODO: Registrar el endorsement de una HabilidadJugador por parte de otro usuario.
 */
export const endosar = asyncHandler(async (req, res) => {
  res.json(await servicio.endosar(req.body ?? req.validado));
});

/**
 * POST /api/v1/perfiles/cuentas-gaming
 * TODO: Vincular una cuenta externa vía OAuth (RSO) y guardar sus tokens cifrados.
 */
export const vincularCuenta = asyncHandler(async (req, res) => {
  res.json(await servicio.vincularCuenta(req.body ?? req.validado));
});

/**
 * GET /api/v1/perfiles/cuentas-gaming
 * Cuentas vinculadas del jugador autenticado.
 */
export const listarCuentas = asyncHandler(async (req, res) => {
  if (!req.usuario) throw new UnauthorizedError();
  res.status(200).json(await servicio.listarCuentas(req.usuario.id));
});

/**
 * POST /api/v1/perfiles/cuentas-gaming/riot
 * Paso 1: Riot ID → desafío de verificación por icono.
 */
export const iniciarVinculacionRiot = asyncHandler<PeticionCon<VincularCuentaRiotInput>>(
  async (req, res) => {
    if (!req.usuario) throw new UnauthorizedError();
    res.status(200).json(await servicio.iniciarVinculacionRiot(req.usuario.id, req.body));
  },
);

/**
 * POST /api/v1/perfiles/cuentas-gaming/riot/verificar
 * Paso 2: comprueba el icono y guarda la cuenta verificada.
 */
export const verificarCuentaRiot = asyncHandler<PeticionCon<VerificarCuentaRiotInput>>(
  async (req, res) => {
    if (!req.usuario) throw new UnauthorizedError();
    res.status(201).json(await servicio.verificarCuentaRiot(req.usuario.id, req.body));
  },
);

/**
 * DELETE /api/v1/perfiles/cuentas-gaming/:plataforma
 * Desvincula la cuenta de esa plataforma.
 */
export const desvincularCuenta = asyncHandler<Request<{ plataforma: Plataforma }>>(
  async (req, res) => {
    if (!req.usuario) throw new UnauthorizedError();
    await servicio.desvincularCuenta(req.usuario.id, req.params.plataforma);
    res.status(204).end();
  },
);

/**
 * GET /api/v1/perfiles/:id
 * Perfil público de un jugador por el id de su perfil. No exige sesión y no
 * cambia según quién lo pida.
 */
export const obtenerPublico = asyncHandler<Request<{ id: string }>>(async (req, res) => {
  res.status(200).json(await servicio.obtenerPublico(req.params.id));
});
