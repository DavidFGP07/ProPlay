import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  estadisticaSchema,
  estadoSincronizacionSchema,
  resumenEstadisticasSchema,
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

export const CLAVE_SINCRONIZACION = ['estadisticas', 'sincronizacion'] as const

/** Cada cuanto se consulta una sincronizacion en cola o en curso. */
const MS_CONSULTA_SINCRONIZACION = 3_000

// RF-03 · Ingesta desde la API de Riot. API real. Pedirla la encola (202) y la
// hace el worker cuando hay cupo en la cuota de Riot: la vista consulta el
// estado mientras esta en cola o en curso y, al terminar, recarga los datos.
export function useSincronizacion() {
  const cliente = useQueryClient()

  const estado = useQuery({
    queryKey: CLAVE_SINCRONIZACION,
    queryFn: async () => {
      const { data } = await api.get<unknown>('/estadisticas/sincronizacion')
      return estadoSincronizacionSchema.parse(data)
    },
    retry: false,
    refetchInterval: (consulta) =>
      consulta.state.data && consulta.state.data.estado !== 'INACTIVA'
        ? MS_CONSULTA_SINCRONIZACION
        : false,
  })

  const sincronizar = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<unknown>('/estadisticas/sincronizar', {})
      return estadoSincronizacionSchema.parse(data)
    },
    onSuccess: (nuevo) => cliente.setQueryData(CLAVE_SINCRONIZACION, nuevo),
  })

  // Al pasar de en cola o en curso a terminada, los datos ya son otros.
  const anterior = useRef(estado.data?.estado)
  const actual = estado.data?.estado
  useEffect(() => {
    if (anterior.current && anterior.current !== 'INACTIVA' && actual === 'INACTIVA') {
      void cliente.invalidateQueries({ queryKey: ['estadisticas', 'resumen'] })
      void cliente.invalidateQueries({ queryKey: ['estadisticas', 'historial'] })
      void cliente.invalidateQueries({ queryKey: CLAVE_CUENTAS, exact: true })
    }
    anterior.current = actual
  }, [actual, cliente])

  return { estado, sincronizar }
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
