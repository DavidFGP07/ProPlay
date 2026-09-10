import pino from "pino";
import { env } from "./env";

/**
 * Logger estructurado. En desarrollo se imprime legible con pino-pretty;
 * en producción sale JSON en una línea para que lo ingiera la plataforma.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  base: { servicio: "proplay-api", entorno: env.NODE_ENV },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
      "*.password",
      "*.passwordHash",
      "*.accessToken",
      "*.refreshToken",
    ],
    censor: "[oculto]",
  },
  transport: env.esProduccion
    ? undefined
    : {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss",
          ignore: "pid,hostname,servicio,entorno",
        },
      },
});

export type Logger = typeof logger;
