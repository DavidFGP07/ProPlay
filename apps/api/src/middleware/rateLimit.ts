import rateLimit, { type Options } from "express-rate-limit";
import { env } from "../config/env";

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

/** Límite estricto para las rutas de autenticación (fuerza bruta). */
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
