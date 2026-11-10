import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DIMENSIONES_MATCHING,
  MOTIVOS_FALTAN_DATOS,
  PERFIL_VECTOR_DIMENSIONES,
  PESOS_MATCHING,
  explicacionMatchingSchema,
  type PesosMatching,
} from "@proplay/shared";
import {
  arranqueEnFrio,
  combinar,
  modoDe,
} from "../src/modules/matching/motor/colaborativo";
import {
  evaluarDisponibilidad,
  evaluarExperiencia,
  evaluarGeografica,
  evaluarHabilidadesBlandas,
} from "../src/modules/matching/motor/dimensiones";
import { winRateAjustado } from "../src/modules/matching/motor/escalas";
import {
  contribucionTotal,
  normalizarPesos,
  ordenarRanking,
  puntuar,
} from "../src/modules/matching/motor/ponderador";
import { evaluarTecnica } from "../src/modules/matching/motor/tecnica";
import type { JugadorMotor, OfertaMotor } from "../src/modules/matching/motor/tipos";
import {
  BLOQUES,
  similitudCoseno,
  vectorizarJugador,
  vectorizarOferta,
} from "../src/modules/matching/motor/vectorizador";

/**
 * RF-09 · Funciones puras del motor de matching: cada dimensión con sus casos
 * límite y datos ausentes, el ponderador (ecuación (1)), el orden del ranking,
 * el vectorizador y el componente colaborativo. Sin base de datos ni red.
 */

function jugador(cambios: Partial<JugadorMotor> = {}): JugadorMotor {
  return {
    jugadorId: "j-1",
    verificado: true,
    captura: {
      posicion: "MID",
      rango: "DIAMANTE_II",
      partidasAnalizadas: 20,
      partidasTemporada: 150,
      distribucionRoles: { MID: 16, TOP: 4 },
      metricas: {
        winRate: 0.55,
        kda: 3.5,
        csPorMinuto: 7.5,
        oroPorMinuto: 420,
        danoPorMinuto: 700,
        visionPorMinuto: 1.2,
        participacionKills: 0.6,
      },
      capturadaEn: new Date("2026-11-01T00:00:00Z"),
    },
    pais: "CO",
    departamento: "ATLANTICO",
    disponibilidadHoras: 25,
    dispuestoRelocalizar: false,
    endorsementsBlandas: [0, 0, 0],
    ...cambios,
  };
}

function oferta(cambios: Partial<OfertaMotor> = {}): OfertaMotor {
  return {
    ofertaId: "o-1",
    rol: "MID",
    rangoMinimo: "DIAMANTE_II",
    modalidad: "PRESENCIAL",
    pais: "CO",
    departamento: "ATLANTICO",
    horasSemana: 25,
    pesos: { ...PESOS_MATCHING },
    ...cambios,
  };
}

function conCaptura(cambios: Partial<NonNullable<JugadorMotor["captura"]>>): JugadorMotor {
  const base = jugador();
  return jugador({ captura: { ...base.captura!, ...cambios } });
}

/** Generador determinista para las pruebas con muchos casos. */
function aleatorio(semilla: number) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ técnica

