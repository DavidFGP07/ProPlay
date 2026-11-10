import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import {
  cuentaGamingSchema,
  desafioActivoRiotSchema,
  desafioVerificacionRiotSchema,
  resultadoVerificacionRiotSchema,
  type DesafioActivoRiot,
  type DesafioVerificacionRiot,
  type ErrorResponse,
  type Plataforma,
  type VerificarCuentaRiotInput,
  type VincularCuentaRiotInput,
} from '@proplay/shared'
import { api } from '@/api/client'

/**
 * Recurso `cuentas-gaming`: API real, sin puente de demostracion.
 * La vinculacion con Riot es en dos pasos (docs/decisiones.md, «Integracion
 * con Riot»): Riot ID → icono pedido → comprobacion del icono. El desafio
 * activo lo guarda la API, asi que la vista lo recupera al volver o recargar.
 */

export const CLAVE_CUENTAS = ['perfiles', 'cuentas-gaming'] as const
export const CLAVE_DESAFIO_RIOT = ['perfiles', 'cuentas-gaming', 'riot', 'desafio'] as const

/** Codigos con los que el desafio que muestra la vista ya no es el activo. */
const DESAFIO_YA_NO_VALE = ['DESAFIO_CADUCADO', 'DESAFIO_REEMPLAZADO']

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

// RF-02 · Desafio activo del jugador (o null), para retomarlo al volver a la vista
export function useDesafioRiot() {
  return useQuery({
    queryKey: CLAVE_DESAFIO_RIOT,
    queryFn: async () => {
      const { data } = await api.get<unknown>('/perfiles/cuentas-gaming/riot/desafio')
      return desafioActivoRiotSchema.parse(data)
    },
  })
}

function useGuardarDesafio() {
  const cliente = useQueryClient()
  return (desafio: DesafioVerificacionRiot | null) =>
    cliente.setQueryData<DesafioActivoRiot>(CLAVE_DESAFIO_RIOT, { desafio })
}

// RF-02 · Paso 1: Riot ID y servidor → desafio de verificacion (o el activo)
export function useIniciarVinculacionRiot() {
  const guardar = useGuardarDesafio()
  return useMutation({
    mutationFn: async (datos: VincularCuentaRiotInput) => {
      const { data } = await api.post<unknown>('/perfiles/cuentas-gaming/riot', datos)
      return desafioVerificacionRiotSchema.parse(data)
    },
    onSuccess: guardar,
  })
}

// RF-02 · «Generar otro icono»: sustituye el desafio activo
export function useRegenerarDesafioRiot() {
  const guardar = useGuardarDesafio()
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<unknown>('/perfiles/cuentas-gaming/riot/desafio/regenerar')
      return desafioVerificacionRiotSchema.parse(data)
    },
    onSuccess: guardar,
  })
}

// RF-02 · Cancelar el desafio activo para usar otra cuenta
export function useCancelarDesafioRiot() {
  const guardar = useGuardarDesafio()
  return useMutation({
    mutationFn: async () => {
      await api.delete('/perfiles/cuentas-gaming/riot/desafio')
    },
    onSuccess: () => guardar(null),
  })
}

// RF-02 · Paso 2: la API comprueba el icono en Riot. Si aun no coincide responde
// PENDIENTE con el desafio al dia; si coincide, guarda la cuenta verificada.
export function useVerificarCuentaRiot() {
  const cliente = useQueryClient()
  const guardar = useGuardarDesafio()
  return useMutation({
    mutationFn: async (datos: VerificarCuentaRiotInput) => {
      const { data } = await api.post<unknown>('/perfiles/cuentas-gaming/riot/verificar', datos)
      return resultadoVerificacionRiotSchema.parse(data)
    },
    onSuccess: (resultado) => {
      if (resultado.estado === 'PENDIENTE') {
        guardar(resultado.desafio)
        return
      }
      guardar(null)
      void cliente.invalidateQueries({ queryKey: CLAVE_CUENTAS })
      // El perfil publico muestra la cuenta verificada.
      void cliente.invalidateQueries({ queryKey: ['perfiles', 'publico'] })
    },
    onError: (error) => {
      // Caducó o se generó otro en otra pestaña: se trae el que haya ahora.
      if (DESAFIO_YA_NO_VALE.includes(codigoDeError(error) ?? '')) {
        void cliente.invalidateQueries({ queryKey: CLAVE_DESAFIO_RIOT })
      }
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
