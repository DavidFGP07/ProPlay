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
 * Integración con Twitch.
 * Twitch Helix: canal, seguidores y horas de directo como señal de exposición.
 */
export class TwitchProvider implements GameStatsProvider {
  readonly plataforma = "TWITCH" as const;

  // TODO: completar el flujo OAuth 2.0 de Twitch y devolver la identidad externa.
  async vincularCuenta(
    _parametros: ParametrosVinculacion,
  ): Promise<CuentaVinculada> {
    throw new NotImplementedError("La vinculación con Twitch no está implementada");
  }

  // TODO: consultar la API de Twitch y normalizar la respuesta.
  async obtenerEstadisticas(
    _parametros: ParametrosEstadisticas,
  ): Promise<EstadisticasExternas[]> {
    throw new NotImplementedError(
      "La descarga de estadísticas de Twitch no está implementada",
    );
  }

  // TODO: renovar el access token de Twitch.
  async refrescarToken(_refreshToken: string): Promise<TokensRefrescados> {
    throw new NotImplementedError("El refresco de tokens de Twitch no está implementado");
  }
}