describe("dimensión técnica", () => {
  it("sin cuenta verificada vale 0 y marca que faltan datos", () => {
    const { valor, explicacion } = evaluarTecnica(jugador({ verificado: false }), oferta());
    expect(valor).toBe(0);
    expect(explicacion).toMatchObject({ faltanDatos: true, motivo: "SIN_CUENTA_VERIFICADA", componentes: null });
  });

  it("una captura de un jugador no verificado no cuenta", () => {
    const sinCuenta = jugador({ verificado: false });
    expect(sinCuenta.captura).not.toBeNull();
    expect(evaluarTecnica(sinCuenta, oferta()).valor).toBe(0);
  });

  it("verificado sin captura vale 0 con SIN_CAPTURA", () => {
    const { valor, explicacion } = evaluarTecnica(jugador({ captura: null }), oferta());
    expect(valor).toBe(0);
    expect(explicacion.motivo).toBe("SIN_CAPTURA");
  });

  it("combina posición, rango y rendimiento con los subpesos 0,25/0,35/0,40", () => {
    const { valor, explicacion } = evaluarTecnica(jugador(), oferta());
    const c = explicacion.componentes!;
    expect(c.posicion).toBe(1);
    expect(c.rango).toBe(1);
    expect(valor).toBeCloseTo(0.25 * c.posicion + 0.35 * c.rango + 0.4 * c.rendimiento, 12);
    expect(explicacion.faltanDatos).toBe(false);
  });

  it("la posición es la fracción de partidas jugadas en la pedida", () => {
    const { explicacion } = evaluarTecnica(jugador(), oferta({ rol: "TOP" }));
    expect(explicacion.fraccionEnPosicion).toBeCloseTo(0.2, 12);
    expect(explicacion.componentes!.posicion).toBeCloseTo(0.2, 12);
  });

  it("sin distribución, la posición es 1 si es la principal y 0 si no", () => {
    const sinDistribucion = conCaptura({ distribucionRoles: null });
    expect(evaluarTecnica(sinDistribucion, oferta()).explicacion.componentes!.posicion).toBe(1);
    expect(evaluarTecnica(sinDistribucion, oferta({ rol: "ADC" })).explicacion.componentes!.posicion).toBe(0);
  });

  it.each([
    ["cumple el mínimo", "DIAMANTE_I", 1],
    ["está justo en el mínimo", "DIAMANTE_II", 1],
    ["está dos divisiones por debajo", "DIAMANTE_IV", 0.5],
    ["está una liga entera por debajo", "ESMERALDA_II", 0],
    ["está muy por debajo", "HIERRO_IV", 0],
  ] as const)("rango: %s", (_caso, rango, esperado) => {
    const { explicacion } = evaluarTecnica(conCaptura({ rango }), oferta());
    expect(explicacion.componentes!.rango).toBeCloseTo(esperado, 12);
  });

  it("sin rango mínimo, el rango cuenta por su posición en el catálogo", () => {
    expect(evaluarTecnica(conCaptura({ rango: "RETADOR" }), oferta({ rangoMinimo: null })).explicacion.componentes!.rango).toBe(1);
    expect(evaluarTecnica(conCaptura({ rango: "HIERRO_IV" }), oferta({ rangoMinimo: null })).explicacion.componentes!.rango).toBe(0);
  });

  it("sin rango en solo/dúo, la parte de rango vale 0", () => {
    expect(evaluarTecnica(conCaptura({ rango: null }), oferta()).explicacion.componentes!.rango).toBe(0);
  });

  it("el soporte no cuenta los CS por minuto; el tirador sí", () => {
    const metricasDe = (rol: OfertaMotor["rol"]) =>
      evaluarTecnica(jugador(), oferta({ rol })).explicacion.metricas.map((m) => m.metrica);
    expect(metricasDe("SOPORTE")).not.toContain("csPorMinuto");
    expect(metricasDe("ADC")).toContain("csPorMinuto");
  });

  it("omite las métricas ausentes y acota las extremas a [0, 1]", () => {
    const base = jugador().captura!;
    const extremo = conCaptura({
      metricas: { ...base.metricas, csPorMinuto: null, kda: 99, danoPorMinuto: -5 },
    });
    const { valor, explicacion } = evaluarTecnica(extremo, oferta());
    expect(explicacion.metricas.map((m) => m.metrica)).not.toContain("csPorMinuto");
    expect(explicacion.metricas.find((m) => m.metrica === "kda")!.normalizado).toBe(1);
    expect(explicacion.metricas.find((m) => m.metrica === "danoPorMinuto")!.normalizado).toBe(0);
    expect(valor).toBeGreaterThanOrEqual(0);
    expect(valor).toBeLessThanOrEqual(1);
  });

  it("el win rate de pocas partidas se encoge hacia el 50 %", () => {
    expect(winRateAjustado(0.8, 5)).toBeCloseTo(0.6, 12);
    expect(winRateAjustado(0.6, 20)).toBeCloseTo(0.5667, 4);
    expect(winRateAjustado(0.7, 0)).toBe(0.5);
  });
});

