import { describe, expect, it } from "vitest";
import { metricasLolSchema } from "@proplay/shared";
import {
  ClienteRiot,
  LimitadorCuota,
  regionDeCuentas,
  regionDePartidas,
} from "../src/integrations/riot/riot.client";
import {
  calcularKda,
  construirEstadisticaLol,
  rangoDeCola,
} from "../src/integrations/riot/riot.normalizacion";
import type { ParticipanteRiot, PartidaRiot } from "../src/integrations/riot/riot.tipos";
import { AppError } from "../src/utils/errors";

/**
 * RF-03, RF-04 · Integración con Riot sin red: la normalización con partidas
 * de ejemplo y el cliente con un `fetch` simulado. No necesita base de datos.
 */

const YO = "puuid-jugador";

function participante(datos: Partial<ParticipanteRiot> & { puuid: string; teamId: number }): ParticipanteRiot {
  return {
    win: false,
    kills: 0,
    deaths: 0,
    assists: 0,
    championName: "Ahri",
    teamPosition: "MIDDLE",
    totalMinionsKilled: 0,
    neutralMinionsKilled: 0,
    goldEarned: 0,
    totalDamageDealtToChampions: 0,
    visionScore: 0,
    ...datos,
  };
}

function partida(
  id: string,
  fin: number,
  yo: Partial<ParticipanteRiot>,
  opciones: { duracion?: number; cola?: number; killsAliado?: number } = {},
): PartidaRiot {
  return {
    metadata: { matchId: id },
    info: {
      gameDuration: opciones.duracion ?? 1800,
      gameEndTimestamp: fin,
      queueId: opciones.cola ?? 420,
      participants: [
        participante({ puuid: YO, teamId: 100, ...yo }),
        participante({ puuid: "aliado", teamId: 100, kills: opciones.killsAliado ?? 5 }),
        participante({ puuid: "rival", teamId: 200, kills: 20 }),
      ],
    },
  };
}

const invocador = { puuid: YO, profileIconId: 7, summonerLevel: 245 };

describe("construirEstadisticaLol", () => {
  const partidas = [
    // 30 min: 6/2/8, gana, 210 CS
    partida("LA1_1", 2_000, {
      win: true,
      kills: 6,
      deaths: 2,
      assists: 8,
      totalMinionsKilled: 200,
      neutralMinionsKilled: 10,
      goldEarned: 12_000,
      totalDamageDealtToChampions: 24_000,
      visionScore: 30,
    }),
    // 30 min: 2/6/4 con Lux de apoyo, pierde
    partida(
      "LA1_2",
      1_000,
      {
        kills: 2,
        deaths: 6,
        assists: 4,
        championName: "Lux",
        teamPosition: "UTILITY",
        totalMinionsKilled: 30,
        goldEarned: 8_000,
        totalDamageDealtToChampions: 12_000,
        visionScore: 60,
      },
      { cola: 440 },
    ),
    // Remake de 3 minutos: se descarta
    partida("LA1_3", 3_000, { kills: 9, win: true }, { duracion: 180 }),
  ];

  const ligas = [
    { queueType: "RANKED_SOLO_5x5", tier: "EMERALD", rank: "II", leaguePoints: 54, wins: 80, losses: 70 },
    { queueType: "RANKED_FLEX_SR", tier: "MASTER", rank: "I", leaguePoints: 12, wins: 10, losses: 3 },
  ];

  const resultado = construirEstadisticaLol({
    puuid: YO,
    servidor: "LA1",
    invocador,
    ligas,
    partidas,
    ahora: new Date("2026-11-08T12:00:00Z"),
  });

  it("agrega partidas, victorias, KDA y win rate sin contar los remakes", () => {
    expect(resultado.juego).toBe("League of Legends");
    expect(resultado.partidas).toBe(2);
    expect(resultado.victorias).toBe(1);
    expect(resultado.winRate).toBe(0.5);
    // (8 kills + 12 asistencias) / 8 muertes
    expect(resultado.kda).toBe(2.5);
  });

  it("calcula las métricas por minuto, la participación y el rol principal", () => {
    const m = metricasLolSchema.parse(resultado.metricas);
    expect(m.partidasAnalizadas).toBe(2);
    expect(m.csPorMinuto).toBe(4); // 240 CS en 60 min
    expect(m.oroPorMinuto).toBe(333.33);
    expect(m.danoPorMinuto).toBe(600);
    expect(m.visionPorMinuto).toBe(1.5);
    // (8 + 12) / (8 propios + 10 del aliado)
    expect(m.participacionKills).toBe(1);
    expect(m.colas).toEqual({ "420": 1, "440": 1 });
    expect(m.distribucionRoles).toEqual({ MIDDLE: 1, UTILITY: 1 });
    expect(resultado.rol).toBe("MIDDLE");
    expect(m.campeonesMasJugados[0]).toEqual({ campeon: "Ahri", partidas: 1, victorias: 1, kda: 7 });
    expect(m.ultimaPartidaId).toBe("LA1_1");
  });

  it("lee el rango de cada cola", () => {
    const m = metricasLolSchema.parse(resultado.metricas);
    expect(m.rangoSoloDuo).toEqual({
      liga: "EMERALD",
      division: "II",
      puntosLiga: 54,
      victorias: 80,
      derrotas: 70,
    });
    expect(m.rangoFlex?.division).toBeNull();
    expect(rangoDeCola([], "RANKED_SOLO_5x5")).toBeNull();
  });

  it("sin partidas devuelve ceros, no NaN", () => {
    const vacio = construirEstadisticaLol({ puuid: YO, servidor: "LA1", invocador, ligas: [], partidas: [] });
    expect(vacio.partidas).toBe(0);
    expect(vacio.kda).toBe(0);
    expect(vacio.winRate).toBe(0);
    expect(metricasLolSchema.parse(vacio.metricas).csPorMinuto).toBe(0);
  });

  it("el KDA trata cero muertes como una", () => {
    expect(calcularKda(5, 0, 5)).toBe(10);
  });
});

