import type { AuthResponse, LoginInput, MeResponse, RegisterInput } from '@proplay/shared'
import { api } from '@/api/client'

/**
 * Recurso `auth`. Es el unico que ya habla con la API real: los tipos vienen
 * de @proplay/shared, con el mismo contrato que valida el backend.
 */
export const authApi = {
  // RF-01 · Registro de cuenta
  async registrar(datos: RegisterInput): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/register', datos)
    return data
  },

  // RF-01 · Inicio de sesion
  async login(datos: LoginInput): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/login', datos)
    return data
  },

  // RF-01 · Recuperar la sesion con la cookie del refresh token
  async yo(): Promise<MeResponse> {
    const { data } = await api.get<MeResponse>('/auth/me')
    return data
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout')
  },
}
