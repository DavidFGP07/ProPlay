import { useQuery } from "@tanstack/react-query";
import type { BusquedaJugadores } from "@proplay/shared";
import { api } from "./client";

export const clavesScouting = {
  jugadores: (filtros: BusquedaJugadores) => ["scouting", "jugadores", filtros] as const,
};

// TODO: conectar con GET /api/v1/scouting/jugadores cuando el módulo esté implementado.
export function useBusquedaJugadores(filtros: BusquedaJugadores = {}) {
  return useQuery({
    queryKey: clavesScouting.jugadores(filtros),
    queryFn: async () => {
      const { data } = await api.get("/scouting/jugadores", { params: filtros });
      return data;
    },
    enabled: false,
    retry: false,
  });
}
