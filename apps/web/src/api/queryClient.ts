import axios from 'axios'
import { QueryClient, useMutation, useQueryClient } from '@tanstack/react-query'

const MODO_PRUEBAS = import.meta.env.MODE === 'test'

export function crearQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // En pruebas un error debe aflorar al instante, sin reintentos. Un 4xx
        // (404, 403, 429...) tampoco se reintenta: repetirlo no lo arregla.
        retry: MODO_PRUEBAS ? false : (fallos, error) => fallos < 1 && !esErrorDelCliente(error),
      },
    },
  })
}

function esErrorDelCliente(error: unknown): boolean {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined
  return status !== undefined && status >= 400 && status < 500
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
