import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  estadisticaSchema,
  resumenEstadisticasSchema,
  sincronizarEstadisticasRespuestaSchema,
} from '@proplay/shared'
import { api } from '@/api/client'
import { CLAVE_CUENTAS } from '@/api/cuentasGaming'
import { ejecutarIngesta, obtenerEstadoWorker, type ResultadoIngesta } from '@/mocks/api'
import { simulado, useMutacionSimulada } from '@/api/demo'

export type { ResultadoIngesta }

// RF-04 · RF-13 · Ultima captura por juego con su tendencia. API real.
export function useResumenEstadisticas(jugadorId: string | undefined) {
  return useQuery({
    queryKey: ['estadisticas', 'resumen', jugadorId],
    enabled: Boolean(jugadorId),
    queryFn: async () => {
      const { data } = await api.get<unknown>(`/estadisticas/jugador/${jugadorId}/resumen`)
      return resumenEstadisticasSchema.parse(data)
    },
  })
}

// RF-13 · Historico de capturas (tendencia del rendimiento). API real.
export function useHistorialEstadisticas(jugadorId: string | undefined) {
  return useQuery({
    queryKey: ['estadisticas', 'historial', jugadorId],
    enabled: Boolean(jugadorId),
    queryFn: async () => {
      const { data } = await api.get<unknown>(`/estadisticas/jugador/${jugadorId}`)
      return estadisticaSchema.array().parse(data)
    },
  })
}

// RF-03 · Ingesta bajo demanda desde la API de Riot. API real.
export function useSincronizarEstadisticas() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<unknown>('/estadisticas/sincronizar', {})
      return sincronizarEstadisticasRespuestaSchema.parse(data)
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: ['estadisticas'] })
      void cliente.invalidateQueries({ queryKey: CLAVE_CUENTAS })
    },
  })
}

// RF-03 · Estado del worker de ingesta de estadisticas (barra superior)
export function useEstadoIngesta() {
  return useQuery({
    queryKey: ['estadisticas', 'worker'],
    // TODO: S2 — conectar cuando exista el worker periodico (tarea 2.5)
    queryFn: () =>
      simulado(obtenerEstadoWorker, { activo: false, ultimaSync: null, registros: 0, perfiles: 0 }),
    staleTime: 0,
  })
}

// RF-03 · Lanzar una sincronizacion global (prototipo de Feed y Admin)
export function useEjecutarIngesta() {
  return useMutacionSimulada(() =>
    // TODO: S2 — sustituir por el worker periodico (tarea 2.5)
    ejecutarIngesta(),
  )
}
