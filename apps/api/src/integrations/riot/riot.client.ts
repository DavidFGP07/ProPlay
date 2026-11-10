import type { ServidorLol } from "@proplay/shared";
import {
  CuotaRiotAgotadaError,
  IntegracionRiotNoDisponibleError,
  ServicioExternoError,
} from "../../utils/errors";
import { CuotaRiotMemoria, type CuotaRiot, type PrioridadRiot } from "./cuotaRiot";
import type { EstadoClaveRiot } from "./estadoClave";
import type {
  CuentaRiot,
  EntradaLigaRiot,
  InvocadorRiot,
  PartidaRiot,
} from "./riot.tipos";

/**
 * Cliente HTTP de la API de Riot Games.
 *
 * - Autenticación con la cabecera `X-Riot-Token` (RIOT_API_KEY).
 * - Enrutamiento: los endpoints de LoL (summoner, league) van al servidor de
 *   la cuenta (`la1.api.riotgames.com`); account-v1 y match-v5 van a la región
 *   continental (`americas.api.riotgames.com`).
 * - Cuota: la clave limita a TODA la aplicación (con la de desarrollo, 20 por
 *   segundo y 100 cada dos minutos). Cada petición reserva su hueco en la
 *   cuota compartida en Redis (`cuotaRiot.ts`) con la prioridad de quien llama
 *   (`LlamadaRiot`): si la espera supera lo que esa llamada tolera, lanza
 *   `CuotaRiotAgotadaError` y quien llama decide (reprogramar, «mucha demanda»).
 * - Un 429 de Riot se respeta: espera su `Retry-After` (y si es de límite de
 *   aplicación bloquea a todos durante ese tiempo); un 5xx se reintenta con
 *   retroceso.
 * - Un 401/403 marca la clave como inválida (`estadoClave.ts`): no se vuelve a
 *   llamar con ella y la ingesta se pausa hasta renovarla.
 *
 * No importa `env`: la clave se inyecta, así se prueba sin configuración.
 */

type RegionContinental = "americas" | "europe" | "asia" | "sea";

const REGION_POR_SERVIDOR: Record<ServidorLol, RegionContinental> = {
  LA1: "americas",
  LA2: "americas",
  NA1: "americas",
  BR1: "americas",
  EUW1: "europe",
  EUN1: "europe",
  TR1: "europe",
  RU: "europe",
  ME1: "europe",
  KR: "asia",
  JP1: "asia",
  OC1: "sea",
  SG2: "sea",
  TW2: "sea",
  VN2: "sea",
};

/** Región continental para match-v5. */
export function regionDePartidas(servidor: ServidorLol): RegionContinental {
  return REGION_POR_SERVIDOR[servidor];
}

/** account-v1 sólo existe en americas, europe y asia; cualquiera resuelve cualquier cuenta. */
export function regionDeCuentas(servidor: ServidorLol): Exclude<RegionContinental, "sea"> {
  const region = REGION_POR_SERVIDOR[servidor];
  return region === "sea" ? "asia" : region;
}

/** Ventanas de cuota de la clave de desarrollo (valor por defecto de `RIOT_LIMITES`). */
export const VENTANAS_CUOTA_DESARROLLO = [
  { limite: 20, ms: 1_000 },
  { limite: 100, ms: 120_000 },
] as const;

const REINTENTOS_MAXIMOS = 2;

type Esperar = (ms: number) => Promise<void>;
const esperarReal: Esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

/**
 * Quién llama a Riot: con qué prioridad reserva cuota y cuánto puede esperar
 * por ella antes de rendirse con `CuotaRiotAgotadaError`.
 */
export interface LlamadaRiot {
  prioridad: PrioridadRiot;
  esperaMaximaMs: number;
}

/** Buscar la cuenta o generar otro icono: el jugador espera la respuesta. */
export const LLAMADA_VINCULACION: LlamadaRiot = { prioridad: "ALTA", esperaMaximaMs: 10_000 };
/** Comprobar el icono: si no hay cupo, la vista reintenta sola. */
export const LLAMADA_COMPROBACION: LlamadaRiot = { prioridad: "ALTA", esperaMaximaMs: 3_000 };
/** Sincronizar: espera sólo huecos cortos; si no, el trabajo se reprograma. */
export const LLAMADA_INGESTA: LlamadaRiot = { prioridad: "BAJA", esperaMaximaMs: 2_000 };

