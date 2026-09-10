import type { RequestHandler } from "express";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { ValidationError } from "../utils/errors";

export type FuenteValidacion = "body" | "query" | "params";

/**
 * Middleware de validación reutilizable.
 *
 * Los esquemas vienen SIEMPRE de @proplay/shared, así el backend valida con el
 * mismo contrato con el que el frontend construye los formularios.
 *
 *   router.post("/", validate(registerSchema), controlador.registrar);
 *   router.get("/", validate(listarOfertasQuerySchema, "query"), ...);
 *
 * El resultado del parseo (con sus transformaciones y coerciones) reemplaza al
 * valor original: `body` y `params` se sobrescriben en la petición y `query`
 * queda en `req.validado.query`, porque en Express 5 `req.query` es de lectura.
 */
export function validate<Schema extends ZodTypeAny>(
  schema: Schema,
  fuente: FuenteValidacion = "body",
): RequestHandler {
  return (req, _res, next) => {
    try {
      const datos: unknown =
        fuente === "body"
          ? req.body
          : fuente === "query"
            ? req.query
            : req.params;

      const resultado = schema.parse(datos) as z.infer<Schema>;

      if (fuente === "body") {
        req.body = resultado;
      } else if (fuente === "params") {
        req.params = resultado as typeof req.params;
        req.validado = { ...req.validado, params: resultado };
      } else {
        req.validado = { ...req.validado, query: resultado };
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(
          new ValidationError("Los datos enviados no son válidos", {
            campos: error.issues.map((issue) => ({
              campo: issue.path.join(".") || fuente,
              mensaje: issue.message,
            })),
          }),
        );
        return;
      }
      next(error);
    }
  };
}

/** Lee la query ya validada con su tipo inferido del esquema. */
export function queryValidada<Schema extends ZodTypeAny>(
  req: { validado?: { query?: unknown } },
  _schema: Schema,
): z.infer<Schema> {
  return req.validado?.query as z.infer<Schema>;
}
