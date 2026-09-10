import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { LoginInput, RegisterInput, UsuarioPublico } from "@proplay/shared";
import { authApi } from "../api/auth";
import { guardarAccessToken, registrarCierreDeSesion } from "../api/client";

/**
 * Sesión del usuario.
 *
 * El access token vive sólo en memoria (nunca en localStorage); la sesión
 * persiste gracias a la cookie httpOnly del refresh token: al recargar la
 * página se pide /auth/me y el interceptor de axios refresca por detrás.
 */
interface ValorAuth {
  usuario: UsuarioPublico | null;
  cargando: boolean;
  autenticado: boolean;
  login: (datos: LoginInput) => Promise<UsuarioPublico>;
  registrar: (datos: RegisterInput) => Promise<UsuarioPublico>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<ValorAuth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioPublico | null>(null);
  const [cargando, setCargando] = useState(true);
  const queryClient = useQueryClient();

  // Al cargar la app intentamos recuperar la sesión: si /auth/me responde 401,
  // el interceptor prueba a refrescar con la cookie y reintenta la petición.
  useEffect(() => {
    let activo = true;

    authApi
      .yo()
      .then((respuesta) => {
        if (activo) setUsuario(respuesta.usuario);
      })
      .catch(() => {
        if (activo) setUsuario(null);
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, []);

  // El cliente HTTP avisa cuando la sesión ya no se puede renovar.
  useEffect(() => {
    registrarCierreDeSesion(() => {
      setUsuario(null);
      queryClient.clear();
    });
  }, [queryClient]);

  const login = useCallback(async (datos: LoginInput) => {
    const respuesta = await authApi.login(datos);
    guardarAccessToken(respuesta.accessToken);
    setUsuario(respuesta.usuario);
    return respuesta.usuario;
  }, []);

  const registrar = useCallback(async (datos: RegisterInput) => {
    const respuesta = await authApi.registrar(datos);
    guardarAccessToken(respuesta.accessToken);
    setUsuario(respuesta.usuario);
    return respuesta.usuario;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      guardarAccessToken(null);
      setUsuario(null);
      queryClient.clear();
    }
  }, [queryClient]);

  const valor = useMemo<ValorAuth>(
    () => ({
      usuario,
      cargando,
      autenticado: Boolean(usuario),
      login,
      registrar,
      logout,
    }),
    [usuario, cargando, login, registrar, logout],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth(): ValorAuth {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  }
  return contexto;
}
