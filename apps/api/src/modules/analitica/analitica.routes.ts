import { Router } from "express";
import { auth } from "../../middleware/auth";
import { limiteRanking } from "../../middleware/rateLimit";
import { rbac } from "../../middleware/rbac";
import { validate } from "../../middleware/validate";
import * as controlador from "./analitica.controller";
import { ofertaAnaliticaParamsSchema } from "./analitica.schema";

/**
 * Rutas del módulo `analitica`: /api/v1/analitica
 * Indicadores de la analítica fusionada con el panel del equipo. Sólo lectura.
 * Las métricas de todo el piloto no tienen ruta: salen por el script del
 * piloto (decisión 0.10, sin panel de administración).
 */
export const analiticaRouter = Router();

// RF-13 · Embudo agregado de las ofertas publicadas del equipo, con el tiempo
// hasta cubrir la vacante (H1), hasta el primer tryout y la cobertura.
analiticaRouter.get("/embudo", auth, rbac("EQUIPO"), controlador.embudoEquipo);

// RF-13 · Embudo de una oferta del equipo. Una ajena publicada responde 403;
// un borrador ajeno, 404; un borrador propio, 409 OFERTA_SIN_PUBLICAR.
analiticaRouter.get(
  "/ofertas/:id/embudo",
  auth,
  rbac("EQUIPO"),
  validate(ofertaAnaliticaParamsSchema, "params"),
  controlador.embudoOferta,
);

// RF-13 · Qué dimensión decide el ranking de una oferta del equipo. Pone al
// día el ranking antes de calcular, así que lleva el límite del ranking.
analiticaRouter.get(
  "/ofertas/:id/dimension-decisiva",
  auth,
  rbac("EQUIPO"),
  limiteRanking,
  validate(ofertaAnaliticaParamsSchema, "params"),
  controlador.dimensionDecisiva,
);

// RF-13 · Mapa del talento verificado por macrorregión, departamento, posición
// y rango, con el Caribe frente al resto. Equipo, scout y administrador.
analiticaRouter.get(
  "/talento",
  auth,
  rbac("EQUIPO", "SCOUT", "ADMIN"),
  controlador.talento,
);
