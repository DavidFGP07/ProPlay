import { useQuery } from '@tanstack/react-query'
import { simulado } from '@/api/demo'
import { obtenerAuditLog, obtenerMetricas, type MetricasDashboard } from '@/mocks/api'

export type { MetricasDashboard }

/** Lo que la API devolveria sin ningun dato registrado. */
const METRICAS_VACIAS: MetricasDashboard = {
  registrosJugadores: 0,
  registrosEquipos: 0,
  perfilesVerificados: 0,
  ofertasAbiertas: 0,
  postulacionesTotales: 0,
  coincidenciasReportadas: 0,
  tasaActividad: 0,
  latenciaPromedio: 0,
  nps: 0,
  distribucionPorRegion: [],
  distribucionPorJuego: [],
  topRegiones: [],
}

// RF-13 · Indicadores de uso y de exito de la plataforma
export function useMetricas() {
  return useQuery({
    queryKey: ['admin', 'metricas'],
    // TODO: S4 — conectar con GET /api/v1/admin/metricas
    queryFn: () => simulado(obtenerMetricas, METRICAS_VACIAS),
  })
}

// RF-14 · Registro de auditoria de las operaciones sensibles
export function useAuditoria() {
  return useQuery({
    queryKey: ['admin', 'auditoria'],
    // TODO: S4 — conectar con GET /api/v1/admin/auditoria
    queryFn: () => simulado(async () => [...obtenerAuditLog()], []),
  })
}
