import axios from 'axios'
import { QueryClient, useMutation, useQueryClient } from '@tanstack/react-query'

const MODO_PRUEBAS = import.meta.env.MODE === 'test'

export function crearQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // En pruebas un error debe aflorar al instante, sin reintentos.
        retry: MODO_PRUEBAS ? false : reintentarConsulta,
      },
    },
  })
}

/**
 * Una consulta fallida se reintenta una vez, salvo con un 4xx (404, 403,
 * 429...): repetirlo no lo arregla. El 401 ya lo trata el interceptor de
 * `client.ts` (refresca y reintenta la peticion); si aun asi llega aqui es que
 * la sesion no se pudo renovar, y otro intento solo repetiria el refresco.
 */
export function reintentarConsulta(fallos: number, error: unknown): boolean {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined
  const esErrorDelCliente = status !== undefined && status >= 400 && status < 500
  return fallos < 1 && !esErrorDelCliente
}

/**
 * Mutacion que, al terminar, invalida todas las consultas.
 *
 * La simulacion en memoria produce efectos cruzados (una postulacion emite
 * una notificacion y una entrada de auditoria), asi que invalidar por recurso
 * dejaria datos viejos. Cuando cada hook hable con la API real conviene
 * acotar la invalidacion a las claves afectadas.
 */
export function useMutacion<TVariables, TData>(
  mutationFn: (variables: TVariables) => Promise<TData>,
) {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => cliente.invalidateQueries(),
  })
}
