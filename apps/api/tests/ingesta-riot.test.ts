import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { Queue, type Job } from "bullmq";
import { API_PREFIX, estadoSincronizacionSchema } from "@proplay/shared";
import { prisma } from "../src/config/prisma";
import { clienteRedis } from "../src/config/redis";
import {
  ColaIngesta,
  conexionBullmq,
  idTrabajoSincronizacion,
  PRIORIDAD_SINCRONIZACION,
  type DatosSincronizacion,
} from "../src/ingesta/cola";
import { arrancarIngesta, type DependenciasIngesta, type Ingesta } from "../src/ingesta/ingesta";
import { estadoClaveRiot, obtenerProveedor, obtenerProveedorRiot } from "../src/integrations";
import { CuotaRiotRedis } from "../src/integrations/riot/cuotaRiot";
import { EstadoClaveRiotRedis } from "../src/integrations/riot/estadoClave";
import type { EstadisticasExternas } from "../src/integrations/GameStatsProvider";
import { sincronizarCuenta } from "../src/modules/estadisticas/estadisticas.service";
import { CuotaRiotAgotadaError, IntegracionRiotNoDisponibleError } from "../src/utils/errors";
import {
  CONSENTIMIENTO,
  app,
  cerrarConexiones,
  emailDePrueba,
  limpiarUsuariosDePrueba,
} from "./utils/entorno";

/**
 * RF-03 · Tarea 2.5: cuota global de Riot en Redis con prioridad, cola de
 * ingesta (BullMQ) con reprogramación, pausa por clave caducada y su
 * reanudación, capturas que nunca se sobrescriben y sin trabajos duplicados.
 * Riot se simula; Redis y Postgres son los reales, con claves propias.
 */

const espera = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

/** Espera a que se cumpla la condición (los workers son asíncronos). */
async function hasta(condicion: () => Promise<boolean>, ms = 10_000): Promise<void> {
  const limite = Date.now() + ms;
  while (!(await condicion())) {
    if (Date.now() > limite) throw new Error("La condición no se cumplió a tiempo");
    await espera(50);
  }
}

async function registrar(etiqueta: string) {
  const registro = await request(app)
    .post(`${API_PREFIX}/auth/register`)
    .send({
      email: emailDePrueba(etiqueta),
      password: "ProPlay123",
      nombre: "Jugador Ingesta",
      rol: "JUGADOR",
      ...CONSENTIMIENTO,
    });
  expect(registro.status).toBe(201);
  const token = registro.body.accessToken as string;
  const me = await request(app).get(`${API_PREFIX}/perfiles/me`).set("Authorization", `Bearer ${token}`);
  return { token, perfilId: me.body.perfil?.id as string };
}

/** Cola propia de cada prueba: no toca la de la aplicación ni la de otras pruebas. */
function colaDePrueba(): ColaIngesta {
  const nombre = `ingesta-prueba-${randomUUID()}`;
  return new ColaIngesta(
    new Queue<DatosSincronizacion>(nombre, { connection: conexionBullmq(), prefix: "proplay-test" }),
    "proplay-test",
  );
}

const colasAbiertas: ColaIngesta[] = [];
const ingestasAbiertas: Ingesta[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  for (const ingesta of ingestasAbiertas.splice(0)) await ingesta.detener();
  for (const cola of colasAbiertas.splice(0)) {
    await cola.cola.obliterate({ force: true });
    await cola.cerrar();
  }
});

beforeAll(async () => {
  await limpiarUsuariosDePrueba();
});

afterAll(async () => {
  await limpiarUsuariosDePrueba();
  await cerrarConexiones();
});

