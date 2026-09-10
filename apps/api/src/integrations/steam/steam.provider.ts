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
 * Integración con Steam.
 * Steam Web API (CS2, Dota 2): estadísticas por SteamID.
 */
export class SteamProvider implements GameStatsProvider {
  readonly plataforma = "STEAM" as const;

  // TODO: completar el flujo OAuth 2.0 de Steam y devolver la identidad externa.
  async vincularCuenta(
    _parametros: ParametrosVinculacion,
  ): Promise<CuentaVinculada> {
    throw new NotImplementedError("La vinculación con Steam no está implementada");
  }

  // TODO: consultar la API de Steam y normalizar la respuesta.
  async obtenerEstadisticas(
    _parametros: ParametrosEstadisticas,
  ): Promise<EstadisticasExternas[]> {
    throw new NotImplementedError(
      "La descarga de estadísticas de Steam no está implementada",
    );
  }

  // TODO: renovar el access token de Steam.
  async refrescarToken(_refreshToken: string): Promise<TokensRefrescados> {
    throw new NotImplementedError("El refresco de tokens de Steam no está implementado");
  }
}
