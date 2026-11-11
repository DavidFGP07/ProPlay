import { describe, expect, it } from "vitest";
import {
  CAMPOS_JUGADOR_ENCONTRADO,
  DIMENSIONES_MATCHING,
  DIMENSIONES_SIN_DATOS_PILOTO,
  MOTIVOS_DIMENSION,
  MOTIVOS_FALTAN_DATOS,
  ORDENES_RANKING,
  PESOS_MATCHING,
  candidatoOfertaSchema,
  candidatoRankingSchema,
  pesosMatchingSchema,
  rankingOfertaQuerySchema,
  rankingOfertaSchema,
  type CandidatoRanking,
} from "@proplay/shared";

/**
 * RF-09 · Contrato del ranking de candidatos. Lo consumen el motor de matching
 * (api) y la vista del ranking (web), que avanzan en paralelo sobre él.
 */

const explicacion: CandidatoRanking["explicacion"] = {
  pesos: { ...PESOS_MATCHING },
  dimensiones: {
    tecnica: {
      faltanDatos: false,
      motivo: null,
      posicionPedida: "MID",
      posicionPrincipal: "MID",
      fraccionEnPosicion: 0.8,
      rango: "ORO_II",
      rangoMinimo: "PLATA_I",
      partidasAnalizadas: 20,
      datosDel: new Date("2026-11-01T00:00:00Z"),
      componentes: { posicion: 1, rango: 1, rendimiento: 0.62 },
      metricas: [{ metrica: "kda", valor: 3.4, normalizado: 0.6 }],
    },
    experiencia: { faltanDatos: true, motivo: "SIN_DATOS_PILOTO" },
    habilidadesBlandas: { faltanDatos: true, motivo: "SIN_ENDORSEMENTS", endorsementsDeEquipos: 0 },
    geografica: {
      faltanDatos: true,
      motivo: "SIN_UBICACION",
      modalidad: "PRESENCIAL",
      cercania: null,
      relocalizacionAplicada: false,
    },
    disponibilidad: { faltanDatos: false, motivo: null, horasJugador: 20, horasOferta: 15 },
  },
};

const candidato: CandidatoRanking = {
  puesto: 1,
  jugador: {
    id: "jugador-1",
    nombre: "Ana",
    avatarUrl: null,
    pais: "CO",
    departamento: "ATLANTICO",
    disponibilidadHoras: 20,
    dispuestoRelocalizar: false,
    verificacion: { plataforma: "RIOT", verificadaEn: new Date("2026-10-01T00:00:00Z") },
    posicion: "MID",
    rango: "ORO_II",
    datosDel: new Date("2026-11-01T00:00:00Z"),
  },
  puntaje: 0.5 * 0.85 + 0.25 * 0.5 + 0.25 * 1,
  desglose: { tecnica: 0.85, experiencia: 0, habilidadesBlandas: 0, geografica: 0.5, disponibilidad: 1 },
  explicacion,
  similitud: 0.91,
  postulacion: null,
};

describe("pesos por defecto del piloto", () => {
  it("son válidos y suman 1", () => {
    expect(pesosMatchingSchema.safeParse(PESOS_MATCHING).success).toBe(true);
    const suma = DIMENSIONES_MATCHING.reduce((total, d) => total + PESOS_MATCHING[d], 0);
    expect(suma).toBeCloseTo(1, 10);
  });

  it("ponen en 0 las dimensiones sin datos en el piloto, y sólo ésas", () => {
    for (const dimension of DIMENSIONES_MATCHING) {
      const sinDatos = (DIMENSIONES_SIN_DATOS_PILOTO as readonly string[]).includes(dimension);
      expect(PESOS_MATCHING[dimension] === 0).toBe(sinDatos);
    }
  });
});

describe("motivos de la explicación", () => {
  it("los de «faltan datos» son un subconjunto de los motivos", () => {
    for (const motivo of MOTIVOS_FALTAN_DATOS) expect(MOTIVOS_DIMENSION).toContain(motivo);
  });
});