describe("cuota global de Riot en Redis", () => {
  function cuota(ventanas = [{ limite: 10, ms: 60_000 }], reserva = 30) {
    return new CuotaRiotRedis(clienteRedis, ventanas, reserva, `proplay-test:cuota:${randomUUID()}`);
  }

  it("agotada para las sincronizaciones, la prioridad alta (vincular, comprobar) aún pasa", async () => {
    const compartida = cuota();
    for (let i = 0; i < 7; i++) expect(await compartida.reservar("BAJA")).toBe(0);
    expect(await compartida.reservar("BAJA")).toBeGreaterThan(0);
    for (let i = 0; i < 3; i++) expect(await compartida.reservar("ALTA")).toBe(0);
    // Agotada del todo: tampoco la alta.
    expect(await compartida.reservar("ALTA")).toBeGreaterThan(0);
  });

  it("varios procesos a la vez nunca pasan del límite (reserva atómica)", async () => {
    const compartida = cuota([{ limite: 20, ms: 1_000 }], 0);
    const resultados = await Promise.all(Array.from({ length: 40 }, () => compartida.reservar("ALTA")));
    expect(resultados.filter((r) => r === 0)).toHaveLength(20);
  });

  it("un bloqueo por Retry-After detiene a todos hasta que pasa", async () => {
    const compartida = cuota();
    await compartida.bloquear(300);
    expect(await compartida.reservar("ALTA")).toBeGreaterThan(0);
    await espera(350);
    expect(await compartida.reservar("ALTA")).toBe(0);
  });
});

describe("estado de la clave de Riot", () => {
  it("marca la clave rechazada por su huella, avisa una vez y se retira al renovarla", async () => {
    const estado = new EstadoClaveRiotRedis(clienteRedis, `proplay-test:clave:${randomUUID()}`);
    const avisos = vi.fn();
    estado.alInvalidar(avisos);

    expect(await estado.estado(undefined)).toBe("sin-clave");
    expect(await estado.estado("RGAPI-vieja")).toBe("ok");
    await estado.marcarInvalida("RGAPI-vieja", 403);
    await estado.marcarInvalida("RGAPI-vieja", 403);
    expect(avisos).toHaveBeenCalledTimes(1);
    expect(await estado.estado("RGAPI-vieja")).toBe("clave-caducada");

    // Reiniciar con la misma clave no la rehabilita; con otra, sí.
    expect(await estado.revisarAlArrancar("RGAPI-vieja")).toBe("clave-caducada");
    expect(await estado.revisarAlArrancar("RGAPI-nueva")).toBe("ok");
    expect(await estado.estado("RGAPI-vieja")).toBe("ok");
  });
});

