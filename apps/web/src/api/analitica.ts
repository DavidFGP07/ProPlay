import { useQuery } from '@tanstack/react-query'
import {
  dimensionDecisivaSchema,
  embudoEquipoSchema,
  embudoOfertaSchema,
  talentoVerificadoSchema,
} from '@proplay/shared'
import { api } from '@/api/client'

/*
 * Analitica (RF-13): API real, sin puente de demostracion. Las respuestas se
 * leen con los esquemas de @proplay/shared, que convierten las fechas. Un
 * cambio de oferta o de postulacion invalida ['analitica'] (api/ofertas.ts).
 */

// RF-13 · Embudo agregado de las ofertas del equipo, con los tiempos de H1
export function useEmbudoEquipo(habilitado = true) {
  return useQuery({
    queryKey: ['analitica', 'embudo'],
    enabled: habilitado,
    queryFn: async () => {
      const { data } = await api.get('/analitica/embudo')
      return embudoEquipoSchema.parse(data)
    },
  })
}

// RF-13 · Embudo de una oferta del equipo
export function useEmbudoOferta(ofertaId: string | undefined) {
  return useQuery({
    queryKey: ['analitica', 'oferta', ofertaId, 'embudo'],
    enabled: Boolean(ofertaId),
    queryFn: async () => {
      const { data } = await api.get(`/analitica/ofertas/${ofertaId}/embudo`)
      return embudoOfertaSchema.parse(data)
    },
  })
}

// RF-13 · Qué dimensión decide el ranking de una oferta del equipo
export function useDimensionDecisiva(ofertaId: string | undefined) {
  return useQuery({
    queryKey: ['analitica', 'oferta', ofertaId, 'dimension-decisiva'],
    enabled: Boolean(ofertaId),
    queryFn: async () => {
      const { data } = await api.get(`/analitica/ofertas/${ofertaId}/dimension-decisiva`)
      return dimensionDecisivaSchema.parse(data)
    },
  })
}

// RF-13 · Mapa del talento verificado (equipo, scout y administrador)
export function useTalento(habilitado = true) {
  return useQuery({
    queryKey: ['analitica', 'talento'],
    enabled: habilitado,
    queryFn: async () => {
      const { data } = await api.get('/analitica/talento')
      return talentoVerificadoSchema.parse(data)
    },
  })
}
