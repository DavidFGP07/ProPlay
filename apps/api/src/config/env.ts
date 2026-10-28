import { isIP } from "node:net";
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

/** Nombres que Express acepta en "trust proxy" para rangos de red conocidos. */
const RANGOS_CON_NOMBRE = new Set(["loopback", "linklocal", "uniquelocal"]);

function esDireccionOSubred(valor: string): boolean {
  if (RANGOS_CON_NOMBRE.has(valor)) return true;
  const [direccion = "", prefijo, ...resto] = valor.split("/");
  const version = isIP(direccion);
  if (version === 0 || resto.length > 0) return false;
  if (prefijo === undefined) return true;
  const bits = Number(prefijo);
  return /^\d+$/.test(prefijo) && bits <= (version === 4 ? 32 : 128);
}

/**
 * Valor de TRUST_PROXY para el setting "trust proxy" de Express, o `null` si
 * no es válido. Sin variable (o con 0 / false) no se confía en ningún proxy:
 * `req.ip` es la IP de la conexión y X-Forwarded-For se ignora. Es lo correcto
 * sin proxy delante, porque cualquiera puede escribir esa cabecera y, si se le
 * hiciera caso, saltarse los límites por IP con sólo cambiarla.
 *
 * Admite el número de proxies delante de la API (1 en Railway o Render) o una
 * lista separada por comas de direcciones, subredes CIDR y los nombres
 * loopback, linklocal y uniquelocal. `true` se rechaza: confiaría en
 * cualquier cliente y equivale a no tener límite por IP.
 */
export function interpretarTrustProxy(
  valor: string | undefined,
): false | number | string[] | null {
  const limpio = valor?.trim() ?? "";
  if (limpio === "" || limpio === "0" || limpio === "false") return false;
  if (/^\d+$/.test(limpio)) return Number(limpio);
  const entradas = limpio.split(",").map((entrada) => entrada.trim());
  return entradas.every(esDireccionOSubred) ? entradas : null;
}

export const envSchema = z.object({
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

  TRUST_PROXY: z
    .string()
    .optional()
    .refine(
      (valor) => interpretarTrustProxy(valor) !== null,
      "TRUST_PROXY debe ser el número de proxies delante de la API (p. ej. 1) o una lista de direcciones o subredes; `true` no se admite",
    ),

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
}).superRefine((valores, ctx) => {
  // En el despliegue hay que decidirlo de forma explícita (0 si no hay proxy):
  // olvidarla dejaría a todos los anónimos tras el proxy con la misma IP.
  if (valores.NODE_ENV === "production" && !valores.TRUST_PROXY?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["TRUST_PROXY"],
      message: "TRUST_PROXY es obligatoria en producción (1 detrás de Railway o Render, 0 sin proxy)",
    });
  }
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
  /** Setting "trust proxy" de Express (ver interpretarTrustProxy). */
  trustProxy: interpretarTrustProxy(parseado.TRUST_PROXY) ?? false,
  esProduccion: parseado.NODE_ENV === "production",
  esDesarrollo: parseado.NODE_ENV === "development",
  esTest: parseado.NODE_ENV === "test",
} as const;

export type Env = typeof env;
