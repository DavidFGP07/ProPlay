import { NotImplementedError } from "../../utils/errors";
import type {
  CuentaVinculada,
  EstadisticasExternas,
  GameStatsProvider,
  ParametrosEstadisticas,
  ParametrosVinculacion,
  TokensRefrescados,
} from "../GameStatsProvider";

/**
 * Integración con YouTube.
 * YouTube Data API: canal, vistas y suscriptores como señal de exposición.
 */
export class YouTubeProvider implements GameStatsProvider {
  readonly plataforma = "YOUTUBE" as const;

  // TODO: completar el flujo OAuth 2.0 de YouTube y devolver la identidad externa.
  async vincularCuenta(
    _parametros: ParametrosVinculacion,
  ): Promise<CuentaVinculada> {
    throw new NotImplementedError("La vinculación con YouTube no está implementada");
  }

  // TODO: consultar la API de YouTube y normalizar la respuesta.
  async obtenerEstadisticas(
    _parametros: ParametrosEstadisticas,
  ): Promise<EstadisticasExternas[]> {
    throw new NotImplementedError(
      "La descarga de estadísticas de YouTube no está implementada",
    );
  }

  // TODO: renovar el access token de YouTube.
  async refrescarToken(_refreshToken: string): Promise<TokensRefrescados> {
    throw new NotImplementedError("El refresco de tokens de YouTube no está implementado");
  }
}
