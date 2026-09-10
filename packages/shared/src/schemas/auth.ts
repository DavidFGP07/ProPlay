import { z } from "zod";
import { ROLES, ROLES_REGISTRABLES } from "../enums";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "../constants";

/**
 * Contrato del módulo de autenticación.
 * Estos esquemas los usa el backend en el middleware validate() y el frontend
 * en react-hook-form. Un solo cambio aquí actualiza los dos lados.
 */

export const emailSchema = z
  .string()
  .min(1, "El correo es obligatorio")
  .email("Correo electrónico inválido")
  .max(255)
  .transform((valor) => valor.trim().toLowerCase());

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Mínimo ${PASSWORD_MIN_LENGTH} caracteres`)
  .max(PASSWORD_MAX_LENGTH, `Máximo ${PASSWORD_MAX_LENGTH} caracteres`)
  .regex(/[A-Za-zÀ-ÿ]/, "Debe incluir al menos una letra")
  .regex(/\d/, "Debe incluir al menos un número");

export const nombreSchema = z
  .string()
  .min(2, "El nombre debe tener al menos 2 caracteres")
  .max(80, "El nombre no puede exceder 80 caracteres")
  .transform((valor) => valor.trim());

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  nombre: nombreSchema,
  rol: z.enum(ROLES_REGISTRABLES, {
    errorMap: () => ({ message: "Selecciona un rol válido" }),
  }),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "La contraseña es obligatoria"),
});

/** Usuario tal y como lo ve el cliente: nunca incluye passwordHash. */
export const usuarioPublicoSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  nombre: z.string(),
  rol: z.enum(ROLES),
  emailVerificado: z.boolean(),
  activo: z.boolean(),
  creadoEn: z.coerce.date(),
});

export const authResponseSchema = z.object({
  usuario: usuarioPublicoSchema,
  accessToken: z.string(),
  expiraEn: z.number().int().describe("Segundos de vida del access token"),
});

export const refreshResponseSchema = authResponseSchema.omit({ usuario: true });

export const meResponseSchema = z.object({ usuario: usuarioPublicoSchema });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UsuarioPublico = z.infer<typeof usuarioPublicoSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
