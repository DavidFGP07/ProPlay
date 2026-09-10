import path from "node:path";
import { z } from "zod";

/**
 * Carga y validación de la configuración.
 *
 * Se valida al arrancar y se falla rápido: si falta una variable o tiene un
 * formato inválido, el proceso termina con un mensaje explícito en lugar de
 * romperse más tarde en tiempo de ejecución.
 */

// En local las variables vienen de apps/api/.env; en producción (Railway,
// Render, CI) las inyecta la plataforma y el archivo no existe.
try {
  process.loadEnvFile(path.resolve(process.cwd(), ".env"));
} catch {
  // Sin archivo .env: seguimos con las variables del entorno.
}

const stringNoVacio = (mensaje: string) => z.string().min(1, mensaje);

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: stringNoVacio("DATABASE_URL es obligatoria").startsWith(
    "postgres",
    "DATABASE_URL debe apuntar a PostgreSQL",
  ),
  REDIS_URL: stringNoVacio("REDIS_URL es obligatoria").startsWith(
    "redis",
    "REDIS_URL debe empezar por redis://",
  ),

  JWT_SECRET: z.string().min(32, "JWT_SECRET debe tener al menos 32 caracteres"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET debe tener al menos 32 caracteres"),

  ENCRYPTION_KEY: z
    .string()
    .regex(
      /^[0-9a-fA-F]{64}$/,
      "ENCRYPTION_KEY debe ser 32 bytes en hexadecimal (64 caracteres)",
    ),

  CORS_ORIGIN: z.string().default("http://localhost:5173"),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  RIOT_API_KEY: z.string().optional(),
  STEAM_API_KEY: z.string().optional(),
  TWITCH_CLIENT_ID: z.string().optional(),
  TWITCH_CLIENT_SECRET: z.string().optional(),
  YOUTUBE_CLIENT_ID: z.string().optional(),
  YOUTUBE_CLIENT_SECRET: z.string().optional(),

  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
});

const resultado = envSchema.safeParse(process.env);

if (!resultado.success) {
  const detalle = resultado.error.issues
    .map((issue) => `  · ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  // No usamos el logger: puede que ni siquiera podamos construirlo todavía.
  console.error(
    `\nConfiguración inválida. Revisa apps/api/.env (plantilla en .env.example):\n${detalle}\n`,
  );
  process.exit(1);
}

const parseado = resultado.data;

export const env = {
  ...parseado,
  /** Orígenes permitidos por CORS (acepta una lista separada por comas). */
  corsOrigins: parseado.CORS_ORIGIN.split(",")
    .map((origen) => origen.trim())
    .filter(Boolean),
  esProduccion: parseado.NODE_ENV === "production",
  esDesarrollo: parseado.NODE_ENV === "development",
  esTest: parseado.NODE_ENV === "test",
} as const;

export type Env = typeof env;
