import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import {
  cuentaGamingSchema,
  desafioVerificacionRiotSchema,
  type ErrorResponse,
  type Plataforma,
  type VerificarCuentaRiotInput,
  type VincularCuentaRiotInput,
} from '@proplay/shared'
import { api } from '@/api/client'

/**
 * Recurso `cuentas-gaming`: API real, sin puente de demostracion.
 * La vinculacion con Riot es en dos pasos (docs/decisiones.md, «Integracion
 * con Riot»): Riot ID → icono pedido → comprobacion del icono.
 */

export const CLAVE_CUENTAS = ['perfiles', 'cuentas-gaming'] as const

// RF-02 · RF-03 · Cuentas vinculadas del jugador, con su ultima sincronizacion
export function useCuentasGaming() {
  return useQuery({
    queryKey: CLAVE_CUENTAS,
    queryFn: async () => {
      const { data } = await api.get<unknown>('/perfiles/cuentas-gaming')
      return cuentaGamingSchema.array().parse(data)
    },
  })
}

// RF-02 · Paso 1: Riot ID y servidor → desafio de verificacion
export function useIniciarVinculacionRiot() {
  return useMutation({
    mutationFn: async (datos: VincularCuentaRiotInput) => {
      const { data } = await api.post<unknown>('/perfiles/cuentas-gaming/riot', datos)
      return desafioVerificacionRiotSchema.parse(data)
    },
  })
}

// RF-02 · Paso 2: la API comprueba el icono en Riot y guarda la cuenta verificada
export function useVerificarCuentaRiot() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: async (datos: VerificarCuentaRiotInput) => {
      const { data } = await api.post<unknown>('/perfiles/cuentas-gaming/riot/verificar', datos)
      return cuentaGamingSchema.parse(data)
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: CLAVE_CUENTAS })
      // El perfil publico muestra la cuenta verificada.
      void cliente.invalidateQueries({ queryKey: ['perfiles', 'publico'] })
    },
  })
}

// RF-02 · Desvincular la cuenta de una plataforma
export function useDesvincularPlataforma() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: async (plataforma: Plataforma) => {
      await api.delete(`/perfiles/cuentas-gaming/${plataforma}`)
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: CLAVE_CUENTAS })
      void cliente.invalidateQueries({ queryKey: ['perfiles', 'publico'] })
    },
  })
}

/** Codigo del error del contrato ({ error: { code } }), si lo hay. */
export function codigoDeError(error: unknown): string | undefined {
  return axios.isAxiosError<ErrorResponse>(error) ? error.response?.data?.error?.code : undefined
}
