import type { ModoMatching } from "@proplay/shared";

/**
 * RF-09 · Componente colaborativo (Sección VIII-C): ajusta el puntaje con las
 * interacciones previas entre equipos y jugadores. Mientras el historial sea
 * insuficiente su peso es 0 y el motor opera sólo por contenido: la respuesta
 * del documento al arranque en frío.
 *
 * Aquí sólo existe el punto de enganche. Con peso wc, el puntaje final es
 *   S' = (1 − wc)·S + wc·C
 * que con wc = 0 es exactamente la ecuación (1).
 */
export interface ComponenteColaborativo {
  /** Peso del componente para el equipo que publica la oferta, en [0, 1]. */
  peso(equipoId: string): number;
  /** Puntaje colaborativo de cada candidato, en [0, 1]; los que falten valen 0. */
  puntajes(equipoId: string, jugadorIds: readonly string[]): Map<string, number>;
}

/** Arranque en frío: sin historial, peso 0 y ningún puntaje. */
export const arranqueEnFrio: ComponenteColaborativo = {
  peso: () => 0,
  puntajes: () => new Map(),
};

export function modoDe(pesoColaborativo: number): ModoMatching {
  return pesoColaborativo > 0 ? "HIBRIDO" : "CONTENIDO";
}

/** Mezcla el puntaje por contenido con el colaborativo. */
export function combinar(contenido: number, colaborativo: number, peso: number): number {
  return (1 - peso) * contenido + peso * colaborativo;
}
