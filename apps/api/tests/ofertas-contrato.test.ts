import {
  EstadoOferta as EstadoOfertaPrisma,
  EstadoPostulacion as EstadoPostulacionPrisma,
  Modalidad as ModalidadPrisma,
  PosicionLol as PosicionLolPrisma,
  Prisma,
} from "@prisma/client";
import {
  ESTADOS_OFERTA,
  ESTADOS_POSTULACION,
  FECHA_POR_ESTADO_POSTULACION,
  MODALIDADES,
  PESOS_MATCHING,
  POSICIONES_LOL,
  TRANSICIONES_OFERTA,
  TRANSICIONES_POSTULACION,
  actualizarOfertaSchema,
  crearOfertaSchema,
  listarOfertasQuerySchema,
  pesosMatchingSchema,
  ubicacionOfertaSchema,
} from "@proplay/shared";
import { describe, expect, it } from "vitest";

/**
 * RF-07 y RF-10 · Contrato de ofertas y postulaciones: enums alineados con
 * Prisma, pesos de las cinco dimensiones, modalidad y ubicación, y máquinas de
 * estados. Los endpoints llegan en el PR de la API.
 */

const OFERTA_VALIDA = {
  titulo: "MID para la academia",
  rol: "MID",
  modalidad: "PRESENCIAL",
  pais: "CO",
  departamento: "ATLANTICO",
  descripcion: "Roster de academia con entrenamientos de lunes a viernes.",
} as const;

describe("enums de ofertas", () => {
  it.each([
    ["EstadoOferta", ESTADOS_OFERTA, EstadoOfertaPrisma],
    ["EstadoPostulacion", ESTADOS_POSTULACION, EstadoPostulacionPrisma],
    ["Modalidad", MODALIDADES, ModalidadPrisma],
    ["PosicionLol", POSICIONES_LOL, PosicionLolPrisma],
  ])("%s coincide con el enum de Prisma", (_nombre, deShared, dePrisma) => {
    expect([...deShared].sort()).toEqual(Object.values(dePrisma).sort());
  });
});

describe("pesosMatchingSchema", () => {
  it("acepta los pesos por defecto, que suman 1", () => {
    expect(pesosMatchingSchema.safeParse(PESOS_MATCHING).success).toBe(true);
  });

  it("admite el error de coma flotante de los deslizadores", () => {
    const pesos = {
      tecnica: 0.45,
      experiencia: 0.25,
      habilidadesBlandas: 0.1,
      geografica: 0.05,
      disponibilidad: 0.15,
    };
    expect(pesosMatchingSchema.safeParse(pesos).success).toBe(true);
  });

  it("admite anular una dimensión con peso 0", () => {
    const pesos = { ...PESOS_MATCHING, geografica: 0, disponibilidad: 0.3 };
    expect(pesosMatchingSchema.safeParse(pesos).success).toBe(true);
  });

  it.each([
    ["suman menos de 1", { ...PESOS_MATCHING, tecnica: 0.3 }],
    ["suman más de 1", { ...PESOS_MATCHING, tecnica: 0.4 }],
    ["llevan un peso negativo", { ...PESOS_MATCHING, tecnica: 0.55, geografica: -0.05 }],
    ["llevan un peso mayor que 1", { ...PESOS_MATCHING, tecnica: 1.2 }],
  ])("rechaza pesos que %s", (_caso, pesos) => {
    expect(pesosMatchingSchema.safeParse(pesos).success).toBe(false);
  });

  it("rechaza que falte una dimensión", () => {
    const { disponibilidad: _sinDisponibilidad, ...pesos } = PESOS_MATCHING;
    expect(pesosMatchingSchema.safeParse({ ...pesos, tecnica: 0.5 }).success).toBe(false);
  });
});

describe("crearOfertaSchema", () => {
  it("sin pesos aplica PESOS_MATCHING y crea en borrador", () => {
    const oferta = crearOfertaSchema.parse(OFERTA_VALIDA);
    expect(oferta.pesos).toEqual(PESOS_MATCHING);
    expect(oferta.estado).toBe("BORRADOR");
  });

  it("descarta el juego, la región y los años de experiencia, que ya no son parte del contrato", () => {
    const oferta = crearOfertaSchema.parse({
      ...OFERTA_VALIDA,
      juego: "VALORANT",
      experienciaMinAnios: 3,
      region: "LAN",
    });
    expect(oferta).not.toHaveProperty("juego");
    expect(oferta).not.toHaveProperty("experienciaMinAnios");
    expect(oferta).not.toHaveProperty("region");
  });

  it.each(["CUBIERTA", "CERRADA"])("no admite crear una oferta %s", (estado) => {
    expect(crearOfertaSchema.safeParse({ ...OFERTA_VALIDA, estado }).success).toBe(false);
  });

  it("rechaza una posición que no es de League of Legends", () => {
    expect(crearOfertaSchema.safeParse({ ...OFERTA_VALIDA, rol: "DUELISTA" }).success).toBe(false);
  });

  it("rechaza pesos que no suman 1", () => {
    const resultado = crearOfertaSchema.safeParse({
      ...OFERTA_VALIDA,
      pesos: { ...PESOS_MATCHING, tecnica: 0.5 },
    });
    expect(resultado.success).toBe(false);
  });
});

