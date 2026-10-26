import { Router } from "express";
import { auth } from "../../middleware/auth";
import { rbac } from "../../middleware/rbac";
import { limiteAuth, limiteRefresh } from "../../middleware/rateLimit";
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
 * Registro e inicio de sesión llevan un límite estricto contra la fuerza
 * bruta; el refresco, uno propio por usuario (middleware/rateLimit.ts).
 */
export const authRouter = Router();

authRouter.post(
  "/register",
  limiteAuth,
  validate(registerSchema),
  controlador.registrar,
);
authRouter.post("/login", limiteAuth, validate(loginSchema), controlador.login);
authRouter.post("/refresh", limiteRefresh, controlador.refrescar);
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
