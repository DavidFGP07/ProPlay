import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type {
  AuthResponse,
  LoginInput,
  RegisterInput,
  Rol,
  UsuarioPublico,
} from '@proplay/shared'
import { authApi } from '@/api/auth'
import { guardarAccessToken, registrarCierreDeSesion } from '@/api/client'
import { sincronizarSesionDemo } from '@/api/demo'

/**
 * Sesion del usuario (RF-01).
 *
 * El access token vive solo en memoria, nunca en localStorage; la sesion
 * persiste gracias a la cookie httpOnly del refresh token: al cargar la app se
 * pide /auth/me y el interceptor de axios refresca por detras si hace falta.
 */
interface AuthContextValue {
  usuario: UsuarioPublico | null
  /** true mientras se intenta recuperar la sesion al cargar la app. */
  cargando: boolean
  entrar: (datos: LoginInput) => Promise<UsuarioPublico>
  registrar: (datos: RegisterInput) => Promise<UsuarioPublico>
  salir: () => Promise<void>
  puede: (...roles: Rol[]) => boolean
  /** Refleja en la sesión los datos de cuenta que devolvió la API. */
  actualizarUsuario: (usuario: UsuarioPublico) => void
  /** Adopta la sesión nueva que emite la API tras un cambio de credenciales. */
  renovarSesion: (respuesta: AuthResponse) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [usuario, setUsuarioEstado] = useState<UsuarioPublico | null>(null)
  const [cargando, setCargando] = useState(true)

  // Toda la app ve el mismo usuario que el puente de datos de demostracion.
  const setUsuario = useCallback((u: UsuarioPublico | null) => {
    sincronizarSesionDemo(u)
    setUsuarioEstado(u)
  }, [])

  const cerrarLocalmente = useCallback(() => {
    guardarAccessToken(null)
    setUsuario(null)
    // Ningun dato del usuario anterior debe sobrevivir al cierre de sesion.
    queryClient.clear()
  }, [queryClient, setUsuario])

  // Al cargar la app se intenta recuperar la sesion: si /auth/me responde 401,
  // el interceptor prueba a refrescar con la cookie y reintenta la peticion.
  useEffect(() => {
    let activo = true
    authApi
      .yo()
      .then((respuesta) => {
        if (activo) setUsuario(respuesta.usuario)
      })
      .catch(() => {
        if (activo) setUsuario(null)
      })
      .finally(() => {
        if (activo) setCargando(false)
      })
    return () => {
      activo = false
    }
  }, [setUsuario])

  // El cliente HTTP avisa cuando la sesion ya no se puede renovar.
  useEffect(() => {
    registrarCierreDeSesion(cerrarLocalmente)
  }, [cerrarLocalmente])

  const entrar = useCallback(
    async (datos: LoginInput) => {
      const respuesta = await authApi.login(datos)
      guardarAccessToken(respuesta.accessToken)
      setUsuario(respuesta.usuario)
      return respuesta.usuario
    },
    [setUsuario],
  )

  const registrar = useCallback(
    async (datos: RegisterInput) => {
      const respuesta = await authApi.registrar(datos)
      guardarAccessToken(respuesta.accessToken)
      setUsuario(respuesta.usuario)
      return respuesta.usuario
    },
    [setUsuario],
  )

  const salir = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      cerrarLocalmente()
    }
  }, [cerrarLocalmente])

  const puede = useCallback(
    (...roles: Rol[]) => (usuario ? roles.includes(usuario.rol) : false),
    [usuario],
  )

  const renovarSesion = useCallback(
    (respuesta: AuthResponse) => {
      guardarAccessToken(respuesta.accessToken)
      setUsuario(respuesta.usuario)
    },
    [setUsuario],
  )

  const value = useMemo(
    () => ({
      usuario,
      cargando,
      entrar,
      registrar,
      salir,
      puede,
      actualizarUsuario: setUsuario,
      renovarSesion,
    }),
    [usuario, cargando, entrar, registrar, salir, puede, setUsuario, renovarSesion],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
