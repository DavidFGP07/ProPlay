import {
  JUEGO_LOL,
  LIGAS_LOL,
  POSICIONES_LOL,
  type LigaLol,
  type MetricasLol,
  type PosicionLol,
  type RangoLol,
  type ServidorLol,
} from "@proplay/shared";
import type { EstadisticasExternas } from "../GameStatsProvider";
import type { EntradaLigaRiot, InvocadorRiot, PartidaRiot } from "./riot.tipos";

/**
 * Normalización de las respuestas de Riot al modelo interno (RF-04).
 *
 * Funciones puras: no hacen peticiones ni leen la configuración, así se
 * prueban con partidas de ejemplo. Todas las cifras salen de la API oficial.
 */

/** Por debajo de 5 minutos es un remake: no dice nada del jugador. */
const DURACION_MINIMA_SEGUNDOS = 300;
const CAMPEONES_EN_RESUMEN = 3;

const redondear = (valor: number, decimales = 2): number => {
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
};

const dividir = (a: number, b: number): number => (b > 0 ? a / b : 0);

/** KDA de Riot: (kills + asistencias) / muertes, con las muertes en al menos 1. */
export const calcularKda = (kills: number, muertes: number, asistencias: number): number =>
  (kills + asistencias) / Math.max(muertes, 1);

const esPosicion = (valor: string | undefined): valor is PosicionLol =>
  (POSICIONES_LOL as readonly string[]).includes(valor ?? "");

const esLiga = (valor: string): valor is LigaLol =>
  (LIGAS_LOL as readonly string[]).includes(valor);

/** Rango de una cola a partir de las entradas de league-v4. */
export function rangoDeCola(entradas: EntradaLigaRiot[], cola: string): RangoLol | null {
  const entrada = entradas.find((e) => e.queueType === cola);
  if (!entrada || !esLiga(entrada.tier)) return null;
  const sinDivision = ["MASTER", "GRANDMASTER", "CHALLENGER"].includes(entrada.tier);
  return {
    liga: entrada.tier,
    division: sinDivision ? null : entrada.rank,
    puntosLiga: entrada.leaguePoints,
    victorias: entrada.wins,
    derrotas: entrada.losses,
  };
}

export interface DatosSincronizacionLol {
  puuid: string;
  servidor: ServidorLol;
  invocador: InvocadorRiot;
  ligas: EntradaLigaRiot[];
  partidas: PartidaRiot[];
  ahora?: Date;
}

/**
 * Agrega las partidas recientes del jugador en una sola captura de
 * `Estadistica`. Descarta los remakes y las partidas en las que no aparece.
 */
export function construirEstadisticaLol(datos: DatosSincronizacionLol): EstadisticasExternas {
  const { puuid, servidor, invocador, ligas } = datos;

  // De la más reciente a la más antigua.
  const partidas = [...datos.partidas].sort(
    (a, b) => (b.info.gameEndTimestamp ?? b.info.gameCreation ?? 0) -
      (a.info.gameEndTimestamp ?? a.info.gameCreation ?? 0),
  );

  let jugadas = 0;
  let victorias = 0;
  let kills = 0;
  let muertes = 0;
  let asistencias = 0;
  let cs = 0;
  let oro = 0;
  let dano = 0;
  let vision = 0;
  let segundos = 0;
  let killsEquipo = 0;
  const colas: Record<string, number> = {};
  const roles: Partial<Record<PosicionLol, number>> = {};
  const campeones = new Map<
    string,
    { partidas: number; victorias: number; k: number; d: number; a: number }
  >();
  let ultima: PartidaRiot | null = null;

  for (const partida of partidas) {
    const yo = partida.info.participants.find((p) => p.puuid === puuid);
    if (!yo) continue;
    if (partida.info.gameDuration < DURACION_MINIMA_SEGUNDOS || yo.gameEndedInEarlySurrender) {
      continue;
    }

    ultima ??= partida;
    jugadas += 1;
    if (yo.win) victorias += 1;
    kills += yo.kills;
    muertes += yo.deaths;
    asistencias += yo.assists;
    cs += (yo.totalMinionsKilled ?? 0) + (yo.neutralMinionsKilled ?? 0);
    oro += yo.goldEarned ?? 0;
    dano += yo.totalDamageDealtToChampions ?? 0;
    vision += yo.visionScore ?? 0;
    segundos += partida.info.gameDuration;
    killsEquipo += partida.info.participants
      .filter((p) => p.teamId === yo.teamId)
      .reduce((total, p) => total + p.kills, 0);

    const cola = String(partida.info.queueId);
    colas[cola] = (colas[cola] ?? 0) + 1;

    if (esPosicion(yo.teamPosition)) {
      roles[yo.teamPosition] = (roles[yo.teamPosition] ?? 0) + 1;
    }

    const campeon = campeones.get(yo.championName) ?? {
      partidas: 0,
      victorias: 0,
      k: 0,
      d: 0,
      a: 0,
    };
    campeon.partidas += 1;
    if (yo.win) campeon.victorias += 1;
    campeon.k += yo.kills;
    campeon.d += yo.deaths;
    campeon.a += yo.assists;
    campeones.set(yo.championName, campeon);
  }

  const minutos = segundos / 60;
  const rolPrincipal =
    (Object.entries(roles) as [PosicionLol, number][]).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    null;

  const metricas: MetricasLol = {
    servidor,
    nivelInvocador: invocador.summonerLevel,
    rangoSoloDuo: rangoDeCola(ligas, "RANKED_SOLO_5x5"),
    rangoFlex: rangoDeCola(ligas, "RANKED_FLEX_SR"),
    partidasAnalizadas: jugadas,
    colas,
    promedioKills: redondear(dividir(kills, jugadas)),
    promedioMuertes: redondear(dividir(muertes, jugadas)),
    promedioAsistencias: redondear(dividir(asistencias, jugadas)),
    csPorMinuto: redondear(dividir(cs, minutos)),
    oroPorMinuto: redondear(dividir(oro, minutos)),
    danoPorMinuto: redondear(dividir(dano, minutos)),
    visionPorMinuto: redondear(dividir(vision, minutos)),
    participacionKills: redondear(Math.min(1, dividir(kills + asistencias, killsEquipo)), 4),
    duracionMediaMinutos: redondear(dividir(minutos, jugadas)),
    distribucionRoles: roles,
    campeonesMasJugados: [...campeones.entries()]
      .sort((a, b) => b[1].partidas - a[1].partidas || b[1].victorias - a[1].victorias)
      .slice(0, CAMPEONES_EN_RESUMEN)
      .map(([nombre, c]) => ({
        campeon: nombre,
        partidas: c.partidas,
        victorias: c.victorias,
        kda: redondear(calcularKda(c.k, c.d, c.a)),
      })),
    ultimaPartidaId: ultima?.metadata.matchId ?? null,
    ultimaPartidaEn: ultima?.info.gameEndTimestamp
      ? new Date(ultima.info.gameEndTimestamp)
      : null,
  };

  return {
    juego: JUEGO_LOL,
    rol: rolPrincipal,
    partidas: jugadas,
    victorias,
    kda: jugadas > 0 ? redondear(calcularKda(kills, muertes, asistencias)) : 0,
    winRate: redondear(dividir(victorias, jugadas), 4),
    metricas,
    capturadaEn: datos.ahora ?? new Date(),
  };
}
