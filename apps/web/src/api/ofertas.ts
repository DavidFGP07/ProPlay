import { useQuery } from "@tanstack/react-query";
import type { ListarOfertasQuery, Oferta, Paginado } from "@proplay/shared";
import { api } from "./client";

/**
 * Recurso `ofertas`. El endpoint todavía responde 501: el hook queda listo
 * para cuando el módulo se implemente.
 */
export const clavesOfertas = {
  todas: ["ofertas"] as const,
  listado: (filtros: ListarOfertasQuery) => ["ofertas", filtros] as const,
};

// TODO: conectar con GET /api/v1/ofertas cuando el módulo esté implementado.
export function useOfertas(filtros: ListarOfertasQuery = {}) {
  return useQuery({
    queryKey: clavesOfertas.listado(filtros),
    queryFn: async (): Promise<Paginado<Oferta>> => {
      const { data } = await api.get<Paginado<Oferta>>("/ofertas", {
        params: filtros,
      });
      return data;
    },
    enabled: false,
    retry: false,
  });
}
