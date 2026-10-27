import { Departamento as DepartamentoPrisma } from "@prisma/client";
import {
  DEPARTAMENTOS,
  MACROREGION_POR_DEPARTAMENTO,
  PAISES,
  busquedaJugadoresSchema,
  perfilJugadorSchema,
  ubicacionJugadorSchema,
} from "@proplay/shared";
import { describe, expect, it } from "vitest";

/**
 * Ubicación geográfica del jugador: catálogo y reglas del contrato. Es el
 * insumo de la dimensión geográfica del matching (RF-09); el endpoint que la
 * guarda llega con el módulo `perfiles`.
 */
describe("catálogo de ubicación", () => {
  it("los departamentos de shared coinciden con el enum de Prisma", () => {
    expect([...DEPARTAMENTOS].sort()).toEqual(
      Object.values(DepartamentoPrisma).sort(),
    );
  });

  it("cada departamento tiene macrorregión y San Andrés cuenta como Caribe", () => {
    expect(Object.keys(MACROREGION_POR_DEPARTAMENTO).sort()).toEqual(
      [...DEPARTAMENTOS].sort(),
    );
    expect(MACROREGION_POR_DEPARTAMENTO.SAN_ANDRES).toBe("CARIBE");
  });

  it("los países son códigos ISO alfa-2 sin repetir", () => {
    expect(PAISES).toHaveLength(249);
    expect(new Set(PAISES).size).toBe(PAISES.length);
    expect(PAISES).toContain("CO");
  });
});

describe("ubicacionJugadorSchema", () => {
  it.each([
    ["Colombia con departamento", { pais: "CO", departamento: "ATLANTICO" }],
    ["otro país sin departamento", { pais: "MX" }],
    ["otro país con departamento nulo", { pais: "MX", departamento: null }],
    ["borrar la ubicación", { pais: null, departamento: null }],
    ["sólo la disposición a relocalizarse", { dispuestoRelocalizar: true }],
    ["sin ubicación", {}],
  ])("acepta %s", (_caso, datos) => {
    expect(ubicacionJugadorSchema.safeParse(datos).success).toBe(true);
  });

  it.each([
    ["Colombia sin departamento", { pais: "CO" }, "departamento"],
    ["Colombia con departamento nulo", { pais: "CO", departamento: null }, "departamento"],
    ["departamento fuera de Colombia", { pais: "MX", departamento: "ATLANTICO" }, "departamento"],
    ["departamento sin país", { departamento: "BOLIVAR" }, "pais"],
    ["país como texto libre", { pais: "Colombia" }, "pais"],
    ["país en minúsculas", { pais: "co", departamento: "BOLIVAR" }, "pais"],
    ["departamento fuera del catálogo", { pais: "CO", departamento: "BARRANQUILLA" }, "departamento"],
  ])("rechaza %s", (_caso, datos, campo) => {
    const resultado = ubicacionJugadorSchema.safeParse(datos);
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues.map((i) => i.path[0])).toContain(campo);
  });

  it("perfilJugadorSchema aplica la misma regla y ya no admite `region`", () => {
    expect(perfilJugadorSchema.safeParse({ pais: "CO" }).success).toBe(false);
    const resultado = perfilJugadorSchema.safeParse({
      bio: "Jungla de LoL",
      region: "LAN",
      pais: "CO",
      departamento: "MAGDALENA",
    });
    expect(resultado.success).toBe(true);
    expect(resultado.data).not.toHaveProperty("region");
  });
});

describe("filtro de ubicación del buscador de talento", () => {
  it("filtra por país y departamento del catálogo", () => {
    expect(
      busquedaJugadoresSchema.safeParse({ pais: "CO", departamento: "SUCRE" })
        .success,
    ).toBe(true);
    expect(busquedaJugadoresSchema.safeParse({ departamento: "Sucre" }).success).toBe(
      false,
    );
  });
});
