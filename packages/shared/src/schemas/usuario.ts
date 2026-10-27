import { z } from "zod";
import { ROLES } from "../enums";
import { nombreSchema, passwordSchema } from "./auth";

/**
 * Edición de la cuenta propia (PATCH /usuarios/me). `activo` no está a
 * propósito: suspender o reactivar una cuenta es cosa del administrador, no
 * del propio usuario. Los campos desconocidos se descartan.
 */
export const actualizarUsuarioSchema = z
  .object({
    nombre: nombreSchema.optional(),
  })
  .refine((valor) => Object.keys(valor).length > 0, {
    message: "Envía al menos un campo para actualizar",
  });

/**
 * Cambio de la contraseña propia. La nueva sigue la misma política que el
 * registro (passwordSchema) y no puede repetir la actual.
 */
export const cambioContrasenaSchema = z
  .object({
    contrasenaActual: z.string().min(1, "Escribe tu contraseña actual"),
    contrasenaNueva: passwordSchema,
  })
  .refine((valor) => valor.contrasenaNueva !== valor.contrasenaActual, {
    message: "La nueva contraseña debe ser distinta de la actual",
    path: ["contrasenaNueva"],
  });

export const listarUsuariosQuerySchema = z.object({
  rol: z.enum(ROLES).optional(),
  q: z.string().max(120).optional(),
});

export type ActualizarUsuarioInput = z.infer<typeof actualizarUsuarioSchema>;
export type CambioContrasenaInput = z.infer<typeof cambioContrasenaSchema>;
