import { useQuery } from '@tanstack/react-query'
import { obtenerFeed } from '@/mocks/api'

// RF-08 · Actividad reciente del ecosistema
export function useFeed() {
  return useQuery({
    queryKey: ['feed'],
    // TODO: S4 — conectar con GET /api/v1/feed (endpoint por definir en el backend)
    queryFn: obtenerFeed,
  })
}
