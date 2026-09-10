import { PESOS_MATCHING, UMBRAL_MATCH_RELEVANTE } from "@proplay/shared";
import * as repositorio from "./matching.repository";
import type { DesgloseMatching } from "./matching.schema";

/**
 * Lógica de negocio del módulo `matching`: Algoritmo de compatibilidad entre jugadores y ofertas.
 *
 * Andamiaje: cada función delega en el repositorio, que todavía lanza
 * NotImplementedError (501).
 */

/** TODO: Calcular y persistir el ranking de jugadores compatibles con una oferta. */
export async function calcular(datos?: unknown) {
  return repositorio.calcular(datos);
}

/** TODO: Devolver el ranking ya calculado de una oferta, ordenado por puntaje. */
export async function rankingPorOferta(datos?: unknown) {
  return repositorio.rankingPorOferta(datos);
}

/** TODO: Devolver las ofertas más compatibles con el jugador autenticado. */
export async function ofertasCompatibles(datos?: unknown) {
  return repositorio.ofertasCompatibles(datos);
}

// ---------------------------------------------------------------------------
// Algoritmo de compatibilidad
// ---------------------------------------------------------------------------

/** Datos del jugador que consume el algoritmo. */
export interface JugadorParaMatching {
  jugadorId: string;
  juego?: string;
  rol?: string | null;
  region?: string | null;
  paisId?: string | null;
  aniosExperiencia?: number;
  disponibilidadHoras?: number | null;
  dispuestoRelocalizar?: boolean;
  /** Vector de características calculado por el módulo de perfiles. */
  dimensiones?: number[];
}

/** Datos de la oferta contra la que se compara. */
export interface OfertaParaMatching {
  ofertaId: string;
  juego: string;
  rol: string;
  region?: string | null;
  experienciaMinAnios?: number;
  horasSemana?: number | null;
}

export interface ResultadoCompatibilidad {
  puntaje: number;
  desglose: DesgloseMatching;
  relevante: boolean;
}

/**
 * Compatibilidad entre un jugador y una oferta.
 *
 * El puntaje final es la media ponderada de cinco dimensiones, con los pesos
 * definidos en PESOS_MATCHING (@proplay/shared/constants):
 *
 *   1. tecnica            — similitud entre las estadísticas del jugador y el
 *                           rango/rol que pide la oferta.
 *   2. experiencia        — años de trayectoria frente a experienciaMinAnios.
 *   3. habilidadesBlandas — habilidades BLANDA endosadas y su nivel.
 *   4. geografica         — coincidencia de región y disposición a relocalizar.
 *   5. disponibilidad     — horas semanales declaradas frente a las de la oferta.
 *
 * TODO: implementar el cálculo real de cada dimensión. Por ahora devuelve un
 * valor fijo para que el contrato y los pesos ya estén cerrados.
 */
export function calcularCompatibilidad(
  _jugador: JugadorParaMatching,
  _oferta: OfertaParaMatching,
): ResultadoCompatibilidad {
  const desglose: DesgloseMatching = {
    tecnica: 0.5,
    experiencia: 0.5,
    habilidadesBlandas: 0.5,
    geografica: 0.5,
    disponibilidad: 0.5,
  };

  const puntaje = Number(
    (
      desglose.tecnica * PESOS_MATCHING.tecnica +
      desglose.experiencia * PESOS_MATCHING.experiencia +
      desglose.habilidadesBlandas * PESOS_MATCHING.habilidadesBlandas +
      desglose.geografica * PESOS_MATCHING.geografica +
      desglose.disponibilidad * PESOS_MATCHING.disponibilidad
    ).toFixed(4),
  );

  return {
    puntaje,
    desglose,
    relevante: puntaje >= UMBRAL_MATCH_RELEVANTE,
  };
}
