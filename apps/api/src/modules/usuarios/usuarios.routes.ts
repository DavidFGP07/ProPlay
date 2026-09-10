import { Router } from "express";
import { auth } from "../../middleware/auth";
import { rbac } from "../../middleware/rbac";
import { limiteAuth } from "../../middleware/rateLimit";
import { validate } from "../../middleware/validate";
import * as controlador from "./usuarios.controller";
import {
  actualizarUsuarioSchema,
  listarUsuariosQuerySchema,
  loginSchema,
  paginacionQuerySchema,
  registerSchema,
} from "./usuarios.schema";

/**
 * Rutas de autenticación: /api/v1/auth
 * Llevan un límite de peticiones más estricto que el resto de la API.
 */
export const authRouter = Router();

authRouter.post(
  "/register",
  limiteAuth,
  validate(registerSchema),
  controlador.registrar,
);
authRouter.post("/login", limiteAuth, validate(loginSchema), controlador.login);
authRouter.post("/refresh", limiteAuth, controlador.refrescar);
authRouter.post("/logout", controlador.logout);
authRouter.get("/me", auth, controlador.yo);

/**
 * Rutas de gestión de usuarios: /api/v1/usuarios
 */
export const usuariosRouter = Router();

usuariosRouter.get(
  "/",
  auth,
  rbac("ADMIN"),
  validate(listarUsuariosQuerySchema.merge(paginacionQuerySchema), "query"),
  controlador.listar,
);
usuariosRouter.patch(
  "/me",
  auth,
  validate(actualizarUsuarioSchema),
  controlador.actualizarPropio,
);
usuariosRouter.get("/:id", auth, controlador.obtener);
