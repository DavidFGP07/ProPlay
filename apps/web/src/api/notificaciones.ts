import { useQuery } from "@tanstack/react-query";
import { api } from "./client";

export const clavesNotificaciones = {
  contador: ["notificaciones", "contador"] as const,
};

// TODO: conectar con GET /api/v1/notificaciones/contador cuando el módulo esté implementado.
export function useContadorNoLeidas() {
  return useQuery({
    queryKey: clavesNotificaciones.contador,
    queryFn: async () => {
      const { data } = await api.get<{ total: number }>("/notificaciones/contador");
      return data;
    },
    enabled: false,
    retry: false,
  });
}
