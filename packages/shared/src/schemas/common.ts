import { z } from "zod";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../constants";

/** Identificador de recurso (cuid generado por Prisma). */
export const idSchema = z.string().min(1, "Identificador requerido");

/** `/:id` en los parámetros de ruta. */
export const idParamSchema = z.object({ id: idSchema });

/** Query de paginación común a todos los listados. */
export const paginacionQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
});

/** Envoltorio de respuesta paginada. */
export const paginadoSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    data: z.array(item),
    meta: z.object({
      page: z.number().int(),
      pageSize: z.number().int(),
      total: z.number().int(),
      totalPages: z.number().int(),
    }),
  });

/**
 * Forma única de error de la API. El manejador centralizado del backend
 * garantiza que TODA respuesta de error tenga exactamente esta estructura.
 */
export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type Paginacion = z.infer<typeof paginacionQuerySchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
