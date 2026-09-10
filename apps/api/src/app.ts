import express, { type Express, Router } from "express";
import cookieParser from "cookie-parser";
import cors, { type CorsOptions } from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { API_PREFIX } from "@proplay/shared";
import { env } from "./config/env";
import { revisarSalud } from "./config/health";
import { logger } from "./config/logger";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { limiteGlobal } from "./middleware/rateLimit";
import { asyncHandler } from "./utils/asyncHandler";
import { authRouter, usuariosRouter } from "./modules/usuarios/usuarios.routes";
import { perfilesRouter } from "./modules/perfiles/perfiles.routes";
import { estadisticasRouter } from "./modules/estadisticas/estadisticas.routes";
import { scoutingRouter } from "./modules/scouting/scouting.routes";
import { matchingRouter } from "./modules/matching/matching.routes";
import { ofertasRouter } from "./modules/ofertas/ofertas.routes";
import { mensajeriaRouter } from "./modules/mensajeria/mensajeria.routes";
import { notificacionesRouter } from "./modules/notificaciones/notificaciones.routes";
import { adminRouter } from "./modules/admin/admin.routes";

/**
 * Construye la aplicación Express: middlewares de transporte, routers de los
 * nueve módulos de negocio bajo /api/v1 y manejo de errores centralizado.
 *
 * server.ts es quien la arranca; las pruebas la importan sin abrir puerto.
 */
export function crearApp(): Express {
  const app = express();

  // Detrás del proxy de Railway/Render para que rate-limit vea la IP real.
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(cors(opcionesCors()));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  if (!env.esTest) {
    app.use(
      pinoHttp({
        logger,
        customLogLevel: (_req, res, error) => {
          if (error || res.statusCode >= 500) return "error";
          if (res.statusCode >= 400) return "warn";
          return "info";
        },
      }),
    );
  }

  app.use(limiteGlobal);

  app.use(API_PREFIX, crearRouterApi());

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

function crearRouterApi(): Router {
  const api = Router();

  // Estado de la API y de sus dependencias.
  api.get(
    "/health",
    asyncHandler(async (_req, res) => {
      const salud = await revisarSalud();
      res.status(salud.status === "ok" ? 200 : 503).json(salud);
    }),
  );

  // Módulo usuarios: autenticación + gestión de cuentas.
  api.use("/auth", authRouter);
  api.use("/usuarios", usuariosRouter);

  // Módulos de negocio restantes (andamiaje: responden 501).
  api.use("/perfiles", perfilesRouter);
  api.use("/estadisticas", estadisticasRouter);
  api.use("/scouting", scoutingRouter);
  api.use("/matching", matchingRouter);
  api.use("/ofertas", ofertasRouter);
  api.use("/mensajeria", mensajeriaRouter);
  api.use("/notificaciones", notificacionesRouter);
  api.use("/admin", adminRouter);

  return api;
}

/**
 * CORS: en desarrollo el cliente corre en otro puerto (5173), así que hay que
 * permitir su origen explícitamente. `credentials: true` es imprescindible
 * para que viaje la cookie httpOnly del refresh token.
 */
function opcionesCors(): CorsOptions {
  return {
    origin(origen, callback) {
      // Peticiones sin Origin (curl, health checks, same-origin) pasan.
      if (!origen || env.corsOrigins.includes(origen)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origen no permitido por CORS: ${origen}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86_400,
  };
}