describe("cola de ingesta", () => {
  function nuevaCola() {
    const cola = colaDePrueba();
    colasAbiertas.push(cola);
    return cola;
  }

  function dependencias(cambios: Partial<DependenciasIngesta> = {}): DependenciasIngesta {
    return {
      sincronizar: vi.fn(async () => "NUEVAS" as const),
      pendientes: async () => [],
      clave: new EstadoClaveRiotRedis(clienteRedis, `proplay-test:clave:${randomUUID()}`),
      apiKey: "RGAPI-prueba",
      ...cambios,
    };
  }

  async function arrancar(cola: ColaIngesta, deps: DependenciasIngesta) {
    const ingesta = await arrancarIngesta({ cola, deps, planificar: false });
    ingestasAbiertas.push(ingesta);
    return ingesta;
  }

  it("no duplica al jugador: el id real es sincronizar-<jugadorId> y la manual sube la prioridad", async () => {
    const cola = nuevaCola();
    await cola.cola.pause();
    await cola.encolar("jugador-1", "PERIODICA");
    await cola.encolar("jugador-1", "PERIODICA");
    await cola.encolar("jugador-1", "MANUAL");

    const trabajos = await cola.cola.getJobs(["waiting", "prioritized"]);
    expect(trabajos).toHaveLength(1);
    expect(trabajos[0]?.id).toBe("sincronizar-jugador-1");
    expect(idTrabajoSincronizacion("jugador-1")).toBe("sincronizar-jugador-1");
    const trabajo = await cola.cola.getJob("sincronizar-jugador-1");
    expect(trabajo?.priority).toBe(PRIORIDAD_SINCRONIZACION.MANUAL);
  });

  it("la sincronización manual se procesa antes que las periódicas", async () => {
    const cola = nuevaCola();
    await cola.cola.pause();
    for (const id of ["p1", "p2", "p3"]) await cola.encolar(id, "PERIODICA");
    await cola.encolar("manual", "MANUAL");

    const orden: string[] = [];
    await arrancar(
      cola,
      dependencias({
        sincronizar: async (jugadorId) => {
          orden.push(jugadorId);
          return "SIN_CAMBIOS";
        },
      }),
    );
    await hasta(async () => orden.length === 4);
    expect(orden[0]).toBe("manual");
  });

  it("el planificador encola a los pendientes sin duplicar", async () => {
    const cola = nuevaCola();
    const sincronizados: string[] = [];
    await arrancar(
      cola,
      dependencias({
        pendientes: async () => ["a", "b", "a"],
        sincronizar: async (jugadorId) => {
          sincronizados.push(jugadorId);
          return "SIN_CAMBIOS";
        },
      }),
    );
    await cola.cola.add("planificar", { jugadorId: "", origen: "PERIODICA" });
    await hasta(async () => sincronizados.length >= 2);
    await espera(200);
    expect(sincronizados.sort()).toEqual(["a", "b"]);
  });

  it("sin cupo, la sincronización se reprograma sin gastar reintentos y se hace al volver el cupo", async () => {
    const cola = nuevaCola();
    let intentos = 0;
    await arrancar(
      cola,
      dependencias({
        sincronizar: async () => {
          intentos += 1;
          if (intentos === 1) throw new CuotaRiotAgotadaError(60_000);
          return "NUEVAS";
        },
      }),
    );
    await cola.encolar("jugador-cupo", "PERIODICA");

    let trabajo: Job<DatosSincronizacion> | undefined;
    await hasta(async () => {
      trabajo = await cola.cola.getJob("sincronizar-jugador-cupo");
      return (await trabajo?.getState()) === "delayed";
    });
    expect(trabajo?.attemptsMade).toBe(0);
    const estado = await cola.estado("jugador-cupo", null);
    expect(estado).toMatchObject({ estado: "EN_COLA", muchaDemanda: true });

    // Vuelve el cupo (no esperamos el minuto: se adelanta el trabajo).
    await trabajo?.promote();
    await hasta(async () => (await cola.estado("jugador-cupo", null)).estado === "INACTIVA");
    expect(intentos).toBe(2);
    expect((await cola.estado("jugador-cupo", null)).ultimoResultado?.tipo).toBe("NUEVAS");
  });

  it("con la clave caducada la cola se pausa sin gastar reintentos y se reanuda al arrancar con otra", async () => {
    const cola = nuevaCola();
    const clave = new EstadoClaveRiotRedis(clienteRedis, `proplay-test:clave:${randomUUID()}`);
    let claveVigente = "RGAPI-vieja";
    const sincronizar = vi.fn(async () => {
      if (claveVigente === "RGAPI-vieja") {
        // Lo que hace el cliente al recibir un 403.
        await clave.marcarInvalida("RGAPI-vieja", 403);
        throw new IntegracionRiotNoDisponibleError();
      }
      return "NUEVAS" as const;
    });

    const primera = await arrancar(cola, dependencias({ clave, sincronizar, apiKey: "RGAPI-vieja" }));
    await cola.encolar("jugador-clave", "MANUAL");
    await hasta(async () => cola.cola.isPaused());
    const trabajo = await cola.cola.getJob("sincronizar-jugador-clave");
    await hasta(async () => (await trabajo?.getState()) === "delayed");
    expect(trabajo?.attemptsMade).toBe(0);

    // Reiniciar con la misma clave: sigue en pausa.
    await primera.detener();
    await arrancar(cola, dependencias({ clave, sincronizar, apiKey: "RGAPI-vieja" }));
    expect(await cola.cola.isPaused()).toBe(true);

    // Clave nueva y reinicio: se reanuda sola y el trabajo pendiente se hace.
    for (const ingesta of ingestasAbiertas.splice(0)) await ingesta.detener();
    claveVigente = "RGAPI-nueva";
    await arrancar(cola, dependencias({ clave, sincronizar, apiKey: "RGAPI-nueva" }));
    expect(await cola.cola.isPaused()).toBe(false);
    await (await cola.cola.getJob("sincronizar-jugador-clave"))?.promote();
    await hasta(async () => (await cola.estado("jugador-clave", null)).ultimoResultado?.tipo === "NUEVAS");
    expect(sincronizar).toHaveBeenCalledTimes(2);
  });
});

