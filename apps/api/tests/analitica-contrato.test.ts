import { describe, expect, it } from "vitest";
import {
  BANDAS_RANGO,
  DIMENSIONES_MATCHING,
  DIMENSIONES_SIN_DATOS_PILOTO,
  DIMENSIONES_VISIBLES,
  ETAPAS_EMBUDO,
  FECHA_POR_ESTADO_POSTULACION,
  LINEA_BASE_SCOUTING_MANUAL,
  MIN_CANDIDATOS_DIMENSION_DECISIVA,
  RANGOS_LOL,
  TOP_DIMENSION_DECISIVA,
  TRANSICIONES_POSTULACION,
  UMBRAL_PRIVACIDAD_ANALITICA,
  ZONA_HORARIA_PILOTO,
  bandaDeRango,
  dimensionDecisivaSchema,
  embudoEquipoSchema,
  embudoOfertaSchema,
  resumenDiasSchema,
  talentoVerificadoSchema,
  type Embudo,
  type GrupoTalentoRespuesta,
} from "@proplay/shared";

/**
 * RF-13 · Contrato de la analítica. Lo consumen el módulo `analitica` de la
 * API, el script del piloto y la vista de Analítica; las definiciones están en
 * docs/arquitectura.md, «Analítica».
 */

const sinDatos = { n: 0, mediana: null, media: null };

const embudo: Embudo = {
  postulaciones: 4,
  etapas: ETAPAS_EMBUDO.map((etapa, i) => ({
    etapa,
    alcanzaron: 4 - i,
    conversion: i === 0 ? null : (4 - i) / (5 - i),
    siguen: 0,
    rechazadas: i === 0 ? 0 : 1,
    rechazadasAlCerrar: 0,
    diasEnEtapa: etapa === "ACEPTADA" ? sinDatos : { n: 1, mediana: 1.5, media: 1.5 },
  })),
  coincidenciasExitosas: 1,
};

const oferta = {
  id: "oferta-1",
  titulo: "ADC para la liga en línea",
  rol: "ADC",
  estado: "CUBIERTA",
  publicadaEn: "2026-11-01T15:00:00.000Z",
  cerradaEn: "2026-11-20T15:00:00.000Z",
  postulaciones: 4,
  diasHastaCubrir: 12,
  diasHastaPrimerTryout: 5,
  diasAbierta: null,
};

const celdas = (valor: number | null) => ({
  porPosicion: { TOP: valor, JUNGLA: valor, MID: valor, ADC: valor, SOPORTE: valor },
  porBanda: {
    HIERRO_PLATA: valor,
    ORO_PLATINO: valor,
    ESMERALDA_DIAMANTE: valor,
    MAESTRO_O_SUPERIOR: valor,
    SIN_RANGO: valor,
  },
});

const grupos: GrupoTalentoRespuesta[] = [
  { grupo: "CARIBE", total: 25, ...celdas(5) },
  { grupo: "RESTO_COLOMBIA", total: 8, ...celdas(null) },
];

const talento = {
  jugadoresRegistrados: 50,
  verificados: 35,
  proporcionVerificados: 0.7,
  umbral: UMBRAL_PRIVACIDAD_ANALITICA,
  grupos,
  macrorregiones: [
    {
      macrorregion: "CARIBE",
      total: 25,
      departamentos: [
        { departamento: "ATLANTICO", jugadores: 18 },
        { departamento: "OTROS", jugadores: 7 },
      ],
    },
  ],
  fueraDeColombia: null,
  sinUbicacion: 0,
  calculadoEn: "2026-11-20T15:00:00.000Z",
};

