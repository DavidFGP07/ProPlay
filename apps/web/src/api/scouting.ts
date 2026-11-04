import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { jugadorEncontradoSchema, paginadoSchema, type BusquedaJugadores } from '@proplay/shared'
import { api } from '@/api/client'

/*
 * Buscador de talento: API real, sin puente de demostracion. La respuesta se
 * lee con el esquema de @proplay/shared (lista blanca y fechas).
 */

const resultadosSchema = paginadoSchema(jugadorEncontradoSchema)

/** Filtros y pagina del buscador. */
export type FiltrosTalento = BusquedaJugadores & { page: number }

// RF-08 · Jugadores por posicion, rango minimo y departamento, paginados
export function useBuscarJugadores(filtros: FiltrosTalento) {
  return useQuery({
    queryKey: ['scouting', 'jugadores', filtros],
    // La pagina anterior se mantiene en pantalla mientras llega la siguiente.
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data } = await api.get('/scouting/jugadores', { params: filtros })
      return resultadosSchema.parse(data)
    },
  })
}