describe("capturas de la sincronización", () => {
  const riot = obtenerProveedorRiot();

  function estadistica(ultimaPartidaId: string, liga: string, puntosLiga: number): EstadisticasExternas {
    return {
      juego: "League of Legends",
      rol: "MID",
      rango: liga === "GOLD" ? "ORO_II" : "PLATA_I",
      partidas: 20,
      victorias: 11,
      kda: 3.1,
      winRate: 0.55,
      metricas: {
        servidor: "LA1",
        rangoSoloDuo: { liga, division: liga === "GOLD" ? "II" : "I", puntosLiga, victorias: 50, derrotas: 40 },
        rangoFlex: null,
        ultimaPartidaId,
        ultimaPartidaEn: new Date("2026-11-08T20:00:00Z"),
      },
      capturadaEn: new Date(),
    };
  }

  async function jugadorConCuenta(etiqueta: string) {
    const jugador = await registrar(etiqueta);
    await prisma.cuentaGaming.create({
      data: {
        jugadorId: jugador.perfilId,
        plataforma: "RIOT",
        externalId: `puuid-${jugador.perfilId}`,
        servidor: "LA1",
        verificadaEn: new Date(),
      },
    });
    return jugador;
  }

  /** La espera de 10 minutos entre sincronizaciones no aplica entre pasos de la prueba. */
  const olvidarIntento = (jugadorId: string) =>
    prisma.cuentaGaming.updateMany({ where: { jugadorId }, data: { intentoSincronizacionEn: null } });

  const capturas = (jugadorId: string) =>
    prisma.estadistica.findMany({ where: { jugadorId }, orderBy: { capturadaEn: "asc" } });

  it("cada sincronización con partidas nuevas añade una captura sin tocar las anteriores", async () => {
    const { perfilId } = await jugadorConCuenta("captura-nueva");
    const obtener = vi.spyOn(obtenerProveedor("RIOT"), "obtenerEstadisticas");

    obtener.mockResolvedValueOnce([estadistica("LA1_1", "GOLD", 40)]);
    expect(await sincronizarCuenta(perfilId, "MANUAL")).toBe("NUEVAS");
    const [primera] = await capturas(perfilId);

    await olvidarIntento(perfilId);
    obtener.mockResolvedValueOnce([estadistica("LA1_2", "GOLD", 58)]);
    expect(await sincronizarCuenta(perfilId, "MANUAL")).toBe("NUEVAS");

    const todas = await capturas(perfilId);
    expect(todas).toHaveLength(2);
    expect(todas[0]).toEqual(primera);
  });

  it("sin partidas nuevas ni cambio de rango no hay fila nueva, y la periódica no descarga partidas", async () => {
    const { perfilId } = await jugadorConCuenta("captura-igual");
    vi.spyOn(obtenerProveedor("RIOT"), "obtenerEstadisticas").mockResolvedValueOnce([
      estadistica("LA1_1", "GOLD", 40),
    ]);
    await sincronizarCuenta(perfilId, "MANUAL");

    await olvidarIntento(perfilId);
    const completa = vi.spyOn(obtenerProveedor("RIOT"), "obtenerEstadisticas");
    vi.spyOn(riot, "novedades").mockResolvedValueOnce({
      partidasNuevas: false,
      rangos: {
        rango: "ORO_II",
        rangoSoloDuo: { liga: "GOLD", division: "II", puntosLiga: 40, victorias: 50, derrotas: 40 },
        rangoFlex: null,
      },
    });
    expect(await sincronizarCuenta(perfilId, "PERIODICA")).toBe("SIN_CAMBIOS");
    expect(completa).not.toHaveBeenCalled();
    expect(await capturas(perfilId)).toHaveLength(1);
  });

  it("sin partidas nuevas pero con otro rango (LP perdidos por inactividad) sí crea una fila", async () => {
    const { perfilId } = await jugadorConCuenta("captura-rango");
    vi.spyOn(obtenerProveedor("RIOT"), "obtenerEstadisticas").mockResolvedValueOnce([
      estadistica("LA1_1", "GOLD", 40),
    ]);
    await sincronizarCuenta(perfilId, "MANUAL");

    await olvidarIntento(perfilId);
    vi.spyOn(riot, "novedades").mockResolvedValueOnce({
      partidasNuevas: false,
      rangos: {
        rango: "PLATA_I",
        rangoSoloDuo: { liga: "SILVER", division: "I", puntosLiga: 75, victorias: 50, derrotas: 40 },
        rangoFlex: null,
      },
    });
    expect(await sincronizarCuenta(perfilId, "PERIODICA")).toBe("NUEVAS");

    const [anterior, nueva] = await capturas(perfilId);
    expect(nueva).toMatchObject({ rango: "PLATA_I", partidas: 20, victorias: 11 });
    expect((nueva?.metricas as Record<string, unknown>).rangoSoloDuo).toMatchObject({
      liga: "SILVER",
      puntosLiga: 75,
    });
    expect((nueva?.metricas as Record<string, unknown>).ultimaPartidaId).toBe("LA1_1");
    expect(anterior?.rango).toBe("ORO_II");
  });
});

