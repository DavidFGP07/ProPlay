import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import type { ErrorResponse, RefreshResponse } from "@proplay/shared";
import { config } from "../lib/env";

/**
 * Cliente HTTP único de la aplicación.
 *
 * - Inyecta el access token en cada petición (interceptor de request).
 * - `withCredentials` para que viaje la cookie httpOnly del refresh token.
 * - Ante un 401 intenta refrescar la sesión UNA vez y reintenta la petición.
 */

let accessToken: string | null = null;
let alExpirarSesion: (() => void) | null = null;

export function guardarAccessToken(token: string | null): void {
  accessToken = token;
}

export function obtenerAccessToken(): string | null {
  return accessToken;
}

/** El AuthContext registra aquí qué hacer cuando la sesión ya no se puede renovar. */
export function registrarCierreDeSesion(callback: () => void): void {
  alExpirarSesion = callback;
}

export const api: AxiosInstance = axios.create({
  baseURL: config.apiUrl,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,
});

api.interceptors.request.use((peticion) => {
  if (accessToken) {
    peticion.headers.Authorization = `Bearer ${accessToken}`;
  }
  return peticion;
});

type PeticionReintentada = InternalAxiosRequestConfig & { _reintentada?: boolean };

let refrescoEnCurso: Promise<string | null> | null = null;

async function refrescarSesion(): Promise<string | null> {
  refrescoEnCurso ??= axios
    .post<RefreshResponse>(`${config.apiUrl}/auth/refresh`, null, {
      withCredentials: true,
    })
    .then((respuesta) => respuesta.data.accessToken)
    .catch(() => null)
    .finally(() => {
      refrescoEnCurso = null;
    });

  return refrescoEnCurso;
}

api.interceptors.response.use(
  (respuesta) => respuesta,
  async (error: AxiosError<ErrorResponse>) => {
    const peticion = error.config as PeticionReintentada | undefined;
    const esRutaDeAuth = peticion?.url?.includes("/auth/refresh");

    if (error.response?.status === 401 && peticion && !peticion._reintentada && !esRutaDeAuth) {
      peticion._reintentada = true;
      const tokenNuevo = await refrescarSesion();

      if (tokenNuevo) {
        guardarAccessToken(tokenNuevo);
        peticion.headers.Authorization = `Bearer ${tokenNuevo}`;
        return api.request(peticion);
      }

      guardarAccessToken(null);
      alExpirarSesion?.();
    }

    return Promise.reject(error);
  },
);

/** Traduce un error de axios al mensaje del contrato { error: { code, message } }. */
export function mensajeDeError(error: unknown, porDefecto = "Algo salió mal"): string {
  if (axios.isAxiosError<ErrorResponse>(error)) {
    return error.response?.data?.error?.message ?? error.message ?? porDefecto;
  }
  if (error instanceof Error) return error.message;
  return porDefecto;
}
