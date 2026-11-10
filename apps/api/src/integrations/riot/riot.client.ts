import type { ServidorLol } from "@proplay/shared";
import {
  ServicioExternoError,
  ServicioNoConfiguradoError,
  TooManyRequestsError,
} from "../../utils/errors";
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
 * - Cuota: la clave de desarrollo admite 20 peticiones por segundo y 100 cada
 *   dos minutos para TODA la aplicación. El limitador las reparte; si la
 *   espera fuera excesiva responde 429 en lugar de colgar la petición.
 * - Reintentos: un 429 de Riot se reintenta respetando `Retry-After`, y un 5xx
 *   una vez con retroceso.
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

/** Ventanas de cuota de la clave de desarrollo. */
export const VENTANAS_CUOTA_DESARROLLO = [
  { limite: 20, ms: 1_000 },
  { limite: 100, ms: 120_000 },
] as const;

/** Espera máxima que se tolera por cuota antes de rendirse con un 429. */
const ESPERA_MAXIMA_MS = 15_000;
const REINTENTOS_MAXIMOS = 2;

type Esperar = (ms: number) => Promise<void>;
const esperarReal: Esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

/**
 * Limitador de ventana deslizante en memoria. Vale para una sola instancia de
 * la API, que es el despliegue del piloto; con varias habría que moverlo a
 * Redis (tarea 2.5 del plan).
 */
export class LimitadorCuota {
  private marcas: number[] = [];

  constructor(
    private readonly ventanas: readonly { limite: number; ms: number }[],
    private readonly ahora: () => number = Date.now,
    private readonly esperar: Esperar = esperarReal,
  ) {}

  /** Milisegundos que faltan para poder hacer otra petición (0 si ya se puede). */
  esperaNecesaria(): number {
    const ahora = this.ahora();
    const mayorVentana = Math.max(...this.ventanas.map((v) => v.ms));
    this.marcas = this.marcas.filter((marca) => ahora - marca < mayorVentana);
    let espera = 0;
    for (const { limite, ms } of this.ventanas) {
      const enVentana = this.marcas.filter((marca) => ahora - marca < ms);
      if (enVentana.length >= limite) {
        const masAntigua = enVentana[enVentana.length - limite] ?? ahora;
        espera = Math.max(espera, masAntigua + ms - ahora);
      }
    }
    return espera;
  }

  async reservar(): Promise<void> {
    for (;;) {
      const espera = this.esperaNecesaria();
      if (espera === 0) break;
      if (espera > ESPERA_MAXIMA_MS) {
        throw new TooManyRequestsError(
          "Se agotó la cuota de la API de Riot; inténtalo en unos minutos",
          { reintentarEnSegundos: Math.ceil(espera / 1000) },
        );
      }
      await this.esperar(espera);
    }
    this.marcas.push(this.ahora());
  }
}

export interface OpcionesClienteRiot {
  apiKey: string | undefined;
  fetch?: typeof fetch;
  esperar?: Esperar;
  limitador?: LimitadorCuota;
}

export interface FiltroPartidas {
  /** Cola concreta (`queue` de match-v5), p. ej. `COLA_SOLO_DUO`. */
  cola?: number;
  /** `ranked` o `normal` (match-v5). */
  tipo?: "ranked" | "normal";
  cantidad: number;
}

export class ClienteRiot {
  private readonly fetch: typeof fetch;
  private readonly esperar: Esperar;
  private readonly limitador: LimitadorCuota;

  constructor(private readonly opciones: OpcionesClienteRiot) {
    this.fetch = opciones.fetch ?? globalThis.fetch.bind(globalThis);
    this.esperar = opciones.esperar ?? esperarReal;
    this.limitador =
      opciones.limitador ?? new LimitadorCuota(VENTANAS_CUOTA_DESARROLLO);
  }

