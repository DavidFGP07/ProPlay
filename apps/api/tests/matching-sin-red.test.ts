import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { JUEGO_PILOTO, PESOS_MATCHING, rankingOfertaSchema } from "@proplay/shared";
import { prisma } from "../src/config/prisma";
import * as servicio from "../src/modules/matching/matching.service";
import { cerrarConexiones, emailDePrueba, limpiarUsuariosDePrueba } from "./utils/entorno";

/**
 * RF-09 · El motor de matching sólo lee datos guardados: calcular y servir un
 * ranking no hace ninguna llamada de red (ni a Riot ni a nada), así que
 * funciona igual con la clave de desarrollo caducada. Se espían y se hacen
 * fallar `fetch`, `http`, `https`, `net` y `tls` mientras el motor trabaja; la
 * base de datos va por el motor nativo de Prisma, que no pasa por ellos.
 *
 * Todo se crea directamente en la base y se llama al servicio, sin supertest
 * (que abriría un socket local).
 */
let equipoUsuarioId: string;
let ofertaId: string;

beforeAll(async () => {
  await limpiarUsuariosDePrueba();
  const equipo = await prisma.usuario.create({
    data: {
      email: emailDePrueba("sin-red-equipo"),
      passwordHash: "sin-acceso",
      nombre: "Equipo sin red",
      rol: "EQUIPO",
      perfilEquipo: { create: { nombreOrg: "Equipo sin red" } },
    },
    include: { perfilEquipo: true },
  });
  equipoUsuarioId = equipo.id;
  ofertaId = (
    await prisma.oferta.create({
      data: {
        equipoId: equipo.perfilEquipo!.id,
        titulo: "Oferta sin red",
        juego: JUEGO_PILOTO,
        rol: "ADC",
        modalidad: "REMOTA",
        descripcion: "Prueba de que el motor no llama a la red.",
        estado: "ABIERTA",
        publicadaEn: new Date(),
        pesoTecnica: PESOS_MATCHING.tecnica,
        pesoExperiencia: PESOS_MATCHING.experiencia,
        pesoHabilidadesBlandas: PESOS_MATCHING.habilidadesBlandas,
        pesoGeografica: PESOS_MATCHING.geografica,
        pesoDisponibilidad: PESOS_MATCHING.disponibilidad,
      },
    })
  ).id;
  const jugador = await prisma.usuario.create({
    data: {
      email: emailDePrueba("sin-red-jugador"),
      passwordHash: "sin-acceso",
      nombre: "Jugador sin red",
      perfilJugador: { create: { pais: "CO", departamento: "VICHADA", disponibilidadHoras: 20 } },
    },
    include: { perfilJugador: true },
  });
  const cuenta = await prisma.cuentaGaming.create({
    data: {
      jugadorId: jugador.perfilJugador!.id,
      plataforma: "RIOT",
      externalId: `test-puuid-sin-red-${jugador.id}`,
      verificadaEn: new Date(),
    },
  });
  await prisma.estadistica.create({
    data: {
      jugadorId: jugador.perfilJugador!.id,
      cuentaId: cuenta.id,
      juego: JUEGO_PILOTO,
      rol: "ADC",
      rango: "PLATINO_I",
      partidas: 20,
      winRate: 0.55,
      kda: 3,
      fuente: "RIOT",
      metricas: { partidasAnalizadas: 20, distribucionRoles: { ADC: 20 } },
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await limpiarUsuariosDePrueba();
  await cerrarConexiones();
});

describe("el motor de matching no hace llamadas de red", () => {
  it("recalcular y leer el ranking no toca fetch, http, https, net ni tls", async () => {
    const red = () => {
      throw new Error("El motor de matching intentó una llamada de red");
    };
    const espias = [
      vi.spyOn(globalThis, "fetch").mockImplementation(red),
      vi.spyOn(http, "request").mockImplementation(red),
      vi.spyOn(http, "get").mockImplementation(red),
      vi.spyOn(https, "request").mockImplementation(red),
      vi.spyOn(https, "get").mockImplementation(red),
      vi.spyOn(net, "connect").mockImplementation(red),
      vi.spyOn(net, "createConnection").mockImplementation(red),
      vi.spyOn(net.Socket.prototype, "connect").mockImplementation(red),
      vi.spyOn(tls, "connect").mockImplementation(red),
    ];

    const actor = { id: equipoUsuarioId, rol: "EQUIPO" as const };
    const recalculado = await servicio.recalcular(ofertaId, actor, { page: 1, pageSize: 20 });
    const leido = await servicio.ranking(ofertaId, actor, { page: 1, pageSize: 20 });

    expect(rankingOfertaSchema.safeParse(recalculado).success).toBe(true);
    expect(leido.meta.total).toBeGreaterThan(0);
    for (const espia of espias) expect(espia).not.toHaveBeenCalled();
  });
});
