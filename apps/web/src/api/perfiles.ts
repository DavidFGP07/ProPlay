import { useQuery } from "@tanstack/react-query";
import { api } from "./client";

export const clavesPerfiles = {
  propio: ["perfiles", "me"] as const,
};

// TODO: conectar con GET /api/v1/perfiles/me cuando el módulo esté implementado.
export function usePerfilPropio() {
  return useQuery({
    queryKey: clavesPerfiles.propio,
    queryFn: async () => {
      const { data } = await api.get("/perfiles/me");
      return data;
    },
    enabled: false,
    retry: false,
  });
}
