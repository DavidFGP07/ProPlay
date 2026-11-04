import { afterAll, describe, expect, it } from "vitest";
import { RangoLol as RangoLolPrisma } from "@prisma/client";
import {
  CAMPOS_JUGADOR_ENCONTRADO,
  COLA_LIGA_SOLO_DUO,
  COLA_SOLO_DUO,
  POSICIONES_LOL,
  POSICION_POR_TEAM_POSITION,
  RANGOS_LOL,
  busquedaJugadoresSchema,
  crearOfertaSchema,
  jugadorEncontradoSchema,
  rangoAlMenos,
  rangoDesdeRiot,
} from "@proplay/shared";
import { prisma } from "../src/config/prisma";
import { cerrarConexiones } from "./utils/entorno";

/**
 * RF-08 · Contrato del buscador de talento y del catálogo de rangos de LoL,
 * más las equivalencias con la API de Riot que debe usar la ingesta de
 * estadísticas. El endpoint llega en el PR de la API.
 */

afterAll(async () => {
  await cerrarConexiones();
});

describe("catálogo de rangos (RangoLol)", () => {
  it("coincide con el enum de Prisma, en el mismo orden", () => {
    expect(Object.values(RangoLolPrisma)).toEqual([...RANGOS_LOL]);
  });

  it("Postgres lo ordena igual que shared: el rango mínimo es una comparación", async () => {
    const [fila] = await prisma.$queryRaw<{ orden: string[] }[]>`
      SELECT enum_range(NULL::"RangoLol")::text[] AS orden
    `;
    expect(fila?.orden).toEqual([...RANGOS_LOL]);
    const [comparacion] = await prisma.$queryRaw<{ oroI: boolean; maestro: boolean }[]>`
      SELECT 'ORO_I'::"RangoLol" > 'ORO_II'::"RangoLol" AS "oroI",
             'MAESTRO'::"RangoLol" > 'DIAMANTE_I'::"RangoLol" AS maestro
    `;
    expect(comparacion).toEqual({ oroI: true, maestro: true });
  });

  it("tiene 31 valores: 7 tiers con cuatro divisiones y 3 sin división", () => {
    expect(RANGOS_LOL).toHaveLength(31);
    expect(new Set(RANGOS_LOL).size).toBe(31);
    expect(RANGOS_LOL[0]).toBe("HIERRO_IV");
    expect(RANGOS_LOL.at(-1)).toBe("RETADOR");
  });

  it("rangoAlMenos compara en el orden del catálogo", () => {
    expect(rangoAlMenos("ORO_I", "ORO_II")).toBe(true);
    expect(rangoAlMenos("ORO_II", "ORO_II")).toBe(true);
    expect(rangoAlMenos("PLATA_I", "ORO_IV")).toBe(false);
    expect(rangoAlMenos("MAESTRO", "DIAMANTE_I")).toBe(true);
  });
});

describe("equivalencias con la API de Riot", () => {
  it.each([
    ["GOLD", "II", "ORO_II"],
    ["iron", "iv", "HIERRO_IV"],
    ["EMERALD", "I", "ESMERALDA_I"],
    ["MASTER", "I", "MAESTRO"],
    ["GRANDMASTER", "I", "GRAN_MAESTRO"],
    ["CHALLENGER", "I", "RETADOR"],
  ])("rangoDesdeRiot(%s, %s) = %s", (tier, rank, esperado) => {
    expect(rangoDesdeRiot(tier, rank)).toBe(esperado);
  });

  it.each([
    ["UNRANKED", "I"],
    ["GOLD", "V"],
    ["GOLD", ""],
  ])("rangoDesdeRiot(%s, %s) no inventa un rango: null", (tier, rank) => {
    expect(rangoDesdeRiot(tier, rank)).toBeNull();
  });

  it("todo tier y división de Riot produce un valor del catálogo", () => {
    const tiers = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND"];
    const obtenidos = tiers.flatMap((tier) =>
      ["IV", "III", "II", "I"].map((rank) => rangoDesdeRiot(tier, rank)),
    );
    expect(obtenidos.every((r) => r !== null && RANGOS_LOL.includes(r))).toBe(true);
    expect(new Set(obtenidos).size).toBe(28);
  });

  it("cada teamPosition va a una posición de ProPlay y las cubre todas", () => {
    expect(new Set(Object.values(POSICION_POR_TEAM_POSITION))).toEqual(new Set(POSICIONES_LOL));
    expect(POSICION_POR_TEAM_POSITION.UTILITY).toBe("SOPORTE");
    expect(POSICION_POR_TEAM_POSITION.BOTTOM).toBe("ADC");
  });

  it("las colas de clasificatoria solo/dúo", () => {
    expect(COLA_SOLO_DUO).toBe(420);
    expect(COLA_LIGA_SOLO_DUO).toBe("RANKED_SOLO_5x5");
  });
});