// ------------------------------------------------------- las otras cuatro

describe("experiencia", () => {
  it("vale 0 con SIN_DATOS_PILOTO: no hay modelo de trayectoria", () => {
    expect(evaluarExperiencia()).toEqual({
      valor: 0,
      explicacion: { faltanDatos: true, motivo: "SIN_DATOS_PILOTO" },
    });
  });
});

describe("habilidades blandas", () => {
  it("sin endorsements vale 0 con SIN_ENDORSEMENTS", () => {
    expect(evaluarHabilidadesBlandas(jugador()).valor).toBe(0);
    expect(evaluarHabilidadesBlandas(jugador({ endorsementsBlandas: [] })).explicacion.motivo).toBe("SIN_ENDORSEMENTS");
  });

  it("cada habilidad satura con 3 endorsements de equipos y se promedian", () => {
    const parcial = evaluarHabilidadesBlandas(jugador({ endorsementsBlandas: [3, 0, 0] }));
    expect(parcial.valor).toBeCloseTo(1 / 3, 12);
    expect(parcial.explicacion).toMatchObject({ faltanDatos: false, endorsementsDeEquipos: 3 });
    expect(evaluarHabilidadesBlandas(jugador({ endorsementsBlandas: [9, 4, 3] })).valor).toBe(1);
  });
});

describe("geográfica", () => {
  const presencial = oferta({ modalidad: "PRESENCIAL", pais: "CO", departamento: "ATLANTICO" });
  const hibrida = oferta({ modalidad: "HIBRIDA", pais: "CO", departamento: "ATLANTICO" });

  it("una oferta remota vale 1 sin mirar la ubicación", () => {
    const { valor, explicacion } = evaluarGeografica(
      jugador({ pais: null, departamento: null }),
      oferta({ modalidad: "REMOTA", pais: null, departamento: null }),
    );
    expect(valor).toBe(1);
    expect(explicacion).toMatchObject({ motivo: "OFERTA_REMOTA", faltanDatos: false });
  });

  it.each([
    ["sin país", { pais: null, departamento: null }],
    ["de Colombia sin departamento", { pais: "CO", departamento: null }],
  ] as const)("jugador %s: neutro 0,5 con «faltan datos»", (_caso, ubicacion) => {
    const { valor, explicacion } = evaluarGeografica(jugador(ubicacion), presencial);
    expect(valor).toBe(0.5);
    expect(explicacion).toMatchObject({ faltanDatos: true, motivo: "SIN_UBICACION", cercania: null });
  });

  it.each([
    ["mismo departamento", "ATLANTICO", 1, 1],
    ["misma macrorregión (Caribe)", "BOLIVAR", 0.6, 0.8],
    ["mismo país, otra macrorregión", "ANTIOQUIA", 0.3, 0.5],
  ] as const)("%s", (_caso, departamento, enPresencial, enHibrida) => {
    expect(evaluarGeografica(jugador({ departamento }), presencial).valor).toBe(enPresencial);
    expect(evaluarGeografica(jugador({ departamento }), hibrida).valor).toBe(enHibrida);
  });

  it("otro país vale 0,1 en presencial y 0,2 en híbrida", () => {
    const extranjero = jugador({ pais: "MX", departamento: null });
    expect(evaluarGeografica(extranjero, presencial)).toMatchObject({ valor: 0.1, explicacion: { cercania: "OTRO_PAIS" } });
    expect(evaluarGeografica(extranjero, hibrida).valor).toBe(0.2);
  });

  it("fuera de Colombia, el mismo país es la coincidencia completa", () => {
    const enMexico = oferta({ modalidad: "PRESENCIAL", pais: "MX", departamento: null });
    expect(evaluarGeografica(jugador({ pais: "MX", departamento: null }), enMexico).valor).toBe(1);
  });

  it("la disposición a relocalizarse sube a 0,75 / 0,85, pero no por encima de lo que ya tenía", () => {
    const lejos = jugador({ pais: "MX", departamento: null, dispuestoRelocalizar: true });
    expect(evaluarGeografica(lejos, presencial)).toMatchObject({ valor: 0.75, explicacion: { relocalizacionAplicada: true } });
    expect(evaluarGeografica(lejos, hibrida).valor).toBe(0.85);
    const local = jugador({ dispuestoRelocalizar: true });
    expect(evaluarGeografica(local, presencial)).toMatchObject({ valor: 1, explicacion: { relocalizacionAplicada: false } });
  });
});

