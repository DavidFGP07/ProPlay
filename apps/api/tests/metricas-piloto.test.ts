import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JUEGO_PILOTO, type EstadoOferta } from "@proplay/shared";
import { prisma } from "../src/config/prisma";
import {
  SALIDA,
  aCsv,
  ejecutar,
  filasResumen,
  leerArgumentos,
  type Consola,
} from "../src/cli/metricasPiloto";
import type { MetricasPiloto } from "../src/modules/analitica/analitica.service";
import {
  CORREOS_EQUIPOS_SEED,
  PREFIJO_PUUID_SEED,
  correoJugadorSeed,
  esCorreoSeed,
} from "../src/utils/datosDePrueba";
import { cerrarConexiones, emailDePrueba, limpiarUsuariosDePrueba } from "./utils/entorno";

/**
 * RF-13 · Script de las métricas del piloto (`npm run metricas:piloto -w api`):
 * argumentos, formato de los CSV y la exclusión de las cuentas del seed
 * (`--excluir-prueba`, activa por defecto).
 */
const utc = (iso: string) => new Date(iso);
const silenciosa: Consola = { log: () => {}, error: () => {} };

/** Lee un CSV sencillo (los de estas pruebas no llevan comas entre comillas). */
function filas(csv: string): string[][] {
  return csv.trim().split("\r\n").slice(1).map((l) => l.split(","));
}

describe("leerArgumentos", () => {
  it("por defecto excluye las cuentas de prueba y escribe en ./metricas-piloto", () => {
    expect(leerArgumentos([])).toEqual({ salida: "metricas-piloto", excluirPrueba: true });
  });

  it("admite las opciones con espacio o con =", () => {
    expect(leerArgumentos(["--desde", "2026-11-20", "--hasta=2026-12-20", "--salida=out"])).toEqual({
      salida: "out",
      excluirPrueba: true,
      desde: "2026-11-20",
      hasta: "2026-12-20",
    });
  });

  it("--no-excluir-prueba y --excluir-prueba=false incluyen las cuentas del seed", () => {
    expect(leerArgumentos(["--no-excluir-prueba"])).toMatchObject({ excluirPrueba: false });
    expect(leerArgumentos(["--excluir-prueba=false"])).toMatchObject({ excluirPrueba: false });
    expect(leerArgumentos(["--excluir-prueba"])).toMatchObject({ excluirPrueba: true });
  });

  it.each([
    [["--desde", "2026-02-30"]],
    [["--desde", "20-11-2026"]],
    [["--hasta"]],
    [["--desde", "2026-12-01", "--hasta", "2026-11-01"]],
    [["--excluir-prueba=quizas"]],
    [["--ventana", "7"]],
  ])("rechaza %j con un mensaje", (args) => {
    expect(typeof leerArgumentos(args)).toBe("string");
  });

  it("un argumento no válido sale con el código de uso, sin tocar la base", async () => {
    const errores: string[] = [];
    const codigo = await ejecutar(["--desde", "ayer"], { log: () => {}, error: (m) => errores.push(m) });
    expect(codigo).toBe(SALIDA.USO);
    expect(errores[0]).toContain("Uso: npm run metricas:piloto");
  });
});

describe("formato CSV", () => {
  it("usa coma, punto decimal, CRLF y comillas cuando hacen falta", () => {
    expect(aCsv(["a", "b", "c"], [["Caribe, eSports", 0.123456, null], ['dice "hola"', true, 3]])).toBe(
      'a,b,c\r\n"Caribe, eSports",0.1235,\r\n"dice ""hola""",true,3\r\n',
    );
  });

  it("el resumen de H1 marca la línea base como pendiente mientras no exista", () => {
    const m = {
      opciones: { excluirPrueba: true },
      generadoEn: utc("2026-12-21T12:00:00Z"),
      embudo: { postulaciones: 0, coincidenciasExitosas: 0, etapas: [{ etapa: "ACEPTADA", alcanzaron: 0 }] },
      diasHastaCubrir: { n: 2, mediana: 15, media: 15 },
      diasHastaPrimerTryout: { n: 0, mediana: null, media: null },
      cobertura: { abiertas: 0, cubiertas: 2, cerradasSinCubrir: 0, tasa: 1 },
      talento: { verificados: 0, proporcionVerificados: null, jugadoresRegistrados: 0 },
      registros: {},
    } as unknown as MetricasPiloto;
    const sin = Object.fromEntries(filasResumen(m, null).map((f) => [f[0], f]));
    expect(sin.linea_base_dias_hasta_cubrir_mediana![1]).toBe("pendiente");
    expect(sin.proplay_dias_hasta_cubrir_mediana!.slice(1, 3)).toEqual([15, 2]);

    const con = Object.fromEntries(
      filasResumen(m, {
        medidaEn: "2026-11-25",
        fuente: "docs/linea-base.md",
        equipos: 3,
        vacantes: 7,
        diasHastaCubrir: { mediana: 30, media: 34, n: 7 },
        diasHastaPrimerTryout: null,
      }).map((f) => [f[0], f]),
    );
    expect(con.linea_base_dias_hasta_cubrir_mediana!.slice(1, 3)).toEqual([30, 7]);
    expect(con.linea_base_dias_hasta_primer_tryout_mediana![1]).toBe("pendiente");
  });
});