describe("modalidad y ubicación de la oferta", () => {
  it.each([
    ["presencial en Colombia", { modalidad: "PRESENCIAL", pais: "CO", departamento: "BOLIVAR" }],
    ["híbrida fuera de Colombia", { modalidad: "HIBRIDA", pais: "MX" }],
    ["remota sin ubicación", { modalidad: "REMOTA" }],
    ["remota con ubicación nula", { modalidad: "REMOTA", pais: null, departamento: null }],
  ])("acepta una oferta %s", (_caso, ubicacion) => {
    expect(ubicacionOfertaSchema.safeParse(ubicacion).success).toBe(true);
  });

  it.each([
    ["remota con país", { modalidad: "REMOTA", pais: "CO", departamento: "ATLANTICO" }, "pais"],
    ["presencial sin país", { modalidad: "PRESENCIAL" }, "pais"],
    ["híbrida en Colombia sin departamento", { modalidad: "HIBRIDA", pais: "CO" }, "departamento"],
    [
      "presencial con departamento fuera de Colombia",
      { modalidad: "PRESENCIAL", pais: "MX", departamento: "ATLANTICO" },
      "departamento",
    ],
  ])("rechaza una oferta %s", (_caso, ubicacion, campo) => {
    const resultado = ubicacionOfertaSchema.safeParse(ubicacion);
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues.map((i) => i.path[0])).toContain(campo);
  });

  it("crearOfertaSchema aplica la misma regla", () => {
    const remotaConPais = { ...OFERTA_VALIDA, modalidad: "REMOTA" };
    expect(crearOfertaSchema.safeParse(remotaConPais).success).toBe(false);
  });
});

describe("actualizarOfertaSchema", () => {
  it("es parcial y no admite cambiar el estado (va por /estado)", () => {
    const cambios = actualizarOfertaSchema.parse({ titulo: "Nuevo título", estado: "CERRADA" });
    expect(cambios).toEqual({ titulo: "Nuevo título" });
  });

  it("exige los cinco pesos y que sumen 1 si se cambian", () => {
    expect(actualizarOfertaSchema.safeParse({ pesos: { tecnica: 1 } }).success).toBe(false);
    expect(actualizarOfertaSchema.safeParse({ pesos: PESOS_MATCHING }).success).toBe(true);
  });
});

describe("listarOfertasQuerySchema", () => {
  it("filtra por rol, departamento y modalidad del catálogo", () => {
    const query = { rol: "ADC", departamento: "ATLANTICO", modalidad: "REMOTA" };
    expect(listarOfertasQuerySchema.parse(query)).toEqual(query);
    expect(listarOfertasQuerySchema.safeParse({ rol: "AWPER" }).success).toBe(false);
  });
});

describe("máquinas de estados", () => {
  it("la oferta no se reabre: CUBIERTA y CERRADA son finales", () => {
    expect(TRANSICIONES_OFERTA.CUBIERTA).toEqual([]);
    expect(TRANSICIONES_OFERTA.CERRADA).toEqual([]);
    expect(TRANSICIONES_OFERTA.BORRADOR).not.toContain("CUBIERTA");
  });

  it("la postulación avanza de un paso en uno y se rechaza desde cualquier estado no final", () => {
    const embudo = ["ENVIADA", "EN_REVISION", "ENTREVISTA", "ACEPTADA"] as const;
    for (const [indice, estado] of embudo.slice(0, -1).entries()) {
      expect([...TRANSICIONES_POSTULACION[estado]].sort()).toEqual(
        [embudo[indice + 1], "RECHAZADA"].sort(),
      );
    }
    expect(TRANSICIONES_POSTULACION.ACEPTADA).toEqual([]);
    expect(TRANSICIONES_POSTULACION.RECHAZADA).toEqual([]);
  });

  it("cada estado de la postulación tiene su columna de fecha en Prisma, sin repetir", () => {
    const columnas = Object.values(FECHA_POR_ESTADO_POSTULACION);
    expect(new Set(columnas).size).toBe(ESTADOS_POSTULACION.length);
    for (const columna of columnas) {
      expect(Object.values(Prisma.PostulacionScalarFieldEnum)).toContain(columna);
    }
  });
});
