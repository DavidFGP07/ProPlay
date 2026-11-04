import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { accionSimulada, simulado } from '@/api/demo'
import { explicarMatching, listarJugadores, obtenerRanking, obtenerRecomendaciones } from '@/mocks/api'
import type { FiltrosBusqueda, Pesos, ResultadoMatching } from '@/mocks/modelos'

// RF-13 · Jugadores de la simulacion, para las recomendaciones del panel del
// equipo. El buscador real es useBuscarJugadores (api/scouting.ts).
export function useJugadores(filtros: FiltrosBusqueda = {}) {
  return useQuery({
    queryKey: ['scouting', 'demo', filtros],
    // TODO: S3 — sustituir por el ranking del motor de matching
    queryFn: () => simulado(() => listarJugadores(filtros), []),
    placeholderData: keepPreviousData,
  })
}

// RF-09 · Ranking de candidatos con puntaje de compatibilidad
export function useCandidatos(ofertaId: string | undefined, pesos: Pesos) {
  return useQuery({
    queryKey: ['matching', 'oferta', ofertaId, pesos],
    enabled: Boolean(ofertaId),
    // TODO: S3 — conectar con GET /api/v1/matching/oferta/:id
    queryFn: () => simulado(() => obtenerRanking(ofertaId!, { pesos }), null),
    placeholderData: keepPreviousData,
  })
}

// RF-09 · Ofertas recomendadas para el jugador en sesion
export function useRecomendaciones(perfilId: string | undefined, pesos: Pesos) {
  return useQuery({
    queryKey: ['matching', 'jugador', perfilId, pesos],
    enabled: Boolean(perfilId),
    // TODO: S3 — conectar con GET /api/v1/matching/jugador/me
    queryFn: () => simulado(() => obtenerRecomendaciones(perfilId!, { pesos }), []),
  })
}

// RF-11 · Explicacion del matching en lenguaje natural, bajo demanda
export function useExplicarMatching() {
  return useMutation({
    mutationFn: ({
      ofertaId,
      perfilId,
      resultados,
    }: {
      ofertaId: string
      perfilId: string
      resultados?: ResultadoMatching[]
    }) =>
      // TODO: S4 — conectar con POST /api/v1/matching/calcular
      accionSimulada(() => explicarMatching(ofertaId, perfilId, resultados)),
  })
}
