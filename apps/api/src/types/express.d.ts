import type { Rol } from "@proplay/shared";

/**
 * Datos que los middlewares añaden a la petición.
 * `usuario` lo rellena el middleware auth; `validado` lo rellena validate().
 */
declare global {
  namespace Express {
    interface Request {
      usuario?: {
        id: string;
        email: string;
        rol: Rol;
      };
      /** Query y params ya validados y convertidos por Zod. */
      validado?: {
        query?: unknown;
        params?: unknown;
      };
    }
  }
}

export {};