/** Lo que el cliente necesita del estado de la clave (ver estadoClave.ts). */
export interface ControlClaveRiot {
  estado(apiKey: string | undefined): Promise<EstadoClaveRiot>;
  marcarInvalida(apiKey: string, estadoHttp: number): Promise<void>;
}

export interface OpcionesClienteRiot {
  apiKey: string | undefined;
  fetch?: typeof fetch;
  esperar?: Esperar;
  /** Cuota compartida; por defecto, una en memoria con los límites de desarrollo. */
  cuota?: CuotaRiot;
  /** Estado de la clave compartido; sin él, un 401/403 sólo falla la petición. */
  clave?: ControlClaveRiot;
}

export interface FiltroPartidas {
  /** Cola concreta (`queue` de match-v5), p. ej. `COLA_SOLO_DUO`. */
  cola?: number;
  /** `ranked` o `normal` (match-v5). */
  tipo?: "ranked" | "normal";
  /** Sólo partidas empezadas después (`startTime` de match-v5). */
  desde?: Date;
  cantidad: number;
}

export class ClienteRiot {
  private readonly fetch: typeof fetch;
  private readonly esperar: Esperar;
  private readonly cuota: CuotaRiot;

  constructor(private readonly opciones: OpcionesClienteRiot) {
    this.fetch = opciones.fetch ?? globalThis.fetch.bind(globalThis);
    this.esperar = opciones.esperar ?? esperarReal;
    this.cuota = opciones.cuota ?? new CuotaRiotMemoria(VENTANAS_CUOTA_DESARROLLO);
  }

