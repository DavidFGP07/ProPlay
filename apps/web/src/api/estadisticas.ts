import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { Estadistica } from '@proplay/shared'
import type { ResultadoIngesta } from '@/mocks/api'

const CLAVE_WORKER = ['estadisticas', 'worker'] as const

/** Estado del worker de ingesta de estadisticas. */
export interface EstadoWorker {
  activo: boolean
  ultimaSync: string | null
  registros: number
  perfiles: number
}

function estadoInicial(): EstadoWorker {
  return { activo: false, ultimaSync: null, registros: 0, perfiles: 0 }
}

// RF-03 · Estado del worker de ingesta de estadisticas. La cache la rellena la
// mutacion de sincronizar al terminar, asi que el estado se refleja sin un
// endpoint dedicado.
export function useEstadoIngesta() {
  const cliente = useQueryClient()
  return useQuery({
    queryKey: CLAVE_WORKER,
    queryFn: async (): Promise<EstadoWorker> => {
      const desdeCache = cliente.getQueryData<EstadoWorker>(CLAVE_WORKER)
      return desdeCache ?? estadoInicial()
    },
    initialData: estadoInicial(),
    staleTime: Infinity,
  })
}

// RF-03 · Lanzar una sincronizacion con las APIs oficiales
export function useEjecutarIngesta() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: async (datos: {
      plataforma: string
      juego: string
    }): Promise<ResultadoIngesta> => {
      const { data } = await api.post<ResultadoIngesta>(
        '/estadisticas/sincronizar',
        datos,
      )
      return data
    },
    onSuccess: (resultado) => {
      cliente.setQueryData(CLAVE_WORKER, {
        activo: true,
        ultimaSync: new Date().toISOString(),
        registros: resultado.registrosActualizados,
        perfiles: resultado.perfilesSincronizados,
      })
      void cliente.invalidateQueries({ queryKey: ['estadisticas'] })
    },
  })
}

// RF-02 · Estadísticas reales de un jugador obtenidas por ingesta directa
// (Riot Games / Steam): GET /api/v1/estadisticas/jugador/:id.
export function useEstadisticas(jugadorId: string, query?: { juego?: string }) {
  return useQuery({
    queryKey: ['estadisticas', 'jugador', jugadorId, query?.juego ?? 'todos'],
    queryFn: async (): Promise<Estadistica[]> => {
      const { data } = await api.get<Estadistica[]>(
        `/estadisticas/jugador/${jugadorId}`,
        { params: query },
      )
      return data
    },
    enabled: Boolean(jugadorId),
  })
}
