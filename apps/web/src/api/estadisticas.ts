import { useQuery } from '@tanstack/react-query'
import { ejecutarIngesta, obtenerEstadoWorker, type ResultadoIngesta } from '@/mocks/api'
import { simulado, useMutacionSimulada } from '@/api/demo'

export type { ResultadoIngesta }

// RF-03 · Estado del worker de ingesta de estadisticas
export function useEstadoIngesta() {
  return useQuery({
    queryKey: ['estadisticas', 'worker'],
    // TODO: S2 — conectar con GET /api/v1/estadisticas/sincronizar (estado del worker, endpoint por definir)
    queryFn: () =>
      simulado(obtenerEstadoWorker, { activo: false, ultimaSync: null, registros: 0, perfiles: 0 }),
    staleTime: 0,
  })
}

// RF-03 · Lanzar una sincronizacion con las APIs oficiales
export function useEjecutarIngesta() {
  return useMutacionSimulada(() =>
    // TODO: S2 — conectar con POST /api/v1/estadisticas/sincronizar
    ejecutarIngesta(),
  )
}
