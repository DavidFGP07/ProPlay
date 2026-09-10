import { useQuery } from "@tanstack/react-query";
import type { HealthResponse } from "@proplay/shared";
import { api } from "./client";

/** Estado de la API. Se muestra en el dashboard como señal de vida. */
export function useSalud() {
  return useQuery({
    queryKey: ["health"],
    queryFn: async (): Promise<HealthResponse> => {
      const { data } = await api.get<HealthResponse>("/health");
      return data;
    },
    refetchInterval: 60_000,
    retry: false,
  });
}
