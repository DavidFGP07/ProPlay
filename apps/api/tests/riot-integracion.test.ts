import { describe, expect, it } from "vitest";
import { metricasLolSchema } from "@proplay/shared";
import { CuotaRiotMemoria, limiteEfectivo } from "../src/integrations/riot/cuotaRiot";
import {
  ClienteRiot,
  LLAMADA_COMPROBACION,
  LLAMADA_INGESTA,
  LLAMADA_VINCULACION,
  regionDeCuentas,
  regionDePartidas,
  type ControlClaveRiot,
} from "../src/integrations/riot/riot.client";
import {
  calcularKda,
  construirEstadisticaLol,
  rangoDeCola,
  rangoSoloDuo,
} from "../src/integrations/riot/riot.normalizacion";
import { RiotProvider } from "../src/integrations/riot/riot.provider";
import type { ParticipanteRiot, PartidaRiot } from "../src/integrations/riot/riot.tipos";
import { AppError, CuotaRiotAgotadaError } from "../src/utils/errors";

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
    // La partida de Lux es de Flex (440): no cuenta para la posición.
    expect(m.distribucionRoles).toEqual({ MID: 1 });
    expect(resultado.rol).toBe("MID");
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

  it("guarda el rango solo/dúo en el catálogo de ProPlay, no el de Flex", () => {
    expect(resultado.rango).toBe("ESMERALDA_II");
    expect(rangoSoloDuo([ligas[1]!])).toBeNull();
    expect(
      rangoSoloDuo([{ queueType: "RANKED_SOLO_5x5", tier: "MASTER", rank: "I", leaguePoints: 1, wins: 1, losses: 0 }]),
    ).toBe("MAESTRO");
  });

  it("traduce las cinco posiciones de Riot a las de ProPlay e ignora las desconocidas", () => {
    const posiciones = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY", "", "INVALID"];
    const r = construirEstadisticaLol({
      puuid: YO,
      servidor: "LA1",
      invocador,
      ligas: [],
      partidas: posiciones.map((teamPosition, i) => partida(`LA1_P${i}`, 10_000 + i, { teamPosition })),
    });
    expect(metricasLolSchema.parse(r.metricas).distribucionRoles).toEqual({
      TOP: 1,
      JUNGLA: 1,
      MID: 1,
      ADC: 1,
      SOPORTE: 1,
    });
  });

  it("sin partidas de solo/dúo no hay posición", () => {
    const r = construirEstadisticaLol({
      puuid: YO,
      servidor: "LA1",
      invocador,
      ligas: [],
      partidas: [partida("LA1_N", 1, {}, { cola: 400 }), partida("LA1_F", 2, {}, { cola: 440 })],
    });
    expect(r.rol).toBeNull();
    expect(r.partidas).toBe(2);
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

describe("CuotaRiotMemoria", () => {
  it("pide esperar al llenar la ventana y se libera al pasar", async () => {
    let reloj = 0;
    const cuota = new CuotaRiotMemoria([{ limite: 2, ms: 1_000 }], 0, () => reloj);
    expect(await cuota.reservar("ALTA")).toBe(0);
    expect(await cuota.reservar("ALTA")).toBe(0);
    expect(await cuota.reservar("ALTA")).toBe(1_000);
    reloj = 1_000;
    expect(await cuota.reservar("ALTA")).toBe(0);
  });

  it("la reserva deja hueco a la prioridad alta cuando la baja ya no cabe", async () => {
    expect(limiteEfectivo(100, "BAJA", 30)).toBe(70);
    expect(limiteEfectivo(20, "BAJA", 30)).toBe(14);
    const cuota = new CuotaRiotMemoria([{ limite: 10, ms: 60_000 }], 30, () => 0);
    for (let i = 0; i < 7; i++) expect(await cuota.reservar("BAJA")).toBe(0);
    expect(await cuota.reservar("BAJA")).toBeGreaterThan(0);
    expect(await cuota.reservar("ALTA")).toBe(0);
  });
});

describe("ClienteRiot", () => {
    const cuotaLibre = () => new CuotaRiotMemoria([{ limite: 1_000, ms: 1_000 }]);

  function clienteCon(
    respuestas: Response[],
    llamadas: string[] = [],
    opciones: { cuota?: CuotaRiotMemoria; clave?: ControlClaveRiot; esperas?: number[] } = {},
  ) {
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
      esperar: async (ms) => {
        opciones.esperas?.push(ms);
      },
      cuota: opciones.cuota ?? cuotaLibre(),
      clave: opciones.clave,
    });
  }

  it("resuelve el Riot ID contra la región continental", async () => {
    const llamadas: string[] = [];
    const cliente = clienteCon([Response.json({ puuid: "p1", gameName: "Ñandú", tagLine: "LAN" })], llamadas);
    const cuenta = await cliente.cuentaPorRiotId("Ñandú", "LAN", "LA1", LLAMADA_VINCULACION);
    expect(cuenta?.puuid).toBe("p1");
    expect(llamadas[0]).toBe(
      "https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/%C3%91and%C3%BA/LAN",
    );
  });

  it("devuelve null en 404", async () => {
    const cliente = clienteCon([new Response(null, { status: 404 })]);
    expect(await cliente.invocadorPorPuuid("p1", "LA1", LLAMADA_COMPROBACION)).toBeNull();
  });

  it("reintenta un 429 respetando Retry-After", async () => {
    const esperas: number[] = [];
    const cliente = clienteCon(
      [
        new Response(null, { status: 429, headers: { "Retry-After": "1" } }),
        Response.json(["LA1_1", "LA1_2"]),
      ],
      [],
      { esperas },
    );
    expect(
      await cliente.idsPartidas("p1", "LA1", { tipo: "ranked", cantidad: 2 }, LLAMADA_INGESTA),
    ).toEqual(["LA1_1", "LA1_2"]);
    expect(esperas).toEqual([1_000]);
  });

  it("un 429 de límite de aplicación bloquea la cuota de todos durante el Retry-After", async () => {
    let reloj = 0;
    const cuota = new CuotaRiotMemoria([{ limite: 1_000, ms: 1_000 }], 0, () => reloj);
    const cliente = clienteCon(
      [
        new Response(null, {
          status: 429,
          headers: { "Retry-After": "30", "X-Rate-Limit-Type": "application" },
        }),
      ],
      [],
      { cuota },
    );
    const error = await cliente
      .ligasPorPuuid("p1", "LA1", LLAMADA_VINCULACION)
      .catch((e: unknown) => e);
    // 30 s es más de lo que espera la vinculación: no hay cupo a tiempo.
    expect(error).toBeInstanceOf(CuotaRiotAgotadaError);
    expect((error as CuotaRiotAgotadaError).esperaMs).toBe(30_000);
    // Cualquier otra llamada, incluso de prioridad alta, espera al bloqueo.
    expect(await cuota.reservar("ALTA")).toBe(30_000);
    reloj = 30_000;
    expect(await cuota.reservar("ALTA")).toBe(0);
  });

  it("un 429 de límite de método no bloquea al resto de la aplicación", async () => {
    const cuota = new CuotaRiotMemoria([{ limite: 1_000, ms: 1_000 }]);
    const cliente = clienteCon(
      [new Response(null, { status: 429, headers: { "Retry-After": "60", "X-Rate-Limit-Type": "method" } })],
      [],
      { cuota },
    );
    await expect(cliente.partida("LA1_1", "LA1", LLAMADA_INGESTA)).rejects.toBeInstanceOf(
      CuotaRiotAgotadaError,
    );
    expect(await cuota.reservar("ALTA")).toBe(0);
  });

  it("sin cupo a tiempo no llama a Riot y lanza CuotaRiotAgotadaError", async () => {
    const llamadas: string[] = [];
    const cuota = new CuotaRiotMemoria([{ limite: 1, ms: 120_000 }], 0, () => 0);
    await cuota.reservar("ALTA");
    const cliente = clienteCon([Response.json([])], llamadas, { cuota });
    const error = await cliente
      .idsPartidas("p1", "LA1", { cantidad: 1 }, LLAMADA_INGESTA)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CuotaRiotAgotadaError);
    expect((error as AppError).code).toBe("MUCHA_DEMANDA");
    expect(llamadas).toEqual([]);
  });

  it("filtra por cola con queue y por fecha con startTime de match-v5", async () => {
    const llamadas: string[] = [];
    const cliente = clienteCon([Response.json([])], llamadas);
    await cliente.idsPartidas(
      "p1",
      "LA1",
      { cola: 420, cantidad: 20, desde: new Date("2026-11-01T00:00:00Z") },
      LLAMADA_INGESTA,
    );
    const parametros = new URL(llamadas[0]!).searchParams;
    expect(parametros.get("queue")).toBe("420");
    expect(parametros.get("type")).toBeNull();
    expect(parametros.get("startTime")).toBe(String(Date.UTC(2026, 10, 1) / 1000));
  });

  it("un 403 marca la clave como inválida y responde «no disponible»; luego ya no llama", async () => {
    const llamadas: string[] = [];
    let invalida = false;
    const marcas: number[] = [];
    const clave: ControlClaveRiot = {
      estado: async () => (invalida ? "clave-caducada" : "ok"),
      marcarInvalida: async (_clave, estadoHttp) => {
        invalida = true;
        marcas.push(estadoHttp);
      },
    };
    const cliente = clienteCon([new Response(null, { status: 403 })], llamadas, { clave });
    const error = await cliente.ligasPorPuuid("p1", "LA1", LLAMADA_INGESTA).catch((e: unknown) => e);
    expect((error as AppError).status).toBe(503);
    expect((error as AppError).code).toBe("RIOT_NO_DISPONIBLE");
    expect(marcas).toEqual([403]);

    const otra = await cliente.ligasPorPuuid("p1", "LA1", LLAMADA_VINCULACION).catch((e: unknown) => e);
    expect((otra as AppError).code).toBe("RIOT_NO_DISPONIBLE");
    expect(llamadas).toHaveLength(1);
  });

  it("sin clave responde 503 sin llamar a Riot", async () => {
    const cliente = new ClienteRiot({ apiKey: undefined });
    const error = await cliente.ligasPorPuuid("p1", "LA1", LLAMADA_INGESTA).catch((e: unknown) => e);
    expect((error as AppError).status).toBe(503);
    expect((error as AppError).code).toBe("RIOT_NO_DISPONIBLE");
  });
});

