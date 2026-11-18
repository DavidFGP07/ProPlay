import { useQuery } from '@tanstack/react-query'
import { explicacionGeneradaSchema } from '@proplay/shared'
import { api } from '@/api/client'

/*
 * Explicador con modelo de lenguaje (RF-11): API real, sin puente de
 * demostracion. La respuesta es siempre 200: sin texto llega `NO_DISPONIBLE`
 * con su motivo y la vista se queda con la explicacion determinista. No se
 * reintenta (cada intento podria gastar una generacion) y no caduca: el
 * servidor ya guarda el texto por contenido.
 */

// RF-11 · Por que encaja el candidato, redactado a partir del desglose
export function useExplicacionGenerada(ofertaId: string, jugadorId: string) {
  return useQuery({
    queryKey: ['explicador', ofertaId, jugadorId],
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data } = await api.get(`/explicaciones/ofertas/${ofertaId}/candidatos/${jugadorId}`)
      return explicacionGeneradaSchema.parse(data)
    },
  })
}
