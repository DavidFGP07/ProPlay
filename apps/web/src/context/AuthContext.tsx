import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { iniciarSesion, registrarUsuario, type DatosRegistro } from '@/mocks/api'
import { establecerActorDemo } from '@/mocks/sesion'
import type { Usuario } from '@/types'

interface AuthContextValue {
  usuario: Usuario | null
  cargando: boolean
  error: string | null
  entrar: (email: string) => Promise<boolean>
  registrar: (datos: DatosRegistro) => Promise<boolean>
  salir: () => void
  puede: (...roles: Usuario['rol'][]) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

const CLAVE_SESION = 'proplay.sesion'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [usuario, setUsuario] = useState<Usuario | null>(() => {
    const raw = localStorage.getItem(CLAVE_SESION)
    if (!raw) return null
    try {
      const guardado = JSON.parse(raw) as Usuario
      establecerActorDemo(guardado)
      return guardado
    } catch {
      return null
    }
  })
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const entrar = useCallback(async (email: string) => {
    setCargando(true)
    setError(null)
    try {
      const u = await iniciarSesion(email)
      establecerActorDemo(u)
      setUsuario(u)
      localStorage.setItem(CLAVE_SESION, JSON.stringify(u))
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al iniciar sesion')
      return false
    } finally {
      setCargando(false)
    }
  }, [])

  const registrar = useCallback(async (datos: DatosRegistro) => {
    setCargando(true)
    setError(null)
    try {
      const u = await registrarUsuario(datos)
      establecerActorDemo(u)
      setUsuario(u)
      localStorage.setItem(CLAVE_SESION, JSON.stringify(u))
      return true
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Error al registrar la cuenta',
      )
      return false
    } finally {
      setCargando(false)
    }
  }, [])

  const salir = useCallback(() => {
    establecerActorDemo(null)
    setUsuario(null)
    localStorage.removeItem(CLAVE_SESION)
    // Ningun dato del usuario anterior debe sobrevivir al cierre de sesion.
    queryClient.clear()
  }, [queryClient])

  const puede = useCallback(
    (...roles: Usuario['rol'][]) => (usuario ? roles.includes(usuario.rol) : false),
    [usuario],
  )

  const value = useMemo(
    () => ({ usuario, cargando, error, entrar, registrar, salir, puede }),
    [usuario, cargando, error, entrar, registrar, salir, puede],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
