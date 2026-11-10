import { DelayedError, Queue, Worker, type Job } from "bullmq";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { estadoClaveRiot } from "../integrations";
import type { EstadoClaveRiotRedis } from "../integrations/riot/estadoClave";
import * as estadisticas from "../modules/estadisticas/estadisticas.service";
import * as matching from "../modules/matching/matching.service";
import { CuotaRiotAgotadaError, IntegracionRiotNoDisponibleError } from "../utils/errors";
import {
  ColaIngesta,
  NOMBRE_COLA_INGESTA,
  PREFIJO_COLA_INGESTA,
  colaIngesta,
  conexionBullmq,
  type DatosSincronizacion,
  type OrigenSincronizacion,
} from "./cola";

/**
 * Worker de ingesta de Riot (tarea 2.5) y su planificador.
 *
 * Corre en el proceso de la API (`INGESTA_ACTIVA=true`, por defecto), así que
 * `npm run dev` y el contenedor desplegado lo levantan sin nada más. Con
 * varias instancias de la API, BullMQ reparte los trabajos por Redis y el
 * planificador es único; también puede correr aparte con `src/ingesta/main.ts`.
 *
 * - `planificar`, cada 15 minutos: encola a los verificados cuya última
 *   sincronización tiene más de `INGESTA_INTERVALO_HORAS`.
 * - `sincronizar`: un jugador. Concurrencia 1: la cuota de Riot es el cuello
 *   de botella, no la CPU.
 * - Sin cupo en la cuota → se reprograma para cuando lo haya, sin gastar
 *   reintentos. Clave caducada o ausente → la cola se pausa y el trabajo
 *   espera; al arrancar con una clave nueva, se reanuda.
 */

const CADA_PLANIFICACION_MS = 15 * 60_000;
/** Mientras la clave no vale, el trabajo vuelve a mirar cada tanto (la cola está en pausa). */
const ESPERA_CLAVE_MS = 5 * 60_000;
/** Margen mínimo al reprogramar por cupo, para no reintentar en bucle. */
const ESPERA_MINIMA_CUPO_MS = 5_000;

export interface DependenciasIngesta {
  sincronizar: (jugadorId: string, origen: OrigenSincronizacion) => Promise<estadisticas.ResultadoSincronizarCuenta>;
  pendientes: () => Promise<string[]>;
  clave: Pick<EstadoClaveRiotRedis, "estado" | "revisarAlArrancar" | "alInvalidar">;
  apiKey: string | undefined;
}

/**
 * RF-03 · RF-09 · Sincroniza y, si llegó una captura nueva, recalcula el
 * vector del jugador para el motor de matching. Un fallo del vector no
 * invalida la sincronización: el motor lo recalcula al pedir el siguiente
 * ranking (lo detecta como obsoleto).
 */
async function sincronizarYVectorizar(
  jugadorId: string,
  origen: OrigenSincronizacion,
): Promise<estadisticas.ResultadoSincronizarCuenta> {
  const resultado = await estadisticas.sincronizarCuenta(jugadorId, origen);
  if (resultado === "NUEVAS") {
    await matching.revectorizarJugador(jugadorId).catch((error: unknown) => {
      logger.warn({ err: error, jugadorId }, "no se pudo recalcular el vector tras la ingesta");
    });
  }
  return resultado;
}

const dependenciasReales = (): DependenciasIngesta => ({
  sincronizar: sincronizarYVectorizar,
  pendientes: estadisticas.jugadoresPendientesDeSincronizar,
  clave: estadoClaveRiot,
  apiKey: env.RIOT_API_KEY,
});

/** Aparta el trabajo hasta `ms` más tarde sin contarlo como intento fallido. */
async function reprogramar(
  trabajo: Job<DatosSincronizacion>,
  token: string | undefined,
  ms: number,
): Promise<never> {
  await trabajo.moveToDelayed(Date.now() + ms, token);
  throw new DelayedError();
}

