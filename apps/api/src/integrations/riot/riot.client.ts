import { env } from "../../config/env";
import {
  AppError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
} from "../../utils/errors";

/**
 * Cliente HTTP de la API de Riot Games para el módulo de estadísticas.
 *
 * La clave de la API viaja en el header `X-Riot-Token` y los endpoints se sirven
 * bajo el host regional de la API: `https://{región}.api.riotgames.com`. Riot
 * responde `429` cuando se excede el cupo del key: 20 peticiones por segundo y
 * 100 cada dos minutos por región con una key de desarrollo (500 req / 10 min en
 * producción).
 */

/** Región (host) de la API de Riot por juego. */
const REGIONES_POR_JUEGO: Record<string, string> = {
  "league of legends": "na1",
  valorant: "americas",
};

const JUEGO_POR_DEFECTO = "league of legends";

function hostBaseDe(juego: string): string {
  const clave = juego.trim().toLowerCase();
  const region =
    REGIONES_POR_JUEGO[clave] ?? REGIONES_POR_JUEGO[JUEGO_POR_DEFECTO];
  return `https://${region}.api.riotgames.com`;
}

/** Partida de League of Legends con los campos que nos interesan. */
export interface PartidoRiot {
  info?: {
    gameDuration?: number;
    teams?: Array<{ teamId?: number; win?: boolean }>;
    participants?: RiotParticipante[];
  };
}

/** Participante de la partida con los stats básicos que consumimos. */
export interface RiotParticipante {
  puuid?: string;
  kills?: number;
  deaths?: number;
  assists?: number;
  teamId?: number;
  totalMinionsKilled?: number;
}

/** Cantidad máxima de partidas pedidas de una vez al historial del jugador. */
const LIMITE_PARTIDAS = 20;

export class RiotClient {
  private readonly baseUrl: string;

  constructor(juego: string) {
    this.baseUrl = hostBaseDe(juego);
  }

  private async peticion<T>(
    ruta: string,
    query?: Record<string, number | string>,
  ): Promise<T> {
    if (!env.RIOT_API_KEY) {
      throw new AppError(503, "RIOT_NO_CONFIGURADA", "La integración con la API de Riot no está configurada");
    }

    const url = new URL(`${this.baseUrl}${ruta}`);
    for (const [clave, valor] of Object.entries(query ?? {})) {
      url.searchParams.set(clave, String(valor));
    }

    const respuesta = await fetch(url, {
      method: "GET",
      headers: {
        "X-Riot-Token": env.RIOT_API_KEY,
        Accept: "application/json",
      },
    });

    if (respuesta.status === 429) {
      throw new TooManyRequestsError("La API de Riot excedió el límite de peticiones");
    }
    if (respuesta.status === 401) {
      throw new UnauthorizedError("La clave de la API de Riot no es válida");
    }
    if (respuesta.status === 404) {
      throw new NotFoundError("No se encontraron datos de Riot");
    }
    if (!respuesta.ok) {
      throw new AppError(
        respuesta.status,
        "RIOT_API_ERROR",
        `La API de Riot respondió con el estado ${respuesta.status}`,
      );
    }

    return (await respuesta.json()) as T;
  }

  /** IDs de las partidas más recientes del jugador. */
  async obtenerMatchIds(puuid: string): Promise<number[]> {
    const ids = await this.peticion<Array<number | string>>(
      `/lol/match/v5/matches/by-puuid/${puuid}/ids`,
      { start: 0, count: LIMITE_PARTIDAS },
    );
    if (!Array.isArray(ids)) {
      return [];
    }
    return ids.map((id) => Number(id));
  }

  /** Detalle de una partida de League of Legends por su ID. */
  async obtenerMatch(matchId: number): Promise<PartidoRiot> {
    return this.peticion<PartidoRiot>(`/lol/match/v5/matches/${matchId}`);
  }
}
