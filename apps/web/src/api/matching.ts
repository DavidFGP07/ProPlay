import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { accionSimulada, simulado } from '@/api/demo'
import { explicarMatching, listarJugadores, obtenerRanking, obtenerRecomendaciones } from '@/mocks/api'
import type { FiltrosBusqueda, Pesos, ResultadoMatching } from '@/types'

// RF-08 · Buscador de talento con filtros
export function useJugadores(filtros: FiltrosBusqueda = {}) {
  return useQuery({
    queryKey: ['scouting', 'jugadores', filtros],
    // TODO: S3 — conectar con GET /api/v1/scouting/jugadores
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
