import { Router } from "express";
import { auth, authOpcional } from "../../middleware/auth";
import { limitePerfilPublico, limiteVinculacionRiot } from "../../middleware/rateLimit";
import { rbac } from "../../middleware/rbac";
import { validate } from "../../middleware/validate";
import * as controlador from "./perfiles.controller";
import {
  asignarHabilidadSchema,
  crearEndorsementSchema,
  idParamSchema,
  perfilEquipoSchema,
  perfilJugadorSchema,
  plataformaParamSchema,
  verificarCuentaRiotSchema,
  vincularCuentaGamingSchema,
  vincularCuentaRiotSchema,
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

// RF-07 · Edición del perfil de la organización. Sólo el equipo: el scout no
// tiene perfil propio.
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

// TODO: Vincular una cuenta externa vía OAuth (RSO) y guardar sus tokens
// cifrados. Necesita la clave de producción de Riot; hasta entonces, las dos
// rutas de /cuentas-gaming/riot.
perfilesRouter.post(
  "/cuentas-gaming",
  auth,
  rbac("JUGADOR"),
  validate(vincularCuentaGamingSchema),
  controlador.vincularCuenta,
);

// RF-02, RF-03 · Cuentas vinculadas del jugador, con su última sincronización
perfilesRouter.get(
  "/cuentas-gaming",
  auth,
  rbac("JUGADOR"),
  controlador.listarCuentas,
);

// RF-02 · Vinculación con Riot, paso 1: Riot ID → icono que debe ponerse. Si
// ya hay un desafío activo para esa cuenta, devuelve ése. Consulta a Riot:
// comparte el límite de la vinculación con «generar otro icono».
perfilesRouter.post(
  "/cuentas-gaming/riot",
  auth,
  rbac("JUGADOR"),
  limiteVinculacionRiot,
  validate(vincularCuentaRiotSchema),
  controlador.iniciarVinculacionRiot,
);

// RF-02 · Desafío activo, para retomarlo al volver a la vista o recargar
perfilesRouter.get(
  "/cuentas-gaming/riot/desafio",
  auth,
  rbac("JUGADOR"),
  controlador.obtenerDesafioRiot,
);

// RF-02 · «Generar otro icono»: invalida el desafío activo y crea otro
perfilesRouter.post(
  "/cuentas-gaming/riot/desafio/regenerar",
  auth,
  rbac("JUGADOR"),
  limiteVinculacionRiot,
  controlador.regenerarDesafioRiot,
);

// RF-02 · Cancelar el desafío activo, para vincular otra cuenta
perfilesRouter.delete(
  "/cuentas-gaming/riot/desafio",
  auth,
  rbac("JUGADOR"),
  controlador.cancelarDesafioRiot,
);

// RF-02 · Vinculación con Riot, paso 2: se comprueba el icono. No gasta el
// límite de la vinculación: cada desafío tiene su propio cupo de
// comprobaciones (MAX_COMPROBACIONES_DESAFIO), que cuenta el servicio.
perfilesRouter.post(
  "/cuentas-gaming/riot/verificar",
  auth,
  rbac("JUGADOR"),
  validate(verificarCuentaRiotSchema),
  controlador.verificarCuentaRiot,
);

// RF-02 · Desvincular la cuenta de una plataforma
perfilesRouter.delete(
  "/cuentas-gaming/:plataforma",
  auth,
  rbac("JUGADOR"),
  validate(plataformaParamSchema, "params"),
  controlador.desvincularCuenta,
);

// RF-05 · Perfil público del jugador, compartible y sin sesión. Va al final:
// "/:id" capturaría "/me" y "/habilidades".
perfilesRouter.get(
  "/:id",
  authOpcional,
  limitePerfilPublico,
  validate(idParamSchema, "params"),
  controlador.obtenerPublico,
);