describe("disponibilidad", () => {
  it.each([
    ["cubre las horas", 30, 25, 1],
    ["cubre la mitad", 10, 20, 0.5],
    ["no tiene horas", 0, 20, 0],
  ])("%s", (_caso, horasJugador, horasSemana, esperado) => {
    expect(evaluarDisponibilidad(jugador({ disponibilidadHoras: horasJugador }), oferta({ horasSemana })).valor).toBe(esperado);
  });

  it("si la oferta no pide horas vale 1 con OFERTA_SIN_HORAS", () => {
    const { valor, explicacion } = evaluarDisponibilidad(jugador(), oferta({ horasSemana: null }));
    expect(valor).toBe(1);
    expect(explicacion).toMatchObject({ motivo: "OFERTA_SIN_HORAS", faltanDatos: false });
  });

  it("si el jugador no declaró horas, neutro 0,5 con «faltan datos»", () => {
    const { valor, explicacion } = evaluarDisponibilidad(jugador({ disponibilidadHoras: null }), oferta());
    expect(valor).toBe(0.5);
    expect(explicacion).toMatchObject({ faltanDatos: true, motivo: "SIN_HORAS" });
  });
});

// --------------------------------------------------------------- ponderador

function jugadorAleatorio(r: () => number, i: number): JugadorMotor {
  const verificado = r() > 0.2;
  const base = jugador().captura!;
  return jugador({
    jugadorId: `j-${String(i).padStart(4, "0")}`,
    verificado,
    captura:
      verificado && r() > 0.1
        ? {
            ...base,
            rango: r() > 0.1 ? (["ORO_II", "PLATINO_I", "DIAMANTE_IV", "MAESTRO", "PLATA_III"] as const)[Math.floor(r() * 5)]! : null,
            distribucionRoles: { MID: Math.floor(r() * 20), ADC: Math.floor(r() * 20) },
            metricas: { ...base.metricas, winRate: 0.3 + r() * 0.4, kda: r() * 7, csPorMinuto: 3 + r() * 7 },
          }
        : null,
    pais: r() > 0.3 ? "CO" : r() > 0.5 ? "MX" : null,
    departamento: (["ATLANTICO", "BOLIVAR", "ANTIOQUIA", null] as const)[Math.floor(r() * 4)]!,
    disponibilidadHoras: r() > 0.2 ? Math.floor(r() * 40) : null,
    dispuestoRelocalizar: r() > 0.5,
    endorsementsBlandas: [Math.floor(r() * 4), 0, Math.floor(r() * 2)],
  });
}

function pesosAleatorios(r: () => number): PesosMatching {
  const crudos = DIMENSIONES_MATCHING.map(() => r());
  const suma = crudos.reduce((s, x) => s + x, 0);
  return Object.fromEntries(DIMENSIONES_MATCHING.map((d, i) => [d, crudos[i]! / suma])) as PesosMatching;
}

