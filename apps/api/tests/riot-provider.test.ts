import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RiotClient, type PartidoRiot, type RiotParticipante } from "../src/integrations/riot/riot.client";
import { RiotProvider } from "../src/integrations/riot/riot.provider";
import { BadRequestError } from "../src/utils/errors";
import { NotImplementedError } from "../src/utils/errors";

// La clave de la API se lee al cargar la configuración; se fija antes de que el
// módulo se evalúe para que la validación de env.ts la encuentre.
vi.hoisted(() => {
  process.env.RIOT_API_KEY = "RGAPI-000000000000000000000000000000000000000";
});

const PUUID_JUGADOR = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function crearParticipante(
  overrides: Partial<RiotParticipante>,
): RiotParticipante {
  return {
    puuid: PUUID_JUGADOR,
    kills: 0,
    deaths: 0,
    assists: 0,
    teamId: 100,
    ...overrides,
  };
}

function crearPartido(
  participante: RiotParticipante,
  gano: boolean,
  gameDuration: number,
): PartidoRiot {
  return {
    info: {
      gameDuration,
      teams: [
        { teamId: 100, win: gano },
        { teamId: 200, win: !gano },
      ],
      participants: [participante],
    },
  };
}

const partido1: PartidoRiot = crearPartido(
  crearParticipante({ kills: 10, deaths: 5, assists: 8, totalMinionsKilled: 300 }),
  true,
  1800,
);

const partido2: PartidoRiot = crearPartido(
  crearParticipante({ kills: 2, deaths: 6, assists: 4, totalMinionsKilled: 150 }),
  false,
  1500,
);

const partidasPorId = new Map<number, PartidoRiot>([
  [111, partido1],
  [222, partido2],
]);

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: unknown) => {
    const destino = String(url);
    if (destino.includes("/lol/match/v5/matches/by-puuid/")) {
      return { ok: true, status: 200, json: async () => [111, 222] };
    }
    const partes = destino.split("/lol/match/v5/matches/");
    const partido = partidasPorId.get(Number(partes[1]));
    return { ok: true, status: 200, json: async () => partido };
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RiotProvider", () => {
  it("descarga el historial de Riot y agrega partidas, victorias, KDA y win rate", async () => {
    const provider = new RiotProvider(new RiotClient("League of Legends"));

    const estadisticas = await provider.obtenerEstadisticas({
      externalId: PUUID_JUGADOR,
      accessToken: null,
      juego: "League of Legends",
    });

    expect(estadisticas).toHaveLength(1);
    const estadistica = estadisticas[0];
    if (!estadistica) throw new Error("Se esperaba una estadística");

    expect(estadistica.juego).toBe("League of Legends");
    expect(estadistica.partidas).toBe(2);
    expect(estadistica.victorias).toBe(1);
    // Totales del jugador: 12 kills, 11 deaths, 12 asistencias en 2 partidas.
    expect(estadistica.kda).toBeCloseTo((12 + 12) / 11);
    expect(estadistica.winRate).toBe(0.5);
    expect(estadistica.metricas["promedioKills"]).toBe(6);
    expect(estadistica.metricas["csPorMinuto"]).toBe(8);
  });

  it("exige el identificador externo (puuid) del jugador", async () => {
    const provider = new RiotProvider(new RiotClient("League of Legends"));

    await expect(
      provider.obtenerEstadisticas({
        externalId: "",
        accessToken: null,
        juego: "League of Legends",
      }),
    ).rejects.toThrow(BadRequestError);
  });

  it("sólo reporta League of Legends por ahora", async () => {
    const provider = new RiotProvider(new RiotClient("League of Legends"));

    await expect(
      provider.obtenerEstadisticas({
        externalId: PUUID_JUGADOR,
        accessToken: null,
        juego: "VALORANT",
      }),
    ).rejects.toThrow(NotImplementedError);
  });
});
