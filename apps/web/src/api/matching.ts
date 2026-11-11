import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  candidatoOfertaSchema,
  rankingOfertaSchema,
  type OrdenRanking,
  type RankingOferta,
} from '@proplay/shared'
import { api } from '@/api/client'
import { simulado } from '@/api/demo'
import { obtenerRecomendaciones } from '@/mocks/api'
import type { Pesos } from '@/mocks/modelos'

/*
 * Ranking de candidatos y detalle del candidato: API real, sin puente de
 * demostracion. Las respuestas se leen con los esquemas de @proplay/shared,
 * que convierten las fechas.
 */

/** Filtro, orden y pagina del ranking: la query de `rankingOfertaQuerySchema`. */
export interface FiltrosRanking {
  page: number
  soloPostulados: boolean
  orden: OrdenRanking
}

const claveRanking = (ofertaId: string | undefined, filtros: FiltrosRanking) =>
  ['matching', 'ranking', ofertaId, filtros] as const

// RF-09 · Ranking de candidatos de una oferta con el desglose por dimension
export function useRankingOferta(ofertaId: string | undefined, filtros: FiltrosRanking) {
  return useQuery({
    queryKey: claveRanking(ofertaId, filtros),
    enabled: Boolean(ofertaId),
    // La pagina anterior se mantiene en pantalla mientras llega la siguiente.
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data } = await api.get(`/matching/ofertas/${ofertaId}/ranking`, { params: filtros })
      return rankingOfertaSchema.parse(data)
    },
  })
}

// RF-09 · RF-11 · Un candidato del ranking con la explicacion de su puntaje
export function useCandidatoOferta(ofertaId: string | undefined, jugadorId: string | undefined) {
  return useQuery({
    queryKey: ['matching', 'candidato', ofertaId, jugadorId],
    enabled: Boolean(ofertaId && jugadorId),
    queryFn: async () => {
      const { data } = await api.get(`/matching/ofertas/${ofertaId}/candidatos/${jugadorId}`)
      return candidatoOfertaSchema.parse(data)
    },
  })
}

// RF-09 · Recalcular el ranking a demanda (equipo dueño y scout)
export function useRecalcularRanking(ofertaId: string | undefined, filtros: FiltrosRanking) {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<RankingOferta> => {
      const { data } = await api.post(`/matching/ofertas/${ofertaId}/recalcular`, undefined, {
        params: filtros,
      })
      return rankingOfertaSchema.parse(data)
    },
    onSuccess: async (ranking) => {
      // Lo demas del matching queda obsoleto sin volver a pedirlo ahora; la
      // pagina que se esta viendo se actualiza con la respuesta.
      await cliente.invalidateQueries({ queryKey: ['matching'], refetchType: 'none' })
      cliente.setQueryData(claveRanking(ofertaId, filtros), ranking)
    },
  })
}

/*
 * Recomendaciones del feed del jugador: siguen simuladas (la vista es de
 * trabajo futuro y GET /matching/jugador/me responde 501).
 */

// RF-09 · Ofertas recomendadas para el jugador en sesion
export function useRecomendaciones(perfilId: string | undefined, pesos: Pesos) {
  return useQuery({
    queryKey: ['matching', 'demo', 'jugador', perfilId, pesos],
    enabled: Boolean(perfilId),
    // TODO: S3 — conectar con GET /api/v1/matching/jugador/me
    queryFn: () => simulado(() => obtenerRecomendaciones(perfilId!, { pesos }), []),
  })
}
