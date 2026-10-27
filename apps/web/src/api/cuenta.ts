import { useMutation } from '@tanstack/react-query'
import type {
  ActualizarUsuarioInput,
  AuthResponse,
  CambioContrasenaInput,
  UsuarioPublico,
} from '@proplay/shared'
import { api } from '@/api/client'
import { useAuth } from '@/context/AuthContext'

/**
 * Recurso `cuenta`: ya habla con la API real, sin puente de demostracion.
 */

// RF-01 · Edicion de los datos de la cuenta propia
export function useActualizarCuenta() {
  const { actualizarUsuario } = useAuth()
  return useMutation({
    mutationFn: async (datos: ActualizarUsuarioInput) => {
      const { data } = await api.patch<{ usuario: UsuarioPublico }>('/usuarios/me', datos)
      return data.usuario
    },
    onSuccess: actualizarUsuario,
  })
}

// RF-01 · Cambio de contraseña: la API revoca las demas sesiones y renueva esta
export function useCambiarContrasena() {
  const { renovarSesion } = useAuth()
  return useMutation({
    mutationFn: async (datos: CambioContrasenaInput) => {
      const { data } = await api.patch<AuthResponse>('/usuarios/me/contrasena', datos)
      return data
    },
    onSuccess: renovarSesion,
  })
}
