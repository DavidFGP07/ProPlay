import { Queue, type ConnectionOptions, type JobsOptions } from "bullmq";
import type { EstadoSincronizacion, ResultadoSincronizacion } from "@proplay/shared";
import { env } from "../config/env";
import { clienteRedis } from "../config/redis";

/**
 * Cola de ingesta de estadísticas de Riot (BullMQ sobre el Redis de la app).
 *
 * Un trabajo `sincronizar` por jugador, con id `sincronizar-<jugadorId>`:
 * BullMQ no añade un trabajo cuyo id ya existe, así que el jugador nunca está
 * dos veces en la cola (el planificador y el botón «Sincronizar» a la vez).
 * BullMQ 6 no admite `:` en los ids propios, de ahí el guion.
 *
 * Este archivo es la parte que encola y consulta: la usa la API. El worker y
 * el planificador están en `ingesta.ts`.
 */

export const NOMBRE_COLA_INGESTA = "ingesta-riot";
/** Prefijo de las claves de BullMQ en Redis; las pruebas usan otro. */
export const PREFIJO_COLA_INGESTA = env.esTest ? "proplay-test" : "proplay";

export type OrigenSincronizacion = "MANUAL" | "PERIODICA";

export interface DatosSincronizacion {
  jugadorId: string;
  origen: OrigenSincronizacion;
  /** Se reprogramó por falta de cupo en la cuota de Riot. */
  muchaDemanda?: boolean;
}

/** Menor es antes: la que pide el jugador pasa delante de la periódica. */
export const PRIORIDAD_SINCRONIZACION: Record<OrigenSincronizacion, number> = {
  MANUAL: 1,
  PERIODICA: 10,
};

export const idTrabajoSincronizacion = (jugadorId: string) => `sincronizar-${jugadorId}`;

/** Reintentos de un fallo real (Riot 5xx, red). Falta de cupo y clave caducada no gastan. */
const OPCIONES_SINCRONIZACION: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 60_000 },
  // Sin rastro al terminar: si no, el id seguiría ocupado y no se podría volver a encolar.
  removeOnComplete: true,
  removeOnFail: true,
};

/**
 * Opciones de conexión (no una instancia: así BullMQ abre y cierra las suyas)
 * a partir de REDIS_URL. Exige `maxRetriesPerRequest: null` en las bloqueantes.
 */
export function conexionBullmq(): ConnectionOptions {
  const url = new URL(env.REDIS_URL);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0,
    tls: url.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

const claveResultado = (prefijo: string, cola: string, jugadorId: string) =>
  `${prefijo}:${cola}:resultado:${jugadorId}`;

export class ColaIngesta {
  constructor(
    readonly cola: Queue<DatosSincronizacion>,
    private readonly prefijo = PREFIJO_COLA_INGESTA,
  ) {}

  /** Encola la sincronización del jugador; si ya está en la cola, no añade otra. */
  async encolar(jugadorId: string, origen: OrigenSincronizacion): Promise<void> {
    const id = idTrabajoSincronizacion(jugadorId);
    await this.cola.add(
      "sincronizar",
      { jugadorId, origen },
      { ...OPCIONES_SINCRONIZACION, jobId: id, priority: PRIORIDAD_SINCRONIZACION[origen] },
    );
    if (origen !== "MANUAL") return;
    // Ya estaba como periódica y ahora la pide el jugador: que pase delante.
    // (`add` con un id existente no lo cambia; hay que leer el guardado.)
    const guardado = await this.cola.getJob(id);
    if (guardado && guardado.priority !== PRIORIDAD_SINCRONIZACION.MANUAL) {
      const estado = await guardado.getState();
      if (estado === "waiting" || estado === "prioritized") {
        await guardado.changePriority({ priority: PRIORIDAD_SINCRONIZACION.MANUAL });
      }
    }
  }

  /** En qué punto está la sincronización del jugador y cómo acabó la última. */
  async estado(
    jugadorId: string,
    sincronizadaEn: Date | null,
  ): Promise<EstadoSincronizacion> {
    const trabajo = await this.cola.getJob(idTrabajoSincronizacion(jugadorId));
    const estadoTrabajo = trabajo ? await trabajo.getState() : "unknown";
    const estado =
      estadoTrabajo === "active"
        ? "EN_CURSO"
        : ["waiting", "prioritized", "delayed", "waiting-children"].includes(estadoTrabajo)
          ? "EN_COLA"
          : "INACTIVA";
    return {
      estado,
      muchaDemanda: estado === "EN_COLA" && trabajo?.data.muchaDemanda === true,
      sincronizadaEn,
      ultimoResultado: await this.leerResultado(jugadorId),
    };
  }

  /** Cuántos trabajos hay en cada estado, para `npm run ingesta:estado`. */
  async contar() {
    const [trabajos, pausada] = await Promise.all([
      this.cola.getJobCounts("waiting", "prioritized", "active", "delayed", "failed"),
      this.cola.isPaused(),
    ]);
    const n = (estado: string) => trabajos[estado] ?? 0;
    return {
      enEspera: n("waiting") + n("prioritized"),
      enCurso: n("active"),
      reprogramados: n("delayed"),
      fallidos: n("failed"),
      pausada,
    };
  }

  async guardarResultado(jugadorId: string, tipo: ResultadoSincronizacion): Promise<void> {
    const redis = await clienteRedis();
    await redis.set(
      claveResultado(this.prefijo, this.cola.name, jugadorId),
      JSON.stringify({ tipo, en: new Date().toISOString() }),
      "EX",
      7 * 24 * 3600,
    );
  }

  private async leerResultado(
    jugadorId: string,
  ): Promise<EstadoSincronizacion["ultimoResultado"]> {
    const redis = await clienteRedis();
    const valor = await redis.get(claveResultado(this.prefijo, this.cola.name, jugadorId));
    if (!valor) return null;
    const { tipo, en } = JSON.parse(valor) as { tipo: ResultadoSincronizacion; en: string };
    return { tipo, en: new Date(en) };
  }

  async cerrar(): Promise<void> {
    await this.cola.close();
  }
}

let compartida: ColaIngesta | null = null;

/** La cola de la aplicación, creada al primer uso (la API encola aunque el worker corra en otro proceso). */
export function colaIngesta(): ColaIngesta {
  compartida ??= new ColaIngesta(
    new Queue<DatosSincronizacion>(NOMBRE_COLA_INGESTA, {
      connection: conexionBullmq(),
      prefix: PREFIJO_COLA_INGESTA,
    }),
  );
  return compartida;
}

export async function cerrarColaIngesta(): Promise<void> {
  if (!compartida) return;
  const cola = compartida;
  compartida = null;
  await cola.cerrar();
}
