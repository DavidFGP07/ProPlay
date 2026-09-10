import type { ErrorRequestHandler, RequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { AppError, NotFoundError } from "../utils/errors";

interface CuerpoError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** 404 para cualquier ruta no registrada. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));
};

/**
 * Manejador de errores central: única salida de errores de la API.
 * Siempre responde con la misma forma { error: { code, message, details? } } y
 * nunca filtra stack traces en producción.
 */
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const { status, cuerpo, esInesperado } = traducirError(error);

  const contexto = {
    metodo: req.method,
    ruta: req.originalUrl,
    usuarioId: req.usuario?.id,
    code: cuerpo.error.code,
  };

  if (esInesperado) {
    logger.error({ ...contexto, error }, cuerpo.error.message);
  } else {
    logger.warn(contexto, cuerpo.error.message);
  }

  // El stack sólo viaja fuera de producción y sólo para errores inesperados.
  if (!env.esProduccion && esInesperado && error instanceof Error) {
    cuerpo.error.details = { stack: error.stack?.split("\n").slice(0, 5) };
  }

  res.status(status).json(cuerpo);
};

function traducirError(error: unknown): {
  status: number;
  cuerpo: CuerpoError;
  esInesperado: boolean;
} {
  if (error instanceof AppError) {
    return {
      status: error.status,
      cuerpo: {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      },
      esInesperado: !error.esOperacional || error.status >= 500,
    };
  }

  if (error instanceof ZodError) {
    return {
      status: 422,
      cuerpo: {
        error: {
          code: "VALIDATION_ERROR",
          message: "Los datos enviados no son válidos",
          details: {
            campos: error.issues.map((issue) => ({
              campo: issue.path.join("."),
              mensaje: issue.message,
            })),
          },
        },
      },
      esInesperado: false,
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return {
        status: 409,
        cuerpo: {
          error: {
            code: "CONFLICT",
            message: "Ya existe un registro con esos datos únicos",
          },
        },
        esInesperado: false,
      };
    }
    if (error.code === "P2025") {
      return {
        status: 404,
        cuerpo: {
          error: { code: "NOT_FOUND", message: "Recurso no encontrado" },
        },
        esInesperado: false,
      };
    }
  }

  return {
    status: 500,
    cuerpo: {
      error: {
        code: "INTERNAL_ERROR",
        message: "Error interno del servidor",
      },
    },
    esInesperado: true,
  };
}