describe("busquedaJugadoresSchema", () => {
  it("filtra por posición, rango mínimo y departamento del catálogo", () => {
    const filtros = { posicion: "JUNGLA", rangoMinimo: "ORO_II", departamento: "ATLANTICO" };
    expect(busquedaJugadoresSchema.parse(filtros)).toEqual(filtros);
    expect(busquedaJugadoresSchema.parse({})).toEqual({});
  });

  it.each([
    ["una posición de otro juego", { posicion: "AWPER" }],
    ["un rango escrito a mano", { rangoMinimo: "Diamante II" }],
    ["un rango con SQL", { rangoMinimo: "ORO_II' OR '1'='1" }],
    ["un departamento con SQL", { departamento: "ATLANTICO'; DROP TABLE \"Usuario\"; --" }],
  ])("rechaza %s", (_caso, filtros) => {
    expect(busquedaJugadoresSchema.safeParse(filtros).success).toBe(false);
  });

  it("ignora los filtros retirados del prototipo", () => {
    const filtros = busquedaJugadoresSchema.parse({ kdaMinimo: 3, juego: "Dota 2", rol: "MID" });
    expect(filtros).toEqual({});
  });
});

describe("jugadorEncontradoSchema (lista blanca)", () => {
  it("es exactamente la lista acordada", () => {
    expect([...CAMPOS_JUGADOR_ENCONTRADO].sort()).toEqual(
      [
        "avatarUrl",
        "datosDel",
        "departamento",
        "disponibilidadHoras",
        "dispuestoRelocalizar",
        "id",
        "nombre",
        "pais",
        "posicion",
        "rango",
        "verificacion",
      ].sort(),
    );
  });

  it("descarta todo lo que no esté en la lista", () => {
    const jugador = jugadorEncontradoSchema.parse({
      id: "p1",
      nombre: "Ana",
      avatarUrl: null,
      pais: "CO",
      departamento: "ATLANTICO",
      disponibilidadHoras: 20,
      dispuestoRelocalizar: true,
      verificacion: { plataforma: "RIOT", verificadaEn: "2026-10-01T00:00:00.000Z", externalId: "puuid" },
      posicion: "MID",
      rango: "ORO_II",
      datosDel: "2026-10-30T00:00:00.000Z",
      email: "ana@proplay.gg",
      bio: "Presentación",
      usuarioId: "cuenta-1",
    });
    expect(jugador).not.toHaveProperty("email");
    expect(jugador).not.toHaveProperty("bio");
    expect(jugador).not.toHaveProperty("usuarioId");
    expect(jugador.verificacion).not.toHaveProperty("externalId");
  });
});

describe("rango mínimo de la oferta", () => {
  it("usa el catálogo y ya no admite texto libre", () => {
    const base = {
      titulo: "MID para la academia",
      rol: "MID",
      modalidad: "REMOTA",
      descripcion: "Roster de academia con entrenamientos de lunes a viernes.",
    };
    expect(crearOfertaSchema.safeParse({ ...base, rangoMinimo: "DIAMANTE_II" }).success).toBe(true);
    expect(crearOfertaSchema.safeParse({ ...base, rangoMinimo: "Diamante II" }).success).toBe(false);
  });
});
