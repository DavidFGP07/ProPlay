import { useQuery } from '@tanstack/react-query'
import { listarNotificaciones, marcarNotificacionLeida, marcarTodasLeidas } from '@/mocks/api'
import { actorDemo } from '@/mocks/sesion'
import { simulado, useMutacionSimulada } from '@/api/demo'

// RF-12 · Bandeja de notificaciones del usuario en sesion
export function useNotificaciones() {
  return useQuery({
    queryKey: ['notificaciones'],
    // TODO: S4 — conectar con GET /api/v1/notificaciones
    queryFn: () => simulado(() => listarNotificaciones(actorDemo().id), []),
    refetchInterval: 30_000,
  })
}

// RF-12 · Marcar una notificacion como leida
export function useMarcarNotificacionLeida() {
  return useMutacionSimulada((id: string) =>
    // TODO: S4 — conectar con PATCH /api/v1/notificaciones/leidas
    marcarNotificacionLeida(id),
  )
}

// RF-12 · Marcar toda la bandeja como leida
export function useMarcarTodasLeidas() {
  return useMutacionSimulada(() =>
    // TODO: S4 — conectar con PATCH /api/v1/notificaciones/leidas
    marcarTodasLeidas(actorDemo().id),
  )
}
