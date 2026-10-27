/**
 * Constantes compartidas entre api y web.
 */
import type { Departamento } from "./enums";

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

/**
 * Versión vigente del aviso de privacidad y los términos de uso (RNF-05).
 * El servidor guarda esta versión al registrar la aceptación; nunca una que
 * envíe el cliente. Súbela cada vez que cambie el texto del aviso.
 */
export const VERSION_AVISO_PRIVACIDAD = "1.0";

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

/**
 * Países admitidos en la ubicación del jugador: códigos ISO 3166-1 alfa-2
 * asignados oficialmente. Se guardan en `PerfilJugador.pais` (`CHAR(2)`). No es
 * un enum de Prisma porque la lista es larga y la mantiene ISO.
 */
export const PAISES = [
  "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ",
  "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS",
  "BT", "BV", "BW", "BY", "BZ",
  "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN", "CO", "CR", "CU", "CV", "CW",
  "CX", "CY", "CZ",
  "DE", "DJ", "DK", "DM", "DO", "DZ",
  "EC", "EE", "EG", "EH", "ER", "ES", "ET",
  "FI", "FJ", "FK", "FM", "FO", "FR",
  "GA", "GB", "GD", "GE", "GF", "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT",
  "GU", "GW", "GY",
  "HK", "HM", "HN", "HR", "HT", "HU",
  "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT",
  "JE", "JM", "JO", "JP",
  "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ",
  "LA", "LB", "LC", "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY",
  "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK", "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS",
  "MT", "MU", "MV", "MW", "MX", "MY", "MZ",
  "NA", "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ",
  "OM",
  "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW", "PY",
  "QA",
  "RE", "RO", "RS", "RU", "RW",
  "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS",
  "ST", "SV", "SX", "SY", "SZ",
  "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO", "TR", "TT", "TV", "TW", "TZ",
  "UA", "UG", "UM", "US", "UY", "UZ",
  "VA", "VC", "VE", "VG", "VI", "VN", "VU",
  "WF", "WS",
  "YE", "YT",
  "ZA", "ZM", "ZW",
] as const;
export type Pais = (typeof PAISES)[number];

/** País cuya ubicación se precisa por departamento (el piloto es en el Caribe colombiano). */
export const PAIS_CON_DEPARTAMENTO = "CO" satisfies Pais;

/**
 * Macrorregiones de Colombia. No se guardan: se derivan del departamento con
 * `MACROREGION_POR_DEPARTAMENTO`. Las usa la dimensión geográfica del matching
 * (misma macrorregión = coincidencia parcial) y el análisis por segmento del
 * piloto (el Caribe frente al resto del país).
 */
export const MACROREGIONES = [
  "CARIBE",
  "ANDINA",
  "PACIFICA",
  "ORINOQUIA",
  "AMAZONIA",
] as const;
export type Macrorregion = (typeof MACROREGIONES)[number];

/**
 * Macrorregión de cada departamento. Un departamento que abarca varias regiones
 * naturales se asigna a una sola, como en las regiones administrativas de
 * planificación: Cauca, Chocó, Nariño y Valle del Cauca son Pacífica; Antioquia
 * y Norte de Santander, Andina. San Andrés, que en la división natural es
 * Insular, cuenta como Caribe para el piloto.
 */
export const MACROREGION_POR_DEPARTAMENTO = {
  AMAZONAS: "AMAZONIA",
  ANTIOQUIA: "ANDINA",
  ARAUCA: "ORINOQUIA",
  ATLANTICO: "CARIBE",
  BOGOTA_DC: "ANDINA",
  BOLIVAR: "CARIBE",
  BOYACA: "ANDINA",
  CALDAS: "ANDINA",
  CAQUETA: "AMAZONIA",
  CASANARE: "ORINOQUIA",
  CAUCA: "PACIFICA",
  CESAR: "CARIBE",
  CHOCO: "PACIFICA",
  CORDOBA: "CARIBE",
  CUNDINAMARCA: "ANDINA",
  GUAINIA: "AMAZONIA",
  GUAVIARE: "AMAZONIA",
  HUILA: "ANDINA",
  LA_GUAJIRA: "CARIBE",
  MAGDALENA: "CARIBE",
  META: "ORINOQUIA",
  NARINO: "PACIFICA",
  NORTE_DE_SANTANDER: "ANDINA",
  PUTUMAYO: "AMAZONIA",
  QUINDIO: "ANDINA",
  RISARALDA: "ANDINA",
  SAN_ANDRES: "CARIBE",
  SANTANDER: "ANDINA",
  SUCRE: "CARIBE",
  TOLIMA: "ANDINA",
  VALLE_DEL_CAUCA: "PACIFICA",
  VAUPES: "AMAZONIA",
  VICHADA: "ORINOQUIA",
} as const satisfies Record<Departamento, Macrorregion>;