describe("cuentas del seed", () => {
  it("reconoce los correos fijos y el patrón de los jugadores, y nada más", () => {
    expect(esCorreoSeed(CORREOS_EQUIPOS_SEED[0])).toBe(true);
    expect(esCorreoSeed("scout@proplay.gg")).toBe(true);
    expect(esCorreoSeed(correoJugadorSeed(21))).toBe(true);
    expect(esCorreoSeed("jugadora@proplay.gg")).toBe(false);
    expect(esCorreoSeed("jugador1@proplay.gg.co")).toBe(false);
    expect(esCorreoSeed("equipo@otro.gg")).toBe(false);
  });
});

// ---------------------------------------------------------------- integración

describe("ejecutar contra la base (con y sin --excluir-prueba)", () => {
  // Cuentas con correos o puuid del seed: no llevan el prefijo de las pruebas,
  // así que se borran a mano por id.
  const delSeed: string[] = [];
  let carpeta: string;

  async function equipo(email: string, nombre: string): Promise<string> {
    const usuario = await prisma.usuario.create({
      data: {
        email,
        passwordHash: "sin-acceso",
        nombre,
        rol: "EQUIPO",
        perfilEquipo: { create: { nombreOrg: nombre } },
      },
      include: { perfilEquipo: true },
    });
    return usuario.perfilEquipo!.id;
  }

  async function jugador(email: string, puuid: string): Promise<string> {
    const usuario = await prisma.usuario.create({
      data: {
        email,
        passwordHash: "sin-acceso",
        nombre: "Jugador del piloto",
        rol: "JUGADOR",
        perfilJugador: { create: { pais: "CO", departamento: "ATLANTICO", disponibilidadHoras: 20 } },
      },
      include: { perfilJugador: true },
    });
    const perfil = usuario.perfilJugador!;
    const cuenta = await prisma.cuentaGaming.create({
      data: { jugadorId: perfil.id, plataforma: "RIOT", externalId: puuid, verificadaEn: utc("2026-05-01T12:00:00Z") },
    });
    await prisma.estadistica.create({
      data: {
        jugadorId: perfil.id,
        cuentaId: cuenta.id,
        juego: JUEGO_PILOTO,
        rol: "MID",
        rango: "ORO_II",
        partidas: 20,
        victorias: 10,
        kda: 3,
        winRate: 0.5,
        fuente: "RIOT",
        metricas: { partidasAnalizadas: 20, distribucionRoles: { MID: 20 } },
        capturadaEn: utc("2026-05-02T12:00:00Z"),
      },
    });
    return perfil.id;
  }

  async function oferta(equipoId: string, titulo: string, publicadaEn: string, estado: EstadoOferta = "CUBIERTA") {
    return (
      await prisma.oferta.create({
        data: {
          equipoId,
          titulo,
          juego: JUEGO_PILOTO,
          rol: "MID",
          modalidad: "REMOTA",
          horasSemana: 20,
          descripcion: "Oferta de las pruebas del script del piloto.",
          pesoTecnica: 0.6,
          pesoExperiencia: 0,
          pesoHabilidadesBlandas: 0,
          pesoGeografica: 0,
          pesoDisponibilidad: 0.4,
          estado,
          publicadaEn: utc(publicadaEn),
          cerradaEn: estado === "CUBIERTA" ? utc("2026-06-20T15:00:00Z") : null,
        },
      })
    ).id;
  }

  async function aceptada(ofertaId: string, jugadorId: string, aceptadaEn: string) {
    await prisma.postulacion.create({
      data: {
        ofertaId,
        jugadorId,
        estado: "ACEPTADA",
        creadoEn: utc("2026-06-02T15:00:00Z"),
        revisadaEn: utc("2026-06-03T15:00:00Z"),
        entrevistaEn: utc("2026-06-05T15:00:00Z"),
        aceptadaEn: utc(aceptadaEn),
      },
    });
  }

  beforeAll(async () => {
    await limpiarUsuariosDePrueba();
    carpeta = await mkdtemp(join(tmpdir(), "metricas-piloto-"));

    const real = await equipo(emailDePrueba("piloto-equipo"), "Equipo real del piloto");
    const jugadorReal = await jugador(emailDePrueba("piloto-jugador"), "test-puuid-piloto-real");
    // Del seed: un jugador por su correo, otro por su puuid, y un equipo por su correo.
    const porCorreo = await jugador(correoJugadorSeed(9901), "test-puuid-piloto-correo");
    const porPuuid = await jugador(emailDePrueba("piloto-puuid"), `${PREFIJO_PUUID_SEED}piloto-9902`);
    const equipoSeed = await equipo(CORREOS_EQUIPOS_SEED[1], "Equipo del seed");
    for (const id of [porCorreo, equipoSeed]) {
      const perfil =
        (await prisma.perfilJugador.findUnique({ where: { id } })) ??
        (await prisma.perfilEquipo.findUniqueOrThrow({ where: { id } }));
      delSeed.push(perfil.usuarioId);
    }

    // Real, publicada el 1 de junio a las 15:00Z y aceptada a los 10 días.
    const ofertaReal = await oferta(real, "Oferta real", "2026-06-01T15:00:00Z");
    await aceptada(ofertaReal, jugadorReal, "2026-06-11T15:00:00Z");
    // Las postulaciones de los dos jugadores del seed a la oferta real.
    for (const j of [porCorreo, porPuuid]) {
      await prisma.postulacion.create({
        data: { ofertaId: ofertaReal, jugadorId: j, estado: "ENVIADA", creadoEn: utc("2026-06-04T15:00:00Z") },
      });
    }
    // Del equipo del seed: aceptada a los 30 días.
    const ofertaSeed = await oferta(equipoSeed, "Oferta del seed", "2026-06-01T15:00:00Z");
    await aceptada(ofertaSeed, jugadorReal, "2026-07-01T15:00:00Z");
    // Fuera de la ventana: a las 03:00Z del 1 de junio todavía es 31 de mayo en Colombia.
    await oferta(real, "Antes de la ventana", "2026-06-01T03:00:00Z", "ABIERTA");
  });

  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { id: { in: delSeed } } });
    await limpiarUsuariosDePrueba();
    await rm(carpeta, { recursive: true, force: true });
    await cerrarConexiones();
  });

  async function correr(...extra: string[]) {
    const salida = join(carpeta, extra.join("_") || "por-defecto");
    const codigo = await ejecutar(
      ["--desde", "2026-06-01", "--hasta", "2026-06-30", "--salida", salida, ...extra],
      silenciosa,
      utc("2026-12-01T12:00:00Z"),
    );
    expect(codigo).toBe(SALIDA.OK);
    const leer = async (archivo: string) => readFile(join(salida, archivo), "utf8");
    return {
      ofertas: filas(await leer("tiempo_hasta_cubrir.csv")),
      embudo: filas(await leer("embudo_por_oferta.csv")),
      resumen: Object.fromEntries(filas(await leer("resumen_h1.csv")).map((f) => [f[0], f])),
      talento: Object.fromEntries(
        filas(await leer("talento_verificado.csv"))
          .filter((f) => f[0] === "resumen")
          .map((f) => [f[2], f[3]]),
      ),
      archivos: await Promise.all(
        [
          "embudo_por_oferta.csv",
          "tiempos_por_etapa.csv",
          "tiempo_hasta_cubrir.csv",
          "dimension_decisiva.csv",
          "talento_verificado.csv",
          "resumen_h1.csv",
        ].map(leer),
      ),
    };
  }

  it("por defecto deja fuera el equipo y los jugadores del seed", async () => {
    const r = await correr();
    expect(r.archivos).toHaveLength(6);
    // Sólo la oferta real dentro de la ventana (la de las 03:00Z es del 31 de mayo en Colombia).
    expect(r.ofertas.map((f) => [f[2], f[5], f[8]])).toEqual([["Oferta real", "2026-06-01", "10"]]);
    // Su embudo sin las dos postulaciones del seed.
    const total = r.embudo.find((f) => f[0] === "TOTAL" && f[2] === "ENVIADA")!;
    expect(total[3]).toBe("1");
    expect(r.resumen.proplay_dias_hasta_cubrir_mediana!.slice(1, 3)).toEqual(["10", "1"]);
    expect(r.resumen.parametro_excluir_prueba![1]).toBe("true");
  });

  it("con --no-excluir-prueba las cuenta", async () => {
    const sin = await correr();
    const con = await correr("--no-excluir-prueba");
    expect(con.ofertas.map((f) => f[2]).sort()).toEqual(["Oferta del seed", "Oferta real"]);
    // 10 y 30 días: mediana 20 con n = 2.
    expect(con.resumen.proplay_dias_hasta_cubrir_mediana!.slice(1, 3)).toEqual(["20", "2"]);
    expect(con.embudo.find((f) => f[0] === "TOTAL" && f[2] === "ENVIADA")![3]).toBe("4");
    // Los dos jugadores del seed son verificados: aparecen sólo sin la exclusión.
    expect(Number(con.talento.verificados) - Number(sin.talento.verificados)).toBe(2);
    expect(Number(con.talento.registrados) - Number(sin.talento.registrados)).toBe(2);
  });
});