describe("ponderador (ecuación 1)", () => {
  it("los pesos por defecto suman 1 y los anómalos se normalizan para sumar 1", () => {
    const suma = (p: PesosMatching) => DIMENSIONES_MATCHING.reduce((s, d) => s + p[d], 0);
    expect(suma(normalizarPesos(PESOS_MATCHING))).toBeCloseTo(1, 12);
    expect(normalizarPesos(PESOS_MATCHING)).toEqual(PESOS_MATCHING);
    const anomalos = { tecnica: 2, experiencia: -1, habilidadesBlandas: 0, geografica: 1, disponibilidad: 1 };
    const normalizados = normalizarPesos(anomalos);
    expect(suma(normalizados)).toBeCloseTo(1, 12);
    expect(normalizados.experiencia).toBe(0);
    expect(suma(normalizarPesos({ tecnica: 0, experiencia: 0, habilidadesBlandas: 0, geografica: 0, disponibilidad: 0 }))).toBeCloseTo(1, 12);
  });

  it("en 500 casos, el desglose ponderado suma exactamente el puntaje, todo en [0, 1] y la explicación cumple el contrato", () => {
    const r = aleatorio(20261110);
    for (let i = 0; i < 500; i++) {
      const o = oferta({
        rol: (["TOP", "JUNGLA", "MID", "ADC", "SOPORTE"] as const)[i % 5]!,
        modalidad: (["PRESENCIAL", "HIBRIDA", "REMOTA"] as const)[i % 3]!,
        rangoMinimo: i % 4 === 0 ? null : "PLATINO_II",
        horasSemana: i % 6 === 0 ? null : 20,
        pesos: pesosAleatorios(r),
      });
      const p = puntuar(jugadorAleatorio(r, i), o);
      expect(p.puntaje).toBeCloseTo(contribucionTotal(p.desglose, p.explicacion.pesos), 12);
      for (const d of DIMENSIONES_MATCHING) {
        expect(p.desglose[d]).toBeGreaterThanOrEqual(0);
        expect(p.desglose[d]).toBeLessThanOrEqual(1);
        const { faltanDatos, motivo } = p.explicacion.dimensiones[d];
        expect(faltanDatos).toBe((MOTIVOS_FALTAN_DATOS as readonly string[]).includes(motivo ?? ""));
      }
      expect(explicacionMatchingSchema.safeParse(p.explicacion).success).toBe(true);
    }
  });

  it("con los pesos del piloto, experiencia y habilidades blandas no aportan nada", () => {
    const conEndorsements = puntuar(jugador({ endorsementsBlandas: [3, 3, 3] }), oferta());
    const sinEndorsements = puntuar(jugador(), oferta());
    expect(conEndorsements.desglose.habilidadesBlandas).toBe(1);
    expect(conEndorsements.puntaje).toBe(sinEndorsements.puntaje);
  });

  it("un jugador sin cuenta verificada entra con la técnica en 0 y queda por debajo de uno verificado igual", () => {
    const verificado = puntuar(jugador({ jugadorId: "a" }), oferta());
    const sinCuenta = puntuar(jugador({ jugadorId: "b", verificado: false }), oferta());
    expect(sinCuenta.desglose.tecnica).toBe(0);
    expect(sinCuenta.puntaje).toBeLessThan(verificado.puntaje);
  });
});

describe("orden del ranking", () => {
  const candidato = (jugadorId: string, puntaje: number, tecnica: number) => ({
    jugadorId,
    puntaje,
    desglose: { tecnica, experiencia: 0, habilidadesBlandas: 0, geografica: 0, disponibilidad: 0 },
  });

  it("puntaje de mayor a menor; a igualdad, técnica y después id", () => {
    const orden = ordenarRanking([
      candidato("c", 0.5, 0.2),
      candidato("b", 0.5, 0.2),
      candidato("a", 0.5, 0.1),
      candidato("d", 0.9, 0),
    ]).map((c) => c.jugadorId);
    expect(orden).toEqual(["d", "b", "c", "a"]);
  });

  it("es el mismo con cualquier orden de entrada", () => {
    const r = aleatorio(7);
    const lista = Array.from({ length: 60 }, (_, i) =>
      candidato(`j-${i}`, Math.round(r() * 4) / 4, Math.round(r() * 2) / 2),
    );
    const esperado = ordenarRanking(lista).map((c) => c.jugadorId);
    for (let vuelta = 0; vuelta < 10; vuelta++) {
      const barajada = [...lista].sort(() => r() - 0.5);
      expect(ordenarRanking(barajada).map((c) => c.jugadorId)).toEqual(esperado);
    }
  });
});

