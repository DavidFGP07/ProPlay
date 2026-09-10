import { useQuery } from "@tanstack/react-query";
import { api } from "./client";

export const clavesMensajeria = {
  conversaciones: ["mensajeria", "conversaciones"] as const,
};

// TODO: conectar con GET /api/v1/mensajeria/conversaciones cuando el módulo esté implementado.
export function useConversaciones() {
  return useQuery({
    queryKey: clavesMensajeria.conversaciones,
    queryFn: async () => {
      const { data } = await api.get("/mensajeria/conversaciones");
      return data;
    },
    enabled: false,
    retry: false,
  });
}
