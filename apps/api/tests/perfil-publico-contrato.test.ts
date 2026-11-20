import {
  CAMPOS_PERFIL_JUGADOR_PUBLICO,
  CAMPOS_RESUMEN_VERIFICADO_PUBLICO,
  perfilJugadorPublicoSchema,
} from "@proplay/shared";
import { describe, expect, it } from "vitest";

/**
 * RF-05 · Contrato del perfil público del jugador: lista blanca de campos.
 * El endpoint lo prueba perfil-publico.test.ts; aquí se fija qué puede
 * salir y que cualquier otra clave se descarta.
 */
describe("perfilJugadorPublicoSchema", () => {
  it("es exactamente la lista blanca acordada", () => {
    expect([...CAMPOS_PERFIL_JUGADOR_PUBLICO].sort()).toEqual(
      [
        "avatarUrl",
        "bio",
        "cuentasVerificadas",
        "departamento",
        "id",
        "nombre",
        "pais",
        "resumenVerificado",
      ].sort(),
    );
  });

  it("el resumen verificado sólo añade posición, rango, partidas, métricas principales y fecha", () => {
    expect([...CAMPOS_RESUMEN_VERIFICADO_PUBLICO].sort()).toEqual(
      [
        "capturadaEn",
        "csPorMinuto",
        "danoPorMinuto",
        "kda",
        "partidasAnalizadas",
        "participacionKills",
        "posicionPrincipal",
        "rango",
        "visionPorMinuto",
        "winRate",
      ].sort(),
    );
  });

  it("descarta los datos de la cuenta y los que el matching usa en privado", () => {
    const resultado = perfilJugadorPublicoSchema.parse({
      id: "perfil-1",
      nombre: "Jugador de Prueba",
      bio: null,
      pais: "CO",
      departamento: "ATLANTICO",
      avatarUrl: null,
      cuentasVerificadas: [
        {
          plataforma: "RIOT",
          verificadaEn: "2026-10-01T00:00:00Z",
          externalId: "puuid-secreto",
          accessToken: "cifrado",
        },
      ],
      resumenVerificado: {
        posicionPrincipal: "ADC",
        rango: "ORO_I",
        partidasAnalizadas: 20,
        winRate: 0.5,
        kda: 3,
        csPorMinuto: 7,
        danoPorMinuto: 600,
        visionPorMinuto: 1.2,
        participacionKills: 0.5,
        capturadaEn: "2026-10-01T00:00:00Z",
        servidor: "la1",
        campeonesMasJugados: [{ campeon: "Jinx" }],
        riotId: "Jugador#LAN",
      },
      email: "jugador@proplay.gg",
      usuarioId: "cuenta-1",
      avisoPrivacidadAceptadoEn: "2026-09-10T00:00:00Z",
      disponibilidadHoras: 20,
      dispuestoRelocalizar: true,
      fechaNacimiento: "2000-01-01",
    });

    expect(Object.keys(resultado).sort()).toEqual(
      [...CAMPOS_PERFIL_JUGADOR_PUBLICO].sort(),
    );
    expect(Object.keys(resultado.cuentasVerificadas[0]!).sort()).toEqual([
      "plataforma",
      "verificadaEn",
    ]);
    expect(Object.keys(resultado.resumenVerificado!).sort()).toEqual(
      [...CAMPOS_RESUMEN_VERIFICADO_PUBLICO].sort(),
    );
  });

  it("no admite una ubicación fuera del catálogo", () => {
    const resultado = perfilJugadorPublicoSchema.safeParse({
      id: "perfil-1",
      nombre: "Jugador de Prueba",
      bio: null,
      pais: "CO",
      departamento: "BARRANQUILLA",
      avatarUrl: null,
      cuentasVerificadas: [],
      resumenVerificado: null,
    });
    expect(resultado.success).toBe(false);
  });
});