// ------------------------------------------------------------- vectorizador

describe("vectorizador v2", () => {
  const norma = (v: number[]) => Math.sqrt(v.reduce((s, x) => s + x * x, 0));

  it("produce vectores de 64 dimensiones con norma 1, nunca nulos", () => {
    const vacio = jugador({ verificado: false, captura: null, pais: null, departamento: null, disponibilidadHoras: null });
    for (const v of [vectorizarJugador(jugador()), vectorizarJugador(vacio), vectorizarOferta(oferta())]) {
      expect(v).toHaveLength(PERFIL_VECTOR_DIMENSIONES);
      expect(norma(v)).toBeCloseTo(1, 12);
    }
  });

  it("es determinista: mismos datos, mismo vector", () => {
    expect(vectorizarJugador(jugador())).toEqual(vectorizarJugador(jugador()));
  });

  it("un jugador sin cuenta verificada no tiene nada en el bloque técnico", () => {
    const v = vectorizarJugador(jugador({ verificado: false }));
    expect(v.slice(BLOQUES.posicion, BLOQUES.verificado + 1).every((x) => x === 0)).toBe(true);
  });

  it("la oferta multiplica cada bloque por su peso: sin peso geográfico, no hay bloque geográfico", () => {
    const sinGeografica = vectorizarOferta(
      oferta({ pesos: { tecnica: 0.5, experiencia: 0, habilidadesBlandas: 0, geografica: 0, disponibilidad: 0.5 } }),
    );
    expect(sinGeografica.slice(BLOQUES.macrorregion, BLOQUES.relocalizacion + 1).every((x) => x === 0)).toBe(true);
  });

  it("un jugador de la posición y el rango pedidos está más cerca que uno de otra posición y otro rango", () => {
    const o = vectorizarOferta(oferta());
    const parecido = vectorizarJugador(jugador());
    const distinto = vectorizarJugador(
      conCaptura({ posicion: "SOPORTE", rango: "BRONCE_I", distribucionRoles: { SOPORTE: 20 } }),
    );
    expect(similitudCoseno(o, parecido)).toBeGreaterThan(similitudCoseno(o, distinto));
  });
});

// ------------------------------------------------------------- colaborativo

describe("componente colaborativo (arranque en frío)", () => {
  it("tiene peso 0 y no puntúa a nadie: el modo es CONTENIDO", () => {
    expect(arranqueEnFrio.peso("equipo")).toBe(0);
    expect(arranqueEnFrio.puntajes("equipo", ["a", "b"]).size).toBe(0);
    expect(modoDe(0)).toBe("CONTENIDO");
    expect(modoDe(0.2)).toBe("HIBRIDO");
  });

  it("con peso 0, combinar deja el puntaje por contenido intacto", () => {
    expect(combinar(0.73, 0.1, 0)).toBe(0.73);
    expect(combinar(0.5, 1, 0.2)).toBeCloseTo(0.6, 12);
  });
});

// ------------------------------------------------------------ sin red

describe("el motor no puede llamar a la red", () => {
  it("sus archivos sólo importan de @proplay/shared y entre ellos", () => {
    const carpeta = join(__dirname, "../src/modules/matching/motor");
    for (const archivo of readdirSync(carpeta)) {
      const fuente = readFileSync(join(carpeta, archivo), "utf8");
      const origenes = [...fuente.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);
      for (const origen of origenes) {
        expect(origen === "@proplay/shared" || origen.startsWith("./"), `${archivo} importa ${origen}`).toBe(true);
      }
    }
  });
});
