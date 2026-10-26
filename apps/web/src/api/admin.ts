import { useQuery } from '@tanstack/react-query'
import { obtenerAuditLog, obtenerMetricas, type MetricasDashboard } from '@/mocks/api'

export type { MetricasDashboard }

// RF-13 · Indicadores de uso y de exito de la plataforma
export function useMetricas() {
  return useQuery({
    queryKey: ['admin', 'metricas'],
    // TODO: S4 — conectar con GET /api/v1/admin/metricas
    queryFn: obtenerMetricas,
  })
}

// RF-14 · Registro de auditoria de las operaciones sensibles
export function useAuditoria() {
  return useQuery({
    queryKey: ['admin', 'auditoria'],
    // TODO: S4 — conectar con GET /api/v1/admin/auditoria
    queryFn: async () => [...obtenerAuditLog()],
  })
}