describe("constantes de la analítica", () => {
  it("cuenta los días en la zona horaria de Colombia", () => {
    expect(ZONA_HORARIA_PILOTO).toBe("America/Bogota");
  });

  it("las etapas del embudo siguen la máquina de estados, cada una con su fecha", () => {
    for (const [i, etapa] of ETAPAS_EMBUDO.entries()) {
      expect(FECHA_POR_ESTADO_POSTULACION[etapa]).toBeDefined();
      const siguiente = ETAPAS_EMBUDO[i + 1];
      if (siguiente) expect(TRANSICIONES_POSTULACION[etapa]).toContain(siguiente);
    }
    expect(ETAPAS_EMBUDO).not.toContain("RECHAZADA");
  });

  it("la dimensión decisiva necesita el top más un resto del tamaño del umbral", () => {
    expect(TOP_DIMENSION_DECISIVA).toBe(5);
    expect(UMBRAL_PRIVACIDAD_ANALITICA).toBe(3);
    expect(MIN_CANDIDATOS_DIMENSION_DECISIVA).toBe(8);
  });

  it("las dimensiones visibles son las cinco menos las que no tienen datos en el piloto", () => {
    expect(DIMENSIONES_VISIBLES).toEqual(["tecnica", "geografica", "disponibilidad"]);
    for (const d of DIMENSIONES_MATCHING) {
      expect(DIMENSIONES_VISIBLES.includes(d)).toBe(
        !(DIMENSIONES_SIN_DATOS_PILOTO as readonly string[]).includes(d),
      );
    }
  });

  it("la línea base sigue sin medir (tarea 0.2)", () => {
    expect(LINEA_BASE_SCOUTING_MANUAL).toBeNull();
  });
});

describe("bandaDeRango", () => {
  it.each([
    ["HIERRO_IV", "HIERRO_PLATA"],
    ["PLATA_I", "HIERRO_PLATA"],
    ["ORO_IV", "ORO_PLATINO"],
    ["PLATINO_I", "ORO_PLATINO"],
    ["ESMERALDA_IV", "ESMERALDA_DIAMANTE"],
    ["DIAMANTE_I", "ESMERALDA_DIAMANTE"],
    ["MAESTRO", "MAESTRO_O_SUPERIOR"],
    ["RETADOR", "MAESTRO_O_SUPERIOR"],
  ] as const)("%s está en %s", (rango, banda) => {
    expect(bandaDeRango(rango)).toBe(banda);
  });

  it("cada rango del catálogo cae en una banda, y las bandas van en orden", () => {
    const vistas = RANGOS_LOL.map(bandaDeRango);
    expect(new Set(vistas)).toEqual(new Set(BANDAS_RANGO));
    const orden = vistas.map((b) => BANDAS_RANGO.indexOf(b));
    expect(orden).toEqual([...orden].sort((a, b) => a - b));
  });
});

describe("resumenDiasSchema", () => {
  it("sin datos, mediana y media son nulas (no «0 días»)", () => {
    expect(resumenDiasSchema.safeParse(sinDatos).success).toBe(true);
    expect(resumenDiasSchema.safeParse({ n: 0, mediana: 0, media: 0 }).success).toBe(false);
    expect(resumenDiasSchema.safeParse({ n: 2, mediana: null, media: null }).success).toBe(false);
  });
});

describe("embudo", () => {
  it("acepta el embudo de una oferta y convierte las fechas", () => {
    const r = embudoOfertaSchema.parse({ oferta, embudo, calculadoEn: "2026-11-20T15:00:00.000Z" });
    expect(r.oferta.publicadaEn).toBeInstanceOf(Date);
    expect(r.embudo.etapas.map((e) => e.etapa)).toEqual([...ETAPAS_EMBUDO]);
  });

  it("exige una fila por etapa", () => {
    const corto = { ...embudo, etapas: embudo.etapas.slice(0, 3) };
    expect(
      embudoOfertaSchema.safeParse({ oferta, embudo: corto, calculadoEn: new Date() }).success,
    ).toBe(false);
  });

  it("un borrador no entra en la analítica", () => {
    const borrador = { ...oferta, estado: "BORRADOR" };
    expect(
      embudoOfertaSchema.safeParse({ oferta: borrador, embudo, calculadoEn: new Date() }).success,
    ).toBe(false);
  });

  it("acepta el agregado del equipo con la tasa de cobertura nula si nada ha terminado", () => {
    const r = embudoEquipoSchema.safeParse({
      embudo,
      diasHastaCubrir: sinDatos,
      diasHastaPrimerTryout: { n: 1, mediana: 5, media: 5 },
      cobertura: { abiertas: 2, cubiertas: 0, cerradasSinCubrir: 0, tasa: null },
      ofertas: [{ ...oferta, estado: "ABIERTA", cerradaEn: null, diasHastaCubrir: null, diasAbierta: 9 }],
      calculadoEn: new Date(),
    });
    expect(r.success).toBe(true);
  });
});