  /** account-v1: Riot ID → puuid. `null` si no existe. */
  cuentaPorRiotId(
    gameName: string,
    tagLine: string,
    servidor: ServidorLol,
    llamada: LlamadaRiot,
  ): Promise<CuentaRiot | null> {
    return this.pedir<CuentaRiot>(
      llamada,
      regionDeCuentas(servidor),
      `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
    );
  }

  /** account-v1: puuid → Riot ID actual (el jugador puede cambiarlo). */
  cuentaPorPuuid(
    puuid: string,
    servidor: ServidorLol,
    llamada: LlamadaRiot,
  ): Promise<CuentaRiot | null> {
    return this.pedir<CuentaRiot>(
      llamada,
      regionDeCuentas(servidor),
      `/riot/account/v1/accounts/by-puuid/${encodeURIComponent(puuid)}`,
    );
  }

  /** summoner-v4: icono y nivel. `null` si no tiene invocador en ese servidor. */
  invocadorPorPuuid(
    puuid: string,
    servidor: ServidorLol,
    llamada: LlamadaRiot,
  ): Promise<InvocadorRiot | null> {
    return this.pedir<InvocadorRiot>(
      llamada,
      servidor.toLowerCase(),
      `/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(puuid)}`,
    );
  }

  /** league-v4: rangos clasificatorios (vacío si no juega clasificatorias). */
  async ligasPorPuuid(
    puuid: string,
    servidor: ServidorLol,
    llamada: LlamadaRiot,
  ): Promise<EntradaLigaRiot[]> {
    const entradas = await this.pedir<EntradaLigaRiot[]>(
      llamada,
      servidor.toLowerCase(),
      `/lol/league/v4/entries/by-puuid/${encodeURIComponent(puuid)}`,
    );
    return entradas ?? [];
  }

  /** match-v5: ids de las partidas más recientes. */
  async idsPartidas(
    puuid: string,
    servidor: ServidorLol,
    filtro: FiltroPartidas,
    llamada: LlamadaRiot,
  ): Promise<string[]> {
    const parametros = new URLSearchParams({ start: "0", count: String(filtro.cantidad) });
    if (filtro.cola !== undefined) parametros.set("queue", String(filtro.cola));
    if (filtro.tipo) parametros.set("type", filtro.tipo);
    if (filtro.desde) parametros.set("startTime", String(Math.floor(filtro.desde.getTime() / 1000)));
    const ids = await this.pedir<string[]>(
      llamada,
      regionDePartidas(servidor),
      `/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?${parametros.toString()}`,
    );
    return ids ?? [];
  }

  /** match-v5: detalle de una partida. */
  partida(id: string, servidor: ServidorLol, llamada: LlamadaRiot): Promise<PartidaRiot | null> {
    return this.pedir<PartidaRiot>(
      llamada,
      regionDePartidas(servidor),
      `/lol/match/v5/matches/${encodeURIComponent(id)}`,
    );
  }

  /**
   * Reserva el hueco en la cuota con la prioridad de la llamada, esperando lo
   * que ésta tolere. Si no hay hueco a tiempo, `CuotaRiotAgotadaError`.
   */
  private async reservarCuota(llamada: LlamadaRiot): Promise<void> {
    let esperado = 0;
    for (;;) {
      const espera = await this.cuota.reservar(llamada.prioridad);
      if (espera === 0) return;
      if (esperado + espera > llamada.esperaMaximaMs) throw new CuotaRiotAgotadaError(espera);
      await this.esperar(espera);
      esperado += espera;
    }
  }

  /**
   * Petición GET con cuota, reintentos y traducción de errores. Devuelve
   * `null` en 404: para Riot significa «no existe», no un fallo.
   */
  private async pedir<T>(
    llamada: LlamadaRiot,
    host: string,
    ruta: string,
    intento = 0,
  ): Promise<T | null> {
    const { apiKey, clave } = this.opciones;
    // Sin clave, o con una que Riot ya rechazó, ni se intenta: no gasta cuota.
    if (!apiKey || (clave && (await clave.estado(apiKey)) !== "ok")) {
      throw new IntegracionRiotNoDisponibleError();
    }

    await this.reservarCuota(llamada);

    let respuesta: Response;
    try {
      respuesta = await this.fetch(`https://${host}.api.riotgames.com${ruta}`, {
        headers: { "X-Riot-Token": apiKey, Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      if (intento < REINTENTOS_MAXIMOS) {
        await this.esperar(1_000 * (intento + 1));
        return this.pedir<T>(llamada, host, ruta, intento + 1);
      }
      throw new ServicioExternoError("No se pudo contactar con la API de Riot");
    }

    if (respuesta.ok) return (await respuesta.json()) as T;
    if (respuesta.status === 404) return null;

    if (respuesta.status === 401 || respuesta.status === 403) {
      await clave?.marcarInvalida(apiKey, respuesta.status);
      throw new IntegracionRiotNoDisponibleError();
    }

    if (respuesta.status === 429) {
      const segundos = Number(respuesta.headers.get("retry-after") ?? "1");
      const espera = (Number.isFinite(segundos) && segundos > 0 ? segundos : 1) * 1000;
      // Límite de aplicación: la clave entera está agotada, nadie debe llamar.
      // Los de método o servicio sólo afectan a este endpoint.
      if (respuesta.headers.get("x-rate-limit-type") === "application") {
        await this.cuota.bloquear(espera);
      }
      if (intento < REINTENTOS_MAXIMOS && espera <= llamada.esperaMaximaMs) {
        await this.esperar(espera);
        return this.pedir<T>(llamada, host, ruta, intento + 1);
      }
      throw new CuotaRiotAgotadaError(espera);
    }

    if (respuesta.status >= 500 && intento < REINTENTOS_MAXIMOS) {
      await this.esperar(1_000 * (intento + 1));
      return this.pedir<T>(llamada, host, ruta, intento + 1);
    }

    throw new ServicioExternoError(`La API de Riot respondió ${respuesta.status}`, {
      estado: respuesta.status,
    });
  }
}

/**
 * URL pública (Data Dragon, CDN oficial de Riot) de un icono de invocador.
 * Los iconos 0–28 existen en todas las versiones, así que basta una fija.
 */
const VERSION_DATA_DRAGON = "14.1.1";
export function urlIconoInvocador(icono: number): string {
  return `https://ddragon.leagueoflegends.com/cdn/${VERSION_DATA_DRAGON}/img/profileicon/${icono}.png`;
}
