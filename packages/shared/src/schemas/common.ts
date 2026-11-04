import { z } from "zod";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  PAIS_CON_DEPARTAMENTO,
  PAISES,
} from "../constants";
import { DEPARTAMENTOS } from "../enums";

/** Identificador de recurso (cuid generado por Prisma). */
export const idSchema = z.string().min(1, "Identificador requerido");

const PROTOCOLOS_WEB = new Set(["http:", "https:"]);

/**
 * URL web: sólo `http:` o `https:`. Todo campo de URL del contrato usa este
 * esquema. `z.string().url()` admite cualquier esquema que `new URL` sepa
 * leer (`javascript:`, `data:`, `ftp:`…), y un enlace así en un `href` ejecuta
 * código. Se recortan los espacios de los extremos y el protocolo se compara
 * ya normalizado por `URL` (minúsculas, sin tabuladores ni saltos de línea).
 * Sin mensaje propio: el cliente lo traduce por su código (`invalid_string`,
 * validación `url`).
 */
export const urlHttpSchema = z
  .string()
  .trim()
  .superRefine((valor, ctx) => {
    let protocolo: string | null = null;
    try {
      protocolo = new URL(valor).protocol;
    } catch {
      // Mal formada: cae en el mismo error.
    }
    if (protocolo === null || !PROTOCOLOS_WEB.has(protocolo)) {
      ctx.addIssue({ code: z.ZodIssueCode.invalid_string, validation: "url" });
    }
  });

/**
 * Coherencia de país y departamento, común a la ubicación del jugador, la sede
 * del equipo y la oferta: con `pais = "CO"` el departamento es obligatorio; con
 * otro país, o sin país, no se admite. Si el cuerpo trae sólo el departamento,
 * aquí no se puede comprobar: el servidor lo valida contra el país guardado
 * con el mismo esquema.
 */
export function validarPaisDepartamento(
  datos: { pais?: string | null; departamento?: string | null },
  ctx: z.RefinementCtx,
) {
  const { pais, departamento } = datos;
  if (pais === undefined) return;
  if (pais === PAIS_CON_DEPARTAMENTO && !departamento) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["departamento"],
      message: "Selecciona el departamento",
    });
  }
  if (pais !== PAIS_CON_DEPARTAMENTO && departamento) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["departamento"],
      message: "El departamento sólo aplica a Colombia",
    });
  }
}

/**
 * País y departamento completos, con su regla. Lo usa el servidor para
 * comprobar un departamento recibido sin país contra el país guardado.
 */
export const paisDepartamentoSchema = z
  .object({
    pais: z.enum(PAISES).nullable().optional(),
    departamento: z.enum(DEPARTAMENTOS).nullable().optional(),
  })
  .superRefine(validarPaisDepartamento);

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