describe("dimensionDecisivaSchema", () => {
  const base = {
    ofertaId: "oferta-1",
    candidatos: 16,
    top: TOP_DIMENSION_DECISIVA,
    suficiente: true,
    puntajeMedioTop: 0.6,
    puntajeMedioResto: 0.4,
    ventajaTotal: 0.2,
    dimensiones: [
      { dimension: "tecnica", peso: 0.6, aporteMedioTop: 0.4, aporteMedioResto: 0.22, ventaja: 0.18 },
      { dimension: "disponibilidad", peso: 0.4, aporteMedioTop: 0.2, aporteMedioResto: 0.18, ventaja: 0.02 },
      { dimension: "geografica", peso: 0, aporteMedioTop: 0, aporteMedioResto: 0, ventaja: 0 },
    ],
    decisiva: "tecnica",
    calculadoEn: "2026-11-20T15:00:00.000Z",
    versionFormulas: 2,
  };

  it("acepta el cálculo con ventajas negativas y el grupo «otras»", () => {
    const conOtras = {
      ...base,
      dimensiones: [
        ...base.dimensiones,
        { dimension: "otras", peso: 0.1, aporteMedioTop: 0, aporteMedioResto: 0.01, ventaja: -0.01 },
      ],
    };
    expect(dimensionDecisivaSchema.safeParse(conOtras).success).toBe(true);
  });

  it("la decisiva sólo puede ser una dimensión visible", () => {
    expect(dimensionDecisivaSchema.safeParse({ ...base, decisiva: "experiencia" }).success).toBe(false);
    const oculta = {
      ...base,
      dimensiones: [{ ...base.dimensiones[0], dimension: "habilidadesBlandas" }],
    };
    expect(dimensionDecisivaSchema.safeParse(oculta).success).toBe(false);
  });

  it("sin candidatos suficientes no hay ventajas ni decisiva", () => {
    const pocos = {
      ...base,
      candidatos: MIN_CANDIDATOS_DIMENSION_DECISIVA - 1,
      suficiente: false,
      puntajeMedioTop: null,
      puntajeMedioResto: null,
      ventajaTotal: null,
    };
    expect(dimensionDecisivaSchema.safeParse({ ...pocos, dimensiones: [], decisiva: null }).success).toBe(
      true,
    );
    expect(dimensionDecisivaSchema.safeParse(pocos).success).toBe(false);
  });
});

describe("talentoVerificadoSchema", () => {
  it("acepta celdas ocultas (null) y el grupo OTROS de departamentos", () => {
    const r = talentoVerificadoSchema.parse(talento);
    expect(r.grupos[1]!.porPosicion.ADC).toBeNull();
    expect(r.calculadoEn).toBeInstanceOf(Date);
  });

  it("exige los dos grupos de la comparación y todas las bandas, con SIN_RANGO", () => {
    expect(talentoVerificadoSchema.safeParse({ ...talento, grupos: [grupos[0]] }).success).toBe(false);
    const sinBanda = structuredClone(grupos);
    delete (sinBanda[0]!.porBanda as Partial<Record<string, unknown>>).SIN_RANGO;
    expect(talentoVerificadoSchema.safeParse({ ...talento, grupos: sinBanda }).success).toBe(false);
  });

  it("no admite conteos negativos ni fraccionarios", () => {
    const malo = structuredClone(grupos);
    malo[0]!.total = 2.5;
    expect(talentoVerificadoSchema.safeParse({ ...talento, grupos: malo }).success).toBe(false);
  });
});