  /** account-v1: Riot ID → puuid. `null` si no existe. */
  cuentaPorRiotId(
    gameName: string,
    tagLine: string,
    servidor: ServidorLol,
  ): Promise<CuentaRiot | null> {
    return this.pedir<CuentaRiot>(
      regionDeCuentas(servidor),
      `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
    );
  }

  /** account-v1: puuid → Riot ID actual (el jugador puede cambiarlo). */
  cuentaPorPuuid(puuid: string, servidor: ServidorLol): Promise<CuentaRiot | null> {
    return this.pedir<CuentaRiot>(
      regionDeCuentas(servidor),
      `/riot/account/v1/accounts/by-puuid/${encodeURIComponent(puuid)}`,
    );
  }

  /** summoner-v4: icono y nivel. `null` si no tiene invocador en ese servidor. */
  invocadorPorPuuid(puuid: string, servidor: ServidorLol): Promise<InvocadorRiot | null> {
    return this.pedir<InvocadorRiot>(
      servidor.toLowerCase(),
      `/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(puuid)}`,
    );
  }

  /** league-v4: rangos clasificatorios (vacío si no juega clasificatorias). */
  async ligasPorPuuid(puuid: string, servidor: ServidorLol): Promise<EntradaLigaRiot[]> {
    const entradas = await this.pedir<EntradaLigaRiot[]>(
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
  ): Promise<string[]> {
    const parametros = new URLSearchParams({ start: "0", count: String(filtro.cantidad) });
    if (filtro.cola !== undefined) parametros.set("queue", String(filtro.cola));
    if (filtro.tipo) parametros.set("type", filtro.tipo);
    const ids = await this.pedir<string[]>(
      regionDePartidas(servidor),
      `/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?${parametros.toString()}`,
    );
    return ids ?? [];
  }

  /** match-v5: detalle de una partida. */
  partida(id: string, servidor: ServidorLol): Promise<PartidaRiot | null> {
    return this.pedir<PartidaRiot>(
      regionDePartidas(servidor),
      `/lol/match/v5/matches/${encodeURIComponent(id)}`,
    );
  }

  /**
   * Petición GET con cuota, reintentos y traducción de errores. Devuelve
   * `null` en 404: para Riot significa «no existe», no un fallo.
   */
  private async pedir<T>(host: string, ruta: string, intento = 0): Promise<T | null> {
    const { apiKey } = this.opciones;
    if (!apiKey) {
      throw new ServicioNoConfiguradoError(
        "La integración con Riot no está configurada: falta RIOT_API_KEY",
      );
    }

    await this.limitador.reservar();

    let respuesta: Response;
    try {
      respuesta = await this.fetch(`https://${host}.api.riotgames.com${ruta}`, {
        headers: { "X-Riot-Token": apiKey, Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      if (intento < REINTENTOS_MAXIMOS) {
        await this.esperar(1_000 * (intento + 1));
        return this.pedir<T>(host, ruta, intento + 1);
      }
      throw new ServicioExternoError("No se pudo contactar con la API de Riot");
    }

    if (respuesta.ok) return (await respuesta.json()) as T;
    if (respuesta.status === 404) return null;

    if (respuesta.status === 401 || respuesta.status === 403) {
      throw new ServicioExternoError(
        "Riot rechazó la clave de la API: es inválida o caducó (las claves de desarrollo duran 24 horas)",
      );
    }

    if (respuesta.status === 429) {
      const segundos = Number(respuesta.headers.get("retry-after") ?? "1");
      const espera = (Number.isFinite(segundos) ? segundos : 1) * 1000;
      if (intento < REINTENTOS_MAXIMOS && espera <= ESPERA_MAXIMA_MS) {
        await this.esperar(espera);
        return this.pedir<T>(host, ruta, intento + 1);
      }
      throw new TooManyRequestsError(
        "Se agotó la cuota de la API de Riot; inténtalo en unos minutos",
        { reintentarEnSegundos: Math.ceil(espera / 1000) },
      );
    }

    if (respuesta.status >= 500 && intento < REINTENTOS_MAXIMOS) {
      await this.esperar(1_000 * (intento + 1));
      return this.pedir<T>(host, ruta, intento + 1);
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
