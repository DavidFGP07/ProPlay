import type { Request } from "express";
import rateLimit, { type Options } from "express-rate-limit";
import { REFRESH_COOKIE_NAME } from "@proplay/shared";
import { env } from "../config/env";
import { verificarRefreshToken } from "../utils/jwt";

/**
 * Límite de peticiones. En tests se desactiva para que las pruebas de
 * integración no se topen con el contador entre casos.
 */
const respuestaLimite: Partial<Options> = {
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Has hecho demasiadas peticiones, inténtalo en unos minutos",
    },
  },
  skip: () => env.esTest,
};

/** Límite global aplicado a toda la API. */
export const limiteGlobal = rateLimit({
  ...respuestaLimite,
  windowMs: 15 * 60 * 1000,
  limit: 300,
});

/** Límite estricto para registro e inicio de sesión (fuerza bruta). */
export const limiteAuth = rateLimit({
  ...respuestaLimite,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: false,
  message: {
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Demasiados intentos de autenticación, espera unos minutos",
    },
  },
});

/**
 * Clave del límite de /auth/refresh: el usuario dueño del refresh token.
 *
 * El access token vive en memoria en el cliente, así que cada recarga de la
 * página gasta un refresco: contar por IP bloquearía entre sí a quienes
 * comparten red (una universidad, un café). El token rota en cada uso, de modo
 * que tampoco sirve como clave; el sujeto verificado sí. Sin un token válido
 * se cuenta por IP, para que inundar con tokens falsos siga teniendo techo.
 */
export function claveRefresh(req: Request): string {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  const token = cookies?.[REFRESH_COOKIE_NAME];
  if (token) {
    try {
      return `usuario:${verificarRefreshToken(token).sub}`;
    } catch {
      // Token inválido o expirado: cae al límite por IP.
    }
  }
  return `ip:${req.ip ?? "desconocida"}`;
}

/** Límite propio de /auth/refresh: holgado y por usuario (ver claveRefresh). */
export const limiteRefresh = rateLimit({
  ...respuestaLimite,
  windowMs: 15 * 60 * 1000,
  limit: 60,
  keyGenerator: claveRefresh,
  message: {
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Demasiadas renovaciones de sesión, espera unos minutos",
    },
  },
});

/**
 * Clave de los límites de rutas autenticadas: el usuario de la sesión, con el
 * mismo criterio que claveRefresh (una red compartida no bloquea a todos).
 * Requiere que el middleware auth vaya antes.
 */
export function claveUsuario(req: Request): string {
  return req.usuario ? `usuario:${req.usuario.id}` : `ip:${req.ip ?? "desconocida"}`;
}

/**
 * Configuración del límite de cambio de contraseña: 5 intentos cada 15
 * minutos por usuario, contra quien prueba contraseñas actuales con una
 * sesión robada. Se exporta para poder probarla sin el `skip` de los tests.
 */
export const opcionesLimiteCambioContrasena: Partial<Options> = {
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator: claveUsuario,
  message: {
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Demasiados intentos de cambio de contraseña, espera unos minutos",
    },
  },
};

export const limiteCambioContrasena = rateLimit({
  ...respuestaLimite,
  ...opcionesLimiteCambioContrasena,
});

/**
 * Configuración del límite del perfil público: 120 consultas cada 15 minutos,
 * por usuario si hay sesión y por IP si no. Es la única lectura sin sesión de
 * la API y frena el recorrido masivo de perfiles; el límite global sigue
 * aplicando por encima. Por IP sólo es fiable con TRUST_PROXY bien fijado.
 */
export const opcionesLimitePerfilPublico: Partial<Options> = {
  windowMs: 15 * 60 * 1000,
  limit: 120,
  keyGenerator: claveUsuario,
  message: {
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Has consultado demasiados perfiles, espera unos minutos",
    },
  },
};

export const limitePerfilPublico = rateLimit({
  ...respuestaLimite,
  ...opcionesLimitePerfilPublico,
});

/**
 * Configuración del límite del buscador de talento (RF-08): 120 búsquedas cada
 * 15 minutos por usuario. Exige sesión de equipo, scout o administrador, pero
 * cada página trae varios perfiles: frena que una cuenta recorra a todos los
 * jugadores. El límite global sigue aplicando por encima. Se exporta para
 * poder probarla sin el `skip` de los tests.
 */
export const opcionesLimiteBusqueda: Partial<Options> = {
  windowMs: 15 * 60 * 1000,
  limit: 120,
  keyGenerator: claveUsuario,
  message: {
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Has hecho demasiadas búsquedas, espera unos minutos",
    },
  },
};

export const limiteBusqueda = rateLimit({
  ...respuestaLimite,
  ...opcionesLimiteBusqueda,
});

/**
 * Configuración del límite de la vinculación con Riot: 10 peticiones cada 15
 * minutos por usuario, sumando pedir el desafío y «generar otro icono». Cada
 * una consulta la API de Riot, cuya cuota (100 peticiones cada dos minutos con
 * la clave de desarrollo) es de toda la aplicación: sin este límite, un solo
 * usuario podría agotarla. Las comprobaciones del icono no cuentan aquí: Riot
 * tarda minutos en reflejar el cambio y la espera agotaría el límite; tienen
 * su propio cupo por desafío (MAX_COMPROBACIONES_DESAFIO, en el servicio).
 * Se exporta para poder probarla sin el `skip` de los tests.
 */
export const opcionesLimiteVinculacionRiot: Partial<Options> = {
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: claveUsuario,
  message: {
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Demasiados intentos de vincular la cuenta de Riot, espera unos minutos",
    },
  },
};

/** Una sola instancia para las dos rutas: comparten el contador. */
export const limiteVinculacionRiot = rateLimit({
  ...respuestaLimite,
  ...opcionesLimiteVinculacionRiot,
});

