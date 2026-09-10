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
 * Integración con Riot Games (League of Legends, VALORANT).
 *
 * Es la PRIMERA integración que se va a conectar, así que aquí queda anotado
 * el camino concreto:
 *   1. RSO (Riot Sign On) para obtener el puuid del jugador.
 *   2. GET /lol/summoner/v4/summoners/by-puuid/{puuid} para el handle.
 *   3. GET /lol/match/v5/matches/by-puuid/{puuid}/ids + /matches/{id} para las
 *      partidas, de donde salen partidas, victorias, kda y winRate.
 * La clave de la API viaja en env.RIOT_API_KEY.
 */
export class RiotProvider implements GameStatsProvider {
  readonly plataforma = "RIOT" as const;

  // TODO: canjear el código RSO por tokens y resolver el puuid del jugador.
  async vincularCuenta(
    _parametros: ParametrosVinculacion,
  ): Promise<CuentaVinculada> {
    throw new NotImplementedError("La vinculación con Riot no está implementada");
  }

  // TODO: descargar el historial de partidas y normalizarlo a EstadisticasExternas.
  async obtenerEstadisticas(
    _parametros: ParametrosEstadisticas,
  ): Promise<EstadisticasExternas[]> {
    throw new NotImplementedError(
      "La descarga de estadísticas de Riot no está implementada",
    );
  }

  // TODO: renovar el access token contra el endpoint de tokens de RSO.
  async refrescarToken(_refreshToken: string): Promise<TokensRefrescados> {
    throw new NotImplementedError("El refresco de tokens de Riot no está implementado");
  }
}