describe("enrutamiento de Riot", () => {
  it("usa americas para LAN y asia para account-v1 en SEA", () => {
    expect(regionDePartidas("LA1")).toBe("americas");
    expect(regionDePartidas("OC1")).toBe("sea");
    expect(regionDeCuentas("OC1")).toBe("asia");
  });
});

describe("LimitadorCuota", () => {
  it("pide esperar al llenar la ventana y se libera al pasar", async () => {
    let reloj = 0;
    const limitador = new LimitadorCuota([{ limite: 2, ms: 1_000 }], () => reloj, async (ms) => {
      reloj += ms;
    });
    await limitador.reservar();
    await limitador.reservar();
    expect(limitador.esperaNecesaria()).toBe(1_000);
    await limitador.reservar();
    expect(reloj).toBe(1_000);
  });
});

describe("ClienteRiot", () => {
  const sinEspera = async () => {};
  const limitadorLibre = () => new LimitadorCuota([{ limite: 1_000, ms: 1_000 }]);

  function clienteCon(respuestas: Response[], llamadas: string[] = []) {
    const fetchSimulado = (async (url: string | URL | Request, init?: RequestInit) => {
      llamadas.push(String(url));
      expect(new Headers(init?.headers).get("X-Riot-Token")).toBe("RGAPI-prueba");
      const respuesta = respuestas.shift();
      if (!respuesta) throw new Error("Sin más respuestas simuladas");
      return respuesta;
    }) as typeof fetch;
    return new ClienteRiot({
      apiKey: "RGAPI-prueba",
      fetch: fetchSimulado,
      esperar: sinEspera,
      limitador: limitadorLibre(),
    });
  }

  it("resuelve el Riot ID contra la región continental", async () => {
    const llamadas: string[] = [];
    const cliente = clienteCon([Response.json({ puuid: "p1", gameName: "Ñandú", tagLine: "LAN" })], llamadas);
    const cuenta = await cliente.cuentaPorRiotId("Ñandú", "LAN", "LA1");
    expect(cuenta?.puuid).toBe("p1");
    expect(llamadas[0]).toBe(
      "https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/%C3%91and%C3%BA/LAN",
    );
  });

  it("devuelve null en 404", async () => {
    const cliente = clienteCon([new Response(null, { status: 404 })]);
    expect(await cliente.invocadorPorPuuid("p1", "LA1")).toBeNull();
  });

  it("reintenta un 429 respetando Retry-After", async () => {
    const cliente = clienteCon([
      new Response(null, { status: 429, headers: { "Retry-After": "1" } }),
      Response.json(["LA1_1", "LA1_2"]),
    ]);
    expect(await cliente.idsPartidas("p1", "LA1", { tipo: "ranked", cantidad: 2 })).toEqual([
      "LA1_1",
      "LA1_2",
    ]);
  });

  it("traduce una clave caducada a un 502 explicativo", async () => {
    const cliente = clienteCon([new Response(null, { status: 403 })]);
    const error = await cliente.ligasPorPuuid("p1", "LA1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).status).toBe(502);
    expect((error as AppError).message).toMatch(/caducó/);
  });

  it("sin clave responde 503 sin llamar a Riot", async () => {
    const cliente = new ClienteRiot({ apiKey: undefined });
    const error = await cliente.ligasPorPuuid("p1", "LA1").catch((e: unknown) => e);
    expect((error as AppError).status).toBe(503);
  });
});
