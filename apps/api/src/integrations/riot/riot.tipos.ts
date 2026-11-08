/**
 * Respuestas de la API de Riot que usa ProPlay. Sólo se tipan los campos que
 * se leen: Riot devuelve muchos más y los añade sin aviso.
 *
 * Referencia: https://developer.riotgames.com/apis
 */

/** account-v1 · /riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine} */
export interface CuentaRiot {
  puuid: string;
  gameName?: string;
  tagLine?: string;
}

/** summoner-v4 · /lol/summoner/v4/summoners/by-puuid/{puuid} */
export interface InvocadorRiot {
  puuid: string;
  profileIconId: number;
  summonerLevel: number;
  revisionDate?: number;
}

/** league-v4 · /lol/league/v4/entries/by-puuid/{puuid} */
export interface EntradaLigaRiot {
  queueType: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
}

/** match-v5 · participante de /lol/match/v5/matches/{matchId} */
export interface ParticipanteRiot {
  puuid: string;
  teamId: number;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  championName: string;
  teamPosition?: string;
  totalMinionsKilled?: number;
  neutralMinionsKilled?: number;
  goldEarned?: number;
  totalDamageDealtToChampions?: number;
  visionScore?: number;
  gameEndedInEarlySurrender?: boolean;
}

/** match-v5 · /lol/match/v5/matches/{matchId} */
export interface PartidaRiot {
  metadata: { matchId: string };
  info: {
    /** Segundos (partidas posteriores al parche 11.20). */
    gameDuration: number;
    gameEndTimestamp?: number;
    gameCreation?: number;
    queueId: number;
    participants: ParticipanteRiot[];
  };
}
