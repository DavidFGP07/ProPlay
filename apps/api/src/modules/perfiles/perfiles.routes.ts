import { Router } from "express";
import { auth } from "../../middleware/auth";
import { rbac } from "../../middleware/rbac";
import { validate } from "../../middleware/validate";
import * as controlador from "./perfiles.controller";
import {
  asignarHabilidadSchema,
  crearEndorsementSchema,
  idParamSchema,
  perfilEquipoSchema,
  perfilJugadorSchema,
  vincularCuentaGamingSchema,
} from "./perfiles.schema";

/**
 * Rutas del módulo `perfiles`: /api/v1/perfiles
 * Perfiles de jugador y de equipo, habilidades, endorsements y cuentas gaming.
 */
export const perfilesRouter = Router();

// RF-05 · Perfil propio (jugador o equipo) del usuario autenticado
perfilesRouter.get(
  "/me",
  auth,
  controlador.obtenerPropio,
);

// RF-05 · Edición del perfil del jugador, con su ubicación (insumo de RF-09)
perfilesRouter.patch(
  "/jugador",
  auth,
  rbac("JUGADOR"),
  validate(perfilJugadorSchema),
  controlador.actualizarJugador,
);

// TODO: Actualizar el PerfilEquipo del usuario autenticado.
perfilesRouter.patch(
  "/equipo",
  auth,
  rbac("EQUIPO"),
  validate(perfilEquipoSchema),
  controlador.actualizarEquipo,
);

// TODO: Devolver el catálogo de habilidades (técnicas y blandas).
perfilesRouter.get(
  "/habilidades",
  auth,
  controlador.catalogoHabilidades,
);

// TODO: Asociar una habilidad al perfil del jugador con su nivel 1-5.
perfilesRouter.post(
  "/habilidades",
  auth,
  rbac("JUGADOR"),
  validate(asignarHabilidadSchema),
  controlador.asignarHabilidad,
);

// TODO: Registrar el endorsement de una HabilidadJugador por parte de otro usuario.
perfilesRouter.post(
  "/endorsements",
  auth,
  validate(crearEndorsementSchema),
  controlador.endosar,
);

// TODO: Vincular una cuenta externa vía OAuth y guardar sus tokens cifrados.
perfilesRouter.post(
  "/cuentas-gaming",
  auth,
  rbac("JUGADOR"),
  validate(vincularCuentaGamingSchema),
  controlador.vincularCuenta,
);

// TODO: Devolver el perfil público de un usuario por su id.
perfilesRouter.get(
  "/:id",
  auth,
  validate(idParamSchema, "params"),
  controlador.obtenerPublico,
);