describe("rankingOfertaSchema", () => {
  const ranking = {
    data: [candidato],
    meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    oferta: { id: "oferta-1", titulo: "MID", estado: "ABIERTA", rol: "MID", pesos: PESOS_MATCHING },
    calculadoEn: "2026-11-10T12:00:00.000Z",
    versionFormulas: 1,
    modo: "CONTENIDO",
    pesoColaborativo: 0,
  };

  it("acepta un ranking completo y convierte las fechas", () => {
    const resultado = rankingOfertaSchema.parse(JSON.parse(JSON.stringify(ranking)));
    expect(resultado.calculadoEn).toBeInstanceOf(Date);
    expect(resultado.data[0]!.explicacion.dimensiones.tecnica.datosDel).toBeInstanceOf(Date);
  });

  it("el candidato expone del jugador sólo la lista blanca del buscador", () => {
    const resultado = candidatoRankingSchema.parse({
      ...candidato,
      jugador: { ...candidato.jugador, email: "ana@example.com", puuid: "x" },
    });
    expect(Object.keys(resultado.jugador).sort()).toEqual([...CAMPOS_JUGADOR_ENCONTRADO].sort());
  });

  it("acepta a un jugador sin cuenta verificada con la técnica en 0", () => {
    const sinCuenta: CandidatoRanking = {
      ...candidato,
      jugador: { ...candidato.jugador, verificacion: null, posicion: null, rango: null, datosDel: null },
      desglose: { ...candidato.desglose, tecnica: 0 },
      explicacion: {
        ...explicacion,
        dimensiones: {
          ...explicacion.dimensiones,
          tecnica: {
            ...explicacion.dimensiones.tecnica,
            faltanDatos: true,
            motivo: "SIN_CUENTA_VERIFICADA",
            posicionPrincipal: null,
            fraccionEnPosicion: null,
            rango: null,
            partidasAnalizadas: null,
            datosDel: null,
            componentes: null,
            metricas: [],
          },
        },
      },
    };
    expect(candidatoRankingSchema.safeParse(sinCuenta).success).toBe(true);
  });

  it.each([
    ["un puntaje mayor que 1", { puntaje: 1.2 }],
    ["una dimensión negativa", { desglose: { ...candidato.desglose, geografica: -0.1 } }],
    ["el puesto 0", { puesto: 0 }],
  ])("rechaza %s", (_caso, cambio) => {
    expect(candidatoRankingSchema.safeParse({ ...candidato, ...cambio }).success).toBe(false);
  });

  it("rechaza un modo que no existe", () => {
    expect(rankingOfertaSchema.safeParse({ ...ranking, modo: "COLABORATIVO" }).success).toBe(false);
  });
});

describe("rankingOfertaQuerySchema", () => {
  it("por defecto: primera página, todos los candidatos y orden por puntaje", () => {
    expect(rankingOfertaQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 20,
      soloPostulados: false,
      orden: "puntaje",
    });
  });

  it("la lista blanca del orden es el puntaje y las cinco dimensiones, nada más", () => {
    expect([...ORDENES_RANKING]).toEqual(["puntaje", ...DIMENSIONES_MATCHING]);
    for (const orden of ORDENES_RANKING) {
      expect(rankingOfertaQuerySchema.parse({ orden }).orden).toBe(orden);
    }
  });

  it("rechaza cualquier orden fuera de la lista blanca", () => {
    for (const orden of ["nombre", "PUNTAJE", "puntaje desc", "tecnica; DROP TABLE x", "", "m.puntaje"]) {
      expect(rankingOfertaQuerySchema.safeParse({ orden }).success).toBe(false);
    }
  });

  it("soloPostulados llega como texto de la query y sólo admite true o false", () => {
    expect(rankingOfertaQuerySchema.parse({ soloPostulados: "true" }).soloPostulados).toBe(true);
    expect(rankingOfertaQuerySchema.parse({ soloPostulados: "false" }).soloPostulados).toBe(false);
    expect(rankingOfertaQuerySchema.safeParse({ soloPostulados: "1" }).success).toBe(false);
  });
});

describe("candidatoOfertaSchema", () => {
  const detalle = {
    candidato,
    anterior: null,
    siguiente: { id: "jugador-2", nombre: "Luis" },
    total: 2,
    oferta: {
      id: "oferta-1",
      titulo: "MID para la academia",
      estado: "ABIERTA",
      rol: "MID",
      pesos: { ...PESOS_MATCHING },
    },
    calculadoEn: "2026-11-10T12:00:00.000Z",
    versionFormulas: 2,
    modo: "CONTENIDO",
    pesoColaborativo: 0,
  };

  it("acepta el detalle de un candidato con sus vecinos y convierte las fechas", () => {
    const resultado = candidatoOfertaSchema.parse(detalle);
    expect(resultado.calculadoEn).toBeInstanceOf(Date);
    expect(resultado.anterior).toBeNull();
    expect(resultado.siguiente).toEqual({ id: "jugador-2", nombre: "Luis" });
  });

  it("exige los datos del cálculo", () => {
    const { modo: _modo, ...sinModo } = detalle;
    expect(candidatoOfertaSchema.safeParse(sinModo).success).toBe(false);
  });
});
