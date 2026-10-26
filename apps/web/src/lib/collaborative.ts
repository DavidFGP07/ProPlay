import type { Postulacion } from '@/mocks/modelos'
import { similitudCoseno } from '@/lib/vector'

/**
 * Componente colaborativo del motor de matching (Seccion VIII-C).
 *
 * Aplica la tecnica de factorizacion matricial de forma ligera: se construye
 * una matriz binaria equipo x jugador a partir de las interacciones (postulaciones
 * con senal positiva) y se deriva una similaridad item-item por coseno sobre los
 * vectores de perfil ya calculados.
 *
 * Al igual que en la referencia (Burke, 2002), mientras el historial de
 * interacciones sea insuficiente el peso del componente permanece en cero y el
 * sistema opera en modo puramente basado en contenido: es la respuesta prevista
 * al arranque en frio.
 */

export const MINIMO_INTERACCIONES = 3

export interface Interaccion {
  equipoId: string
  perfilId: string
  peso: number
}

const PESOS_ESTADO: Record<Postulacion['estado'], number> = {
  ENVIADA: 0.4,
  EN_REVISION: 0.7,
  ENTREVISTA: 0.9,
  ACEPTADA: 1,
  RECHAZADA: 0,
}

/** Construye la matriz de interacciones a partir de las postulaciones. */
export function construirInteracciones(
  postulaciones: Postulacion[],
  equipoDeOferta?: (ofertaId: string) => string | undefined,
): Interaccion[] {
  return postulaciones
    .filter((p) => PESOS_ESTADO[p.estado] > 0)
    .map((p) => ({
      equipoId: equipoDeOferta?.(p.ofertaId) ?? `desconocido:${p.ofertaId}`,
      perfilId: p.perfilId,
      peso: PESOS_ESTADO[p.estado],
    }))
    .filter((i) => !i.equipoId.startsWith('desconocido:'))
}

/** Agrupa las interacciones de un equipo. */
export function interaccionesDeEquipo(
  interacciones: Interaccion[],
  equipoId: string,
): Interaccion[] {
  return interacciones.filter((i) => i.equipoId === equipoId)
}

/**
 * Puntaje colaborativo de cada jugador para un equipo dado.
 *
 * Se calcula como el promedio ponderado de la similitud entre el jugador
 * evaluado y los jugadores con los que ese equipo ya interactuo, ponderado por
 * la fuerza de cada interaccion.
 */
export function puntajeColaborativo(
  equipoId: string,
  embeddingsPorPerfil: Map<string, number[]>,
  interacciones: Interaccion[],
): Map<string, number> {
  const propias = interaccionesDeEquipo(interacciones, equipoId)
  const out = new Map<string, number>()

  if (propias.length < MINIMO_INTERACCIONES) return out // arranque en frio

  const embEquipo = propias
    .map((i) => embeddingsPorPerfil.get(i.perfilId))
    .filter((e): e is number[] => Boolean(e))
  if (embEquipo.length === 0) return out

  for (const [perfilId, emb] of embeddingsPorPerfil) {
    let numerador = 0
    let denominador = 0
    for (const inter of propias) {
      const otro = embeddingsPorPerfil.get(inter.perfilId)
      if (!otro) continue
      const sim = Math.max(0, similitudCoseno(emb, otro))
      numerador += sim * inter.peso
      denominador += inter.peso
    }
    if (denominador > 0) out.set(perfilId, numerador / denominador)
  }
  return out
}

/** Indica si el equipo tiene historial suficiente para activar el componente. */
export function hayHistorialSuficiente(interacciones: Interaccion[], equipoId: string): boolean {
  return interaccionesDeEquipo(interacciones, equipoId).length >= MINIMO_INTERACCIONES
}