describe("POST /estadisticas/sincronizar", () => {
  it("encola (202), no duplica si se pide dos veces y se consulta con GET /sincronizacion", async () => {
    vi.spyOn(estadoClaveRiot, "estado").mockResolvedValue("ok");
    const jugador = await registrar("sincronizar-cola");
    await prisma.cuentaGaming.create({
      data: {
        jugadorId: jugador.perfilId,
        plataforma: "RIOT",
        externalId: `puuid-${jugador.perfilId}`,
        servidor: "LA1",
        verificadaEn: new Date(),
      },
    });
    const auth = { Authorization: `Bearer ${jugador.token}` };

    const primera = await request(app).post(`${API_PREFIX}/estadisticas/sincronizar`).set(auth).send({});
    expect(primera.status).toBe(202);
    expect(estadoSincronizacionSchema.parse(primera.body).estado).toBe("EN_COLA");
    const segunda = await request(app).post(`${API_PREFIX}/estadisticas/sincronizar`).set(auth).send({});
    expect(segunda.status).toBe(202);

    const consulta = await request(app).get(`${API_PREFIX}/estadisticas/sincronizacion`).set(auth);
    expect(consulta.status).toBe(200);
    expect(consulta.body.estado).toBe("EN_COLA");

    const { colaIngesta } = await import("../src/ingesta/cola");
    const cola = colaIngesta();
    const trabajos = await cola.cola.getJobs(["waiting", "prioritized"]);
    expect(trabajos.filter((t) => t.data.jugadorId === jugador.perfilId)).toHaveLength(1);
    await cola.cola.obliterate({ force: true });
  });

  it("con la clave de Riot caducada responde «inténtalo más tarde» sin encolar", async () => {
    vi.spyOn(estadoClaveRiot, "estado").mockResolvedValue("clave-caducada");
    const jugador = await registrar("sincronizar-sin-clave");
    await prisma.cuentaGaming.create({
      data: {
        jugadorId: jugador.perfilId,
        plataforma: "RIOT",
        externalId: `puuid-${jugador.perfilId}`,
        servidor: "LA1",
        verificadaEn: new Date(),
      },
    });
    const respuesta = await request(app)
      .post(`${API_PREFIX}/estadisticas/sincronizar`)
      .set("Authorization", `Bearer ${jugador.token}`)
      .send({});
    expect(respuesta.status).toBe(503);
    expect(respuesta.body.error.code).toBe("RIOT_NO_DISPONIBLE");
    expect(respuesta.body.error.message).toMatch(/inténtalo más tarde/);
  });
});
