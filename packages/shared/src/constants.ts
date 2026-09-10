/**
 * Constantes compartidas entre api y web.
 */

/** Prefijo de la API REST versionada. */
export const API_PREFIX = "/api/v1";

/** Vigencia del token de acceso (JWT en memoria del cliente). */
export const ACCESS_TOKEN_TTL = "15m";
/** Vigencia del refresh token (cookie httpOnly). */
export const REFRESH_TOKEN_TTL = "7d";
/** Nombre de la cookie httpOnly que transporta el refresh token. */
export const REFRESH_COOKIE_NAME = "proplay_refresh";
/** Vigencia del refresh token en milisegundos (para maxAge de la cookie). */
export const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Paginación por defecto de los listados. */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** Reglas de contraseña aplicadas en ambos lados. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72; // límite de bcrypt

/** Nivel de habilidad declarado por el jugador (1 = básico, 5 = experto). */
export const NIVEL_HABILIDAD_MIN = 1;
export const NIVEL_HABILIDAD_MAX = 5;

/** Dimensiones del vector de características usado por el matching. */
export const PERFIL_VECTOR_DIMENSIONES = 64;
/** Versión del algoritmo que produjo el vector. */
export const PERFIL_VECTOR_VERSION = 1;

/**
 * Pesos de las cinco dimensiones del algoritmo de compatibilidad.
 * Configurables aquí: son la única fuente de verdad para api y web.
 * La suma debe ser 1.
 */
export const PESOS_MATCHING = {
  tecnica: 0.35,
  experiencia: 0.2,
  habilidadesBlandas: 0.15,
  geografica: 0.15,
  disponibilidad: 0.15,
} as const;

export type DimensionMatching = keyof typeof PESOS_MATCHING;

/** Umbral a partir del cual un match se considera relevante para el scout. */
export const UMBRAL_MATCH_RELEVANTE = 0.6;

/** Límite de subida de medios a Cloudinary. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
