import type {
  AuthResponse,
  LoginInput,
  MeResponse,
  RegisterInput,
} from "@proplay/shared";
import { api } from "./client";

/**
 * Recurso `auth`. Los tipos vienen de @proplay/shared, así que la respuesta
 * está tipada con el mismo contrato que valida el backend.
 */
export const authApi = {
  async registrar(datos: RegisterInput): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>("/auth/register", datos);
    return data;
  },

  async login(datos: LoginInput): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>("/auth/login", datos);
    return data;
  },

  async yo(): Promise<MeResponse> {
    const { data } = await api.get<MeResponse>("/auth/me");
    return data;
  },

  async logout(): Promise<void> {
    await api.post("/auth/logout");
  },
};
