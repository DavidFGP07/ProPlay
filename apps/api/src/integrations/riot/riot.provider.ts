import { BadRequestError, NotImplementedError } from "../../utils/errors";
import type {
  CuentaVinculada,
  EstadisticasExternas,
  GameStatsProvider,
  ParametrosEstadisticas,
  ParametrosVinculacion,
  TokensRefrescados,
} from "../GameStatsProvider";
import { RiotClient, type PartidoRiot } from "./riot.client";

/**
 * Integración con Riot Games (League of Legends).
 *
 * Con la `RIOT_API_KEY` se descarga el historial de partidas del jugador por
 * PUUID y se normaliza a `EstadisticasExternas`: partidas jugadas, victorias,
 * KDA y win rate salen del historial real, nunca de una declaración del jugador.
 *   1. GET /lol/match/v5/matches/by-puuid/{puuid}/ids + /matches/{id}.
 *   2. Se agregan kills, deaths, assists, victorias y CS por partida.
 *
 * La vinculación OAuth (RSO) y el refresco de tokens siguen pendientes: requieren
 * las credenciales de la app de Riot (`RIOT_CLIENT_ID` / `RIOT_CLIENT_SECRET`).
 */

/** Juego que reporta la integración con Riot para el piloto. */
const NOMBRE_JUEGO_RIOT = "League of Legends";

export class RiotProvider implements GameStatsProvider {
  readonly plataforma = "RIOT" as const;

  private readonly client: RiotClient;

  constructor(client: RiotClient = new RiotClient(NOMBRE_JUEGO_RIOT)) {
    this.client = client;
  }

  async vincularCuenta(_parametros: ParametrosVinculacion): Promise<CuentaVinculada> {
    throw new NotImplementedError("La vinculación con Riot no está implementada");
  }

  async obtenerEstadisticas(
    parametros: ParametrosEstadisticas,
  ): Promise<EstadisticasExternas[]> {
    const { externalId, juego } = parametros;

    if (!externalId) {
      throw new BadRequestError("Falta el identificador externo (puuid) del jugador en Riot");
    }

    const nombreJuego =
      juego && juego.trim().length > 0 ? juego.trim() : NOMBRE_JUEGO_RIOT;
    if (nombreJuego.toLowerCase() !== "league of legends") {
      throw new NotImplementedError(
        `La integración con Riot sólo reporta ${NOMBRE_JUEGO_RIOT}; se pidió ${nombreJuego}`,
      );
    }

    const client = new RiotClient(nombreJuego);
    const ids = await client.obtenerMatchIds(externalId);

    const partidos: PartidoRiot[] = [];
    for (const id of ids) {
      partidos.push(await client.obtenerMatch(id));
    }

    let partidasJugadas = 0;
    let victorias = 0;
    let kills = 0;
    let deaths = 0;
    let asistencias = 0;
    let csPorPartida = 0;
    let huboCs = false;

    for (const partido of partidos) {
      const participante = partido.info?.participants?.find(
        (p) => p.puuid === externalId,
      );
      if (!participante) continue;

      const info = partido.info;
      const equipo = info?.teams?.find(
        (t) => t.teamId === participante.teamId,
      );
      const duracionSegundos = info?.gameDuration ?? 0;

      partidasJugadas += 1;
      if (equipo?.win) {
        victorias += 1;
      }
      kills += participante.kills ?? 0;
      deaths += participante.deaths ?? 0;
      asistencias += participante.assists ?? 0;

      if (participante.totalMinionsKilled != null && duracionSegundos > 0) {
        csPorPartida += participante.totalMinionsKilled / (duracionSegundos / 60);
        huboCs = true;
      }
    }

    const kda = deaths > 0 ? (kills + asistencias) / deaths : kills + asistencias;
    const winRate = partidasJugadas > 0 ? victorias / partidasJugadas : 0;
    const metricas: Record<string, number | string | null> = {
      promedioKills: partidasJugadas > 0 ? kills / partidasJugadas : 0,
      promedioMuertes: partidasJugadas > 0 ? deaths / partidasJugadas : 0,
      promedioAsistencias: partidasJugadas > 0 ? asistencias / partidasJugadas : 0,
    };
    if (huboCs && partidasJugadas > 0) {
      metricas["csPorMinuto"] = csPorPartida / partidasJugadas;
    }

    const estadistica: EstadisticasExternas = {
      juego: nombreJuego,
      rol: null,
      partidas: partidasJugadas,
      victorias,
      kda,
      winRate,
      metricas,
      capturadaEn: new Date(),
    };

    return [estadistica];
  }

  async refrescarToken(_refreshToken: string): Promise<TokensRefrescados> {
    throw new NotImplementedError("El refresco de tokens de Riot no está implementado");
  }
}