/** Procesa un trabajo de la cola. Exportado para probarlo con trabajos reales. */
export async function procesarTrabajo(
  trabajo: Job<DatosSincronizacion>,
  token: string | undefined,
  ingesta: ColaIngesta,
  deps: DependenciasIngesta,
): Promise<string> {
  if (trabajo.name === "planificar") {
    const jugadores = await deps.pendientes();
    for (const jugadorId of jugadores) await ingesta.encolar(jugadorId, "PERIODICA");
    if (jugadores.length > 0) logger.info({ jugadores: jugadores.length }, "Ingesta periódica encolada");
    return `encolados:${jugadores.length}`;
  }

  const { jugadorId, origen } = trabajo.data;
  if ((await deps.clave.estado(deps.apiKey)) !== "ok") {
    await ingesta.cola.pause();
    return reprogramar(trabajo, token, ESPERA_CLAVE_MS);
  }

  try {
    const resultado = await deps.sincronizar(jugadorId, origen);
    if (resultado !== "OMITIDA") await ingesta.guardarResultado(jugadorId, resultado);
    return resultado;
  } catch (error) {
    if (error instanceof CuotaRiotAgotadaError) {
      // Mucha demanda: vuelve cuando haya hueco, sin gastar reintentos.
      await trabajo.updateData({ ...trabajo.data, muchaDemanda: true });
      return reprogramar(trabajo, token, Math.max(error.esperaMs, ESPERA_MINIMA_CUPO_MS));
    }
    if (error instanceof IntegracionRiotNoDisponibleError) {
      // La clave ya quedó marcada (y la cola en pausa); el trabajo espera a la nueva.
      await ingesta.cola.pause();
      return reprogramar(trabajo, token, ESPERA_CLAVE_MS);
    }
    const ultimoIntento = trabajo.attemptsMade + 1 >= (trabajo.opts.attempts ?? 1);
    if (ultimoIntento) await ingesta.guardarResultado(jugadorId, "FALLIDA");
    logger.warn({ jugadorId, intento: trabajo.attemptsMade + 1, error }, "Sincronización fallida");
    throw error;
  }
}

export interface Ingesta {
  cola: ColaIngesta;
  worker: Worker<DatosSincronizacion>;
  detener(): Promise<void>;
}

export interface OpcionesIngesta {
  /** Cola propia (pruebas); por defecto, la de la aplicación. */
  cola?: ColaIngesta;
  deps?: Partial<DependenciasIngesta>;
  /** Sin planificador (pruebas). */
  planificar?: boolean;
}

/**
 * Arranca el worker y el planificador. Mira primero la clave: con una que
 * Riot ya rechazó, o sin clave, la cola queda en pausa; con una distinta de la
 * rechazada (se renovó), se reanuda sola.
 */
export async function arrancarIngesta(opciones: OpcionesIngesta = {}): Promise<Ingesta> {
  const deps = { ...dependenciasReales(), ...opciones.deps };
  const ingesta = opciones.cola ?? colaIngesta();
  const cola: Queue<DatosSincronizacion> = ingesta.cola;

  const estadoClave = await deps.clave.revisarAlArrancar(deps.apiKey);
  if (estadoClave === "ok") {
    await cola.resume();
  } else {
    await cola.pause();
    logger.warn(
      { estadoClave },
      estadoClave === "sin-clave"
        ? "Ingesta de Riot en pausa: falta RIOT_API_KEY"
        : "Ingesta de Riot en pausa: Riot rechazó RIOT_API_KEY; renuévala y reinicia (docs/operacion.md)",
    );
  }
  const dejarDeEscuchar = deps.clave.alInvalidar(async () => {
    await cola.pause();
  });

  const worker = new Worker<DatosSincronizacion>(
    cola.name,
    (trabajo, token) => procesarTrabajo(trabajo, token, ingesta, deps),
    { connection: conexionBullmq(), prefix: cola.opts.prefix, concurrency: 1 },
  );
  worker.on("error", (error) => logger.error({ error }, "Error del worker de ingesta"));

  if (opciones.planificar ?? true) {
    await cola.upsertJobScheduler(
      "planificador-ingesta",
      { every: CADA_PLANIFICACION_MS },
      { name: "planificar", data: { jugadorId: "", origen: "PERIODICA" } },
    );
  }

  logger.info(
    { intervaloHoras: env.INGESTA_INTERVALO_HORAS, pausada: estadoClave !== "ok" },
    "Ingesta de Riot arrancada",
  );

  return {
    cola: ingesta,
    worker,
    async detener() {
      dejarDeEscuchar();
      await worker.close();
    },
  };
}

export { NOMBRE_COLA_INGESTA, PREFIJO_COLA_INGESTA };
