import { randomUUID } from "node:crypto";
import type Redis from "ioredis";

/**
 * Cuota de la API de Riot, compartida por TODAS las llamadas de la aplicación
 * (vinculación, comprobación del icono y sincronización) y por todos sus
 * procesos: la clave de Riot limita a la aplicación entera, no a cada usuario
 * (docs/decisiones.md, «Cuota de Riot e ingesta»).
 *
 * - Ventanas deslizantes configurables (`RIOT_LIMITES`): con la clave de
 *   desarrollo, 20 cada segundo y 100 cada 2 minutos.
 * - Dos prioridades. `ALTA` (vincular y comprobar el icono, con alguien
 *   esperando delante de la pantalla) puede usar la ventana entera; `BAJA`
 *   (sincronizaciones, que pueden esperar) sólo hasta dejar libre la reserva
 *   `RIOT_RESERVA_ALTA` (30 % por defecto: 70 de cada 100 y 14 de cada 20).
 * - Bloqueo global: si Riot responde 429 por límite de aplicación, nadie
 *   vuelve a llamar hasta que pase su `Retry-After`.
 */

export type PrioridadRiot = "ALTA" | "BAJA";

export interface VentanaCuotaRiot {
  limite: number;
  ms: number;
}

export interface CuotaRiot {
  /**
   * Reserva una petición. Devuelve 0 si se concedió (y queda contada), o los
   * milisegundos que faltan para que haya hueco (y no cuenta nada).
   */
  reservar(prioridad: PrioridadRiot): Promise<number>;
  /** Nadie llama a Riot durante `ms` (un 429 de límite de aplicación). */
  bloquear(ms: number): Promise<void>;
}

/** Límite efectivo de una ventana para una prioridad. */
export function limiteEfectivo(limite: number, prioridad: PrioridadRiot, reservaAlta: number): number {
  if (prioridad === "ALTA") return limite;
  return Math.max(1, Math.floor((limite * (100 - reservaAlta)) / 100));
}

/**
 * KEYS[1] = bloqueo global (milisegundos epoch hasta los que no se llama).
 * KEYS[2..] = un conjunto ordenado por ventana, con la marca de cada petición.
 * ARGV = ahora, miembro único, y por ventana: límite efectivo, ms.
 * Devuelve 0 si concede (y anota en todas las ventanas) o la espera en ms.
 * Comprobar y anotar en un solo script evita que dos procesos pasen a la vez.
 */
const SCRIPT_RESERVAR = `
local ahora = tonumber(ARGV[1])
local hasta = tonumber(redis.call('GET', KEYS[1]) or '0')
if hasta > ahora then return hasta - ahora end
local espera = 0
for i = 2, #KEYS do
  local limite = tonumber(ARGV[2 * i - 1])
  local ms = tonumber(ARGV[2 * i])
  redis.call('ZREMRANGEBYSCORE', KEYS[i], '-inf', ahora - ms)
  local usadas = redis.call('ZCARD', KEYS[i])
  if usadas >= limite then
    local marca = redis.call('ZRANGE', KEYS[i], usadas - limite, usadas - limite, 'WITHSCORES')
    local libre = tonumber(marca[2]) + ms - ahora
    if libre > espera then espera = libre end
  end
end
if espera > 0 then return math.max(1, math.ceil(espera)) end
for i = 2, #KEYS do
  redis.call('ZADD', KEYS[i], ahora, ARGV[2])
  redis.call('PEXPIRE', KEYS[i], tonumber(ARGV[2 * i]))
end
return 0
`;

/** Sólo alarga un bloqueo, nunca lo acorta. */
const SCRIPT_BLOQUEAR = `
local actual = tonumber(redis.call('GET', KEYS[1]) or '0')
if tonumber(ARGV[1]) > actual then redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2]) end
return 1
`;

/** Prefijo de las claves en Redis; las pruebas usan el suyo. */
export const PREFIJO_CUOTA_RIOT = "proplay:riot:cuota";

export class CuotaRiotRedis implements CuotaRiot {
  constructor(
    private readonly redis: () => Promise<Redis>,
    private readonly ventanas: readonly VentanaCuotaRiot[],
    private readonly reservaAlta: number,
    private readonly prefijo = PREFIJO_CUOTA_RIOT,
    private readonly ahora: () => number = Date.now,
  ) {}

  async reservar(prioridad: PrioridadRiot): Promise<number> {
    const redis = await this.redis();
    const claves = [
      `${this.prefijo}:bloqueo`,
      // El ms va en la clave: cambiar los límites no mezcla ventanas distintas.
      ...this.ventanas.map((v) => `${this.prefijo}:ventana:${v.ms}`),
    ];
    const argumentos = [
      this.ahora(),
      randomUUID(),
      ...this.ventanas.flatMap((v) => [limiteEfectivo(v.limite, prioridad, this.reservaAlta), v.ms]),
    ];
    return Number(await redis.eval(SCRIPT_RESERVAR, claves.length, ...claves, ...argumentos));
  }

  async bloquear(ms: number): Promise<void> {
    const redis = await this.redis();
    await redis.eval(SCRIPT_BLOQUEAR, 1, `${this.prefijo}:bloqueo`, this.ahora() + ms, ms);
  }
}

/**
 * La misma cuota en memoria, para las pruebas del cliente sin Redis y para
 * clientes construidos a mano. No se comparte entre procesos.
 */
export class CuotaRiotMemoria implements CuotaRiot {
  private marcas: number[] = [];
  private bloqueadoHasta = 0;

  constructor(
    private readonly ventanas: readonly VentanaCuotaRiot[],
    private readonly reservaAlta = 0,
    private readonly ahora: () => number = Date.now,
  ) {}

  async reservar(prioridad: PrioridadRiot): Promise<number> {
    const ahora = this.ahora();
    if (this.bloqueadoHasta > ahora) return this.bloqueadoHasta - ahora;
    const mayor = Math.max(...this.ventanas.map((v) => v.ms));
    this.marcas = this.marcas.filter((marca) => ahora - marca < mayor);
    let espera = 0;
    for (const { limite, ms } of this.ventanas) {
      const tope = limiteEfectivo(limite, prioridad, this.reservaAlta);
      const enVentana = this.marcas.filter((marca) => ahora - marca < ms);
      if (enVentana.length >= tope) {
        const marca = enVentana[enVentana.length - tope] ?? ahora;
        espera = Math.max(espera, marca + ms - ahora);
      }
    }
    if (espera > 0) return espera;
    this.marcas.push(ahora);
    return 0;
  }

  async bloquear(ms: number): Promise<void> {
    this.bloqueadoHasta = Math.max(this.bloqueadoHasta, this.ahora() + ms);
  }
}
