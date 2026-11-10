import {
  DIMENSIONES_MATCHING,
  TOLERANCIA_SUMA_PESOS,
  type DesgloseMatching,
  type ExplicacionMatching,
  type PesosMatching,
} from "@proplay/shared";
import {
  evaluarDisponibilidad,
  evaluarExperiencia,
  evaluarGeografica,
  evaluarHabilidadesBlandas,
} from "./dimensiones";
import { clamp01 } from "./escalas";
import { evaluarTecnica } from "./tecnica";
import type { JugadorMotor, OfertaMotor } from "./tipos";

/**
 * RF-09 · Ponderador: la ecuación (1) de la Sección VIII,
 *
 *   S(j, o) = Σ wₖ·dₖ(j, o),  Σ wₖ = 1
 *
 * con los pesos de la oferta. No se redondea nada: el redondeo es sólo de
 * presentación, así el desglose ponderado suma exactamente el puntaje.
 */

export interface Puntuacion {
  jugadorId: string;
  puntaje: number;
  desglose: DesgloseMatching;
  explicacion: ExplicacionMatching;
}

/**
 * Pesos que suman 1. La oferta ya llega validada por `pesosMatchingSchema`;
 * esto sólo protege de una fila escrita a mano: negativos a 0 y, si la suma se
 * sale de la tolerancia, se reparte en proporción (o por igual si todo es 0).
 */
export function normalizarPesos(pesos: PesosMatching): PesosMatching {
  const limpios = Object.fromEntries(
    DIMENSIONES_MATCHING.map((d) => [d, Math.max(0, Number.isFinite(pesos[d]) ? pesos[d] : 0)]),
  ) as PesosMatching;
  const suma = DIMENSIONES_MATCHING.reduce((s, d) => s + limpios[d], 0);
  if (Math.abs(suma - 1) <= TOLERANCIA_SUMA_PESOS && suma > 0) return limpios;
  return Object.fromEntries(
    DIMENSIONES_MATCHING.map((d) => [
      d,
      suma > 0 ? limpios[d] / suma : 1 / DIMENSIONES_MATCHING.length,
    ]),
  ) as PesosMatching;
}

/** Puntúa a un candidato frente a una oferta en las cinco dimensiones. */
export function puntuar(jugador: JugadorMotor, oferta: OfertaMotor): Puntuacion {
  const pesos = normalizarPesos(oferta.pesos);
  const tecnica = evaluarTecnica(jugador, oferta);
  const experiencia = evaluarExperiencia();
  const habilidadesBlandas = evaluarHabilidadesBlandas(jugador);
  const geografica = evaluarGeografica(jugador, oferta);
  const disponibilidad = evaluarDisponibilidad(jugador, oferta);

  const desglose: DesgloseMatching = {
    tecnica: tecnica.valor,
    experiencia: experiencia.valor,
    habilidadesBlandas: habilidadesBlandas.valor,
    geografica: geografica.valor,
    disponibilidad: disponibilidad.valor,
  };
  return {
    jugadorId: jugador.jugadorId,
    puntaje: clamp01(contribucionTotal(desglose, pesos)),
    desglose,
    explicacion: {
      pesos,
      dimensiones: {
        tecnica: tecnica.explicacion,
        experiencia: experiencia.explicacion,
        habilidadesBlandas: habilidadesBlandas.explicacion,
        geografica: geografica.explicacion,
        disponibilidad: disponibilidad.explicacion,
      },
    },
  };
}

/** Σ wₖ·dₖ. */
export function contribucionTotal(desglose: DesgloseMatching, pesos: PesosMatching): number {
  return DIMENSIONES_MATCHING.reduce((s, d) => s + pesos[d] * desglose[d], 0);
}

/**
 * Orden estable del ranking: puntaje de mayor a menor; a igualdad, la técnica
 * (lo verificable desempata) y, por último, el id del jugador.
 */
export function compararCandidatos(
  a: Pick<Puntuacion, "jugadorId" | "puntaje" | "desglose">,
  b: Pick<Puntuacion, "jugadorId" | "puntaje" | "desglose">,
): number {
  return (
    b.puntaje - a.puntaje ||
    b.desglose.tecnica - a.desglose.tecnica ||
    (a.jugadorId < b.jugadorId ? -1 : a.jugadorId > b.jugadorId ? 1 : 0)
  );
}

export function ordenarRanking<T extends Pick<Puntuacion, "jugadorId" | "puntaje" | "desglose">>(
  candidatos: readonly T[],
): T[] {
  return [...candidatos].sort(compararCandidatos);
}
