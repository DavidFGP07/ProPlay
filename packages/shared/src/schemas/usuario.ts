import { z } from "zod";
import { ROLES } from "../enums";
import { nombreSchema } from "./auth";

export const actualizarUsuarioSchema = z
  .object({
    nombre: nombreSchema.optional(),
    activo: z.boolean().optional(),
  })
  .refine((valor) => Object.keys(valor).length > 0, {
    message: "Envía al menos un campo para actualizar",
  });

export const cambiarPasswordSchema = z.object({
  passwordActual: z.string().min(1),
  passwordNueva: z.string().min(8).max(72),
});

export const listarUsuariosQuerySchema = z.object({
  rol: z.enum(ROLES).optional(),
  q: z.string().max(120).optional(),
});

export type ActualizarUsuarioInput = z.infer<typeof actualizarUsuarioSchema>;
export type CambiarPasswordInput = z.infer<typeof cambiarPasswordSchema>;
