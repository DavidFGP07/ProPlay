import type { RequestHandler } from "express";
import type { Rol } from "@proplay/shared";
import { ForbiddenError, UnauthorizedError } from "../utils/errors";

/**
 * Control de acceso por rol. Se monta siempre después de `auth`:
 *
 *   router.post("/", auth, rbac("EQUIPO", "ADMIN"), controlador.crear);
 */
export function rbac(...rolesPermitidos: Rol[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.usuario) {
      next(new UnauthorizedError("Se requiere autenticación"));
      return;
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      next(
        new ForbiddenError(
          `Tu rol (${req.usuario.rol}) no tiene acceso a este recurso`,
        ),
      );
      return;
    }

    next();
  };
}

/** Permite el acceso al dueño del recurso o a un ADMIN. */
export function mismoUsuarioOAdmin(
  obtenerUsuarioId: (req: Parameters<RequestHandler>[0]) => string | undefined,
): RequestHandler {
  return (req, _res, next) => {
    if (!req.usuario) {
      next(new UnauthorizedError("Se requiere autenticación"));
      return;
    }

    const objetivo = obtenerUsuarioId(req);
    if (req.usuario.rol === "ADMIN" || req.usuario.id === objetivo) {
      next();
      return;
    }

    next(new ForbiddenError("Sólo puedes operar sobre tu propia cuenta"));
  };
}
