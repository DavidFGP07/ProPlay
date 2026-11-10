import { createHash } from "node:crypto";
import type Redis from "ioredis";
import { logger } from "../../config/logger";

/**
 * Estado de la clave de Riot, compartido en Redis por todos los procesos.
 *
 * La clave de desarrollo caduca cada 24 horas. Cuando Riot la rechaza (401 o
 * 403) se marca como inválida con su huella (nunca la clave en claro): desde
 * ese momento nadie vuelve a llamar a Riot con ella, la cola de ingesta se
 * pausa en lugar de gastar reintentos y la vinculación responde «inténtalo
 * más tarde». Al arrancar con otra clave (`RIOT_API_KEY` nueva y reinicio), la
 * huella ya no coincide: la marca se borra y la cola se reanuda sola.
 */

export type EstadoClaveRiot = "ok" | "sin-clave" | "clave-caducada";

export const CLAVE_ESTADO_RIOT = "proplay:riot:clave-invalida";

interface MarcaClaveInvalida {
  huella: string;
  desde: string;
  estado: number;
}

/** Huella corta de la clave: identifica cuál se rechazó sin guardarla. */
export function huellaClave(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex").slice(0, 16);
}

type Oyente = () => void | Promise<void>;

export class EstadoClaveRiotRedis {
  private readonly oyentes: Oyente[] = [];

  constructor(
    private readonly redis: () => Promise<Redis>,
    private readonly clave = CLAVE_ESTADO_RIOT,
  ) {}

  /** Se avisa al marcar la clave como inválida (la ingesta pausa su cola). */
  alInvalidar(oyente: Oyente): () => void {
    this.oyentes.push(oyente);
    return () => {
      const indice = this.oyentes.indexOf(oyente);
      if (indice >= 0) this.oyentes.splice(indice, 1);
    };
  }

  async estado(apiKey: string | undefined): Promise<EstadoClaveRiot> {
    if (!apiKey) return "sin-clave";
    const marca = await this.leer();
    return marca?.huella === huellaClave(apiKey) ? "clave-caducada" : "ok";
  }

  async marcarInvalida(apiKey: string, estadoHttp: number): Promise<void> {
    const marca: MarcaClaveInvalida = {
      huella: huellaClave(apiKey),
      desde: new Date().toISOString(),
      estado: estadoHttp,
    };
    const redis = await this.redis();
    const anterior = await redis.getset(this.clave, JSON.stringify(marca));
    // Un solo aviso por clave, aunque varias peticiones la descubran a la vez.
    if (anterior && (JSON.parse(anterior) as MarcaClaveInvalida).huella === marca.huella) return;
    logger.error(
      { estadoHttp, huella: marca.huella },
      "Riot rechazó RIOT_API_KEY (inválida o caducada): ingesta en pausa y vinculación no disponible hasta renovarla y reiniciar (docs/operacion.md)",
    );
    for (const oyente of this.oyentes) await oyente();
  }

  /**
   * Al arrancar: si la marca es de otra clave, se borra (la clave se renovó).
   * Devuelve el estado de la clave actual.
   */
  async revisarAlArrancar(apiKey: string | undefined): Promise<EstadoClaveRiot> {
    const marca = await this.leer();
    if (marca && apiKey && marca.huella !== huellaClave(apiKey)) {
      const redis = await this.redis();
      await redis.del(this.clave);
      logger.info("RIOT_API_KEY renovada: se retira la marca de clave caducada");
    }
    return this.estado(apiKey);
  }

  private async leer(): Promise<MarcaClaveInvalida | null> {
    const redis = await this.redis();
    const valor = await redis.get(this.clave);
    if (!valor) return null;
    try {
      return JSON.parse(valor) as MarcaClaveInvalida;
    } catch {
      return null;
    }
  }
}