describe("RiotProvider.obtenerEstadisticas", () => {
  it("pide sólo solo/dúo (cola 420), completa con normales si son menos de 5 y guarda posición y rango", async () => {
    const llamadas: string[] = [];
    const rutas: [RegExp, unknown][] = [
      [/summoners\/by-puuid/, { puuid: YO, profileIconId: 1, summonerLevel: 100 }],
      [/entries\/by-puuid/, [{ queueType: "RANKED_SOLO_5x5", tier: "GOLD", rank: "III", leaguePoints: 40, wins: 5, losses: 4 }]],
      [/ids\?.*queue=420/, ["LA1_R1"]],
      [/ids\?.*type=normal/, ["LA1_N1"]],
      [/matches\/LA1_R1$/, partida("LA1_R1", 2, { teamPosition: "BOTTOM", win: true })],
      [/matches\/LA1_N1$/, partida("LA1_N1", 1, { teamPosition: "TOP" }, { cola: 400 })],
    ];
    const fetchSimulado = (async (url: string | URL | Request) => {
      const texto = String(url);
      llamadas.push(texto);
      const ruta = rutas.find(([patron]) => patron.test(texto));
      return ruta ? Response.json(ruta[1]) : new Response(null, { status: 404 });
    }) as typeof fetch;
    const proveedor = new RiotProvider(
      new ClienteRiot({
        apiKey: "RGAPI-prueba",
        fetch: fetchSimulado,
        esperar: async () => {},
        cuota: new CuotaRiotMemoria([{ limite: 1_000, ms: 1_000 }]),
      }),
    );

    const [estadistica] = await proveedor.obtenerEstadisticas({
      externalId: YO,
      accessToken: null,
      juego: "League of Legends",
      region: "LA1",
    });

    expect(llamadas.some((u) => /type=ranked/.test(u))).toBe(false);
    expect(estadistica).toMatchObject({ partidas: 2, rol: "ADC", rango: "ORO_III" });
  });
});

