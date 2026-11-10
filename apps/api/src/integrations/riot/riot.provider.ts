import {
  COLA_SOLO_DUO,
  JUEGO_PILOTO,
  PARTIDAS_POR_SINCRONIZACION,
  SERVIDORES_LOL,
  type ServidorLol,
} from "@proplay/shared";
import { env } from "../../config/env";
import { BadRequestError, NotImplementedError } from "../../utils/errors";
import type {
  CuentaVinculada,
  EstadisticasExternas,
  GameStatsProvider,
  ParametrosEstadisticas,
  ParametrosVinculacion,
  TokensRefrescados,
} from "../GameStatsProvider";
import { cuotaRiot, estadoClaveRiot } from "./compartido";
import {
  ClienteRiot,
  LLAMADA_COMPROBACION,
  LLAMADA_INGESTA,
  LLAMADA_VINCULACION,
  urlIconoInvocador,
  type LlamadaRiot,
} from "./riot.client";
import { construirEstadisticaLol, rangosLol, type RangosLol } from "./riot.normalizacion";
import type { PartidaRiot } from "./riot.tipos";

/**
 * Integración con Riot Games (solo League of Legends, decisión 0.3).
 *
 * Con la clave de la API (RIOT_API_KEY) se usan:
 *   - account-v1: Riot ID (`gameName#tagLine`) → puuid.
 *   - summoner-v4: icono y nivel del invocador (el icono sirve para verificar
 *     que la cuenta es del jugador).
 *   - league-v4: rango en Solo/Duo (al catálogo `RangoLol` con `rangoDesdeRiot`)
 *     y Flex (sólo como dato de `metricas`).
 *   - match-v5: historial de partidas, de donde salen partidas, victorias,
 *     KDA, win rate, CS/min, oro/min, daño/min, visión/min, participación en
 *     kills, rol principal y campeones más jugados.
 *
 * Riot Sign On (OAuth) exige una clave de producción con RSO aprobado, que el
 * proyecto no tiene: `vincularCuenta` y `refrescarToken` siguen en 501 y la
 * vinculación se hace con el desafío del icono (docs/decisiones.md,
 * «Integración con Riot»).
 */

/** Si hay menos clasificatorias que esto, se completa con partidas normales. */
const MINIMO_PARTIDAS_CLASIFICATORIAS = 5;
/** Peticiones de detalle simultáneas: dentro del límite de 20 por segundo. */
const DESCARGAS_EN_PARALELO = 4;

export interface CuentaRiotEncontrada {
  puuid: string;
  riotId: string;
  servidor: ServidorLol;
  iconoActual: number;
  nivelInvocador: number;
}

/** Resultado de la comprobación barata de la ingesta periódica. */
export interface NovedadesRiot {
  /** Hay partidas (clasificatoria solo/dúo o normales) empezadas después de `desde`. */
  partidasNuevas: boolean;
  /** Rango actual, que puede cambiar sin jugar (pérdida de LP por inactividad). */
  rangos: RangosLol;
}

export function esServidorLol(valor: string | null | undefined): valor is ServidorLol {
  return (SERVIDORES_LOL as readonly string[]).includes(valor ?? "");
}

export class RiotProvider implements GameStatsProvider {
  readonly plataforma = "RIOT" as const;

  constructor(
    private readonly cliente: ClienteRiot = new ClienteRiot({
      apiKey: env.RIOT_API_KEY,
      cuota: cuotaRiot,
      clave: estadoClaveRiot,
    }),
  ) {}

  /**
   * Busca la cuenta por Riot ID y su invocador en el servidor indicado.
   * `null` si el Riot ID no existe o no tiene invocador de LoL allí.
   */
  async buscarCuenta(
    gameName: string,
    tagLine: string,
    servidor: ServidorLol,
  ): Promise<CuentaRiotEncontrada | null> {
    const cuenta = await this.cliente.cuentaPorRiotId(gameName, tagLine, servidor, LLAMADA_VINCULACION);
    if (!cuenta) return null;
    const invocador = await this.cliente.invocadorPorPuuid(cuenta.puuid, servidor, LLAMADA_VINCULACION);
    if (!invocador) return null;
    return {
      puuid: cuenta.puuid,
      riotId: `${cuenta.gameName ?? gameName}#${cuenta.tagLine ?? tagLine}`,
      servidor,
      iconoActual: invocador.profileIconId,
      nivelInvocador: invocador.summonerLevel,
    };
  }

  /**
   * Icono de invocador actual; `null` si el invocador ya no existe. Por
   * defecto como comprobación del icono; «generar otro» lo pide como vinculación.
   */
  async iconoActual(
    puuid: string,
    servidor: ServidorLol,
    llamada: LlamadaRiot = LLAMADA_COMPROBACION,
  ): Promise<number | null> {
    const invocador = await this.cliente.invocadorPorPuuid(puuid, servidor, llamada);
    return invocador?.profileIconId ?? null;
  }

  /** Riot ID vigente del puuid (cambia si el jugador se renombra). */
  async riotIdActual(puuid: string, servidor: ServidorLol): Promise<string | null> {
    const cuenta = await this.cliente.cuentaPorPuuid(puuid, servidor, LLAMADA_INGESTA);
    return cuenta?.gameName && cuenta.tagLine ? `${cuenta.gameName}#${cuenta.tagLine}` : null;
  }

  urlIcono(icono: number): string {
    return urlIconoInvocador(icono);
  }

  // RSO (OAuth) no está disponible con la clave actual: ver la cabecera.
  async vincularCuenta(_parametros: ParametrosVinculacion): Promise<CuentaVinculada> {
    throw new NotImplementedError(
      "Riot Sign On necesita una clave de producción; usa la verificación por icono",
    );
  }

  async obtenerEstadisticas(
    parametros: ParametrosEstadisticas,
  ): Promise<EstadisticasExternas[]> {
    const { externalId: puuid, juego, region } = parametros;
    if (juego !== JUEGO_PILOTO) {
      throw new NotImplementedError(`La integración con Riot sólo cubre ${JUEGO_PILOTO}`);
    }
    if (!esServidorLol(region)) {
      throw new BadRequestError("La cuenta de Riot no tiene un servidor válido");
    }

    const invocador = await this.cliente.invocadorPorPuuid(puuid, region, LLAMADA_INGESTA);
    if (!invocador) {
      throw new BadRequestError(
        `La cuenta de Riot ya no tiene invocador de League of Legends en ${region}`,
      );
    }

    const [ligas, ids] = await Promise.all([
      this.cliente.ligasPorPuuid(puuid, region, LLAMADA_INGESTA),
      this.idsRecientes(puuid, region),
    ]);
    const partidas = await this.descargarPartidas(ids, region);

    return [construirEstadisticaLol({ puuid, servidor: region, invocador, ligas, partidas })];
  }

  /**
   * Comprobación barata de la ingesta periódica (3 peticiones en lugar de
   * unas 24): si hay partidas empezadas después de `desde` en las colas que
   * analiza la sincronización (solo/dúo y normales) y el rango actual. Si no
   * hay partidas nuevas, no hace falta descargar las 20.
   */
  async novedades(puuid: string, servidor: ServidorLol, desde: Date): Promise<NovedadesRiot> {
    const [clasificatorias, normales, ligas] = await Promise.all([
      this.cliente.idsPartidas(puuid, servidor, { cola: COLA_SOLO_DUO, desde, cantidad: 1 }, LLAMADA_INGESTA),
      this.cliente.idsPartidas(puuid, servidor, { tipo: "normal", desde, cantidad: 1 }, LLAMADA_INGESTA),
      this.cliente.ligasPorPuuid(puuid, servidor, LLAMADA_INGESTA),
    ]);
    return {
      partidasNuevas: clasificatorias.length > 0 || normales.length > 0,
      rangos: rangosLol(ligas),
    };
  }

  // RSO (OAuth) no está disponible con la clave actual: ver la cabecera.
  async refrescarToken(_refreshToken: string): Promise<TokensRefrescados> {
    throw new NotImplementedError("Riot Sign On necesita una clave de producción");
  }

  /**
   * Clasificatoria solo/dúo (cola 420) primero; si son pocas, se completa con
   * normales. Flex (440) no entra: el contrato de shared/riot.ts cuenta sólo
   * solo/dúo como clasificatoria. La posición sale sólo de las de la cola 420
   * (ver `construirEstadisticaLol`).
   */
  private async idsRecientes(puuid: string, servidor: ServidorLol): Promise<string[]> {
    const cantidad = PARTIDAS_POR_SINCRONIZACION;
    const clasificatorias = await this.cliente.idsPartidas(
      puuid,
      servidor,
      { cola: COLA_SOLO_DUO, cantidad },
      LLAMADA_INGESTA,
    );
    if (clasificatorias.length >= MINIMO_PARTIDAS_CLASIFICATORIAS) return clasificatorias;

    const normales = await this.cliente.idsPartidas(
      puuid,
      servidor,
      { tipo: "normal", cantidad: cantidad - clasificatorias.length },
      LLAMADA_INGESTA,
    );
    return [...clasificatorias, ...normales];
  }

  private async descargarPartidas(ids: string[], servidor: ServidorLol): Promise<PartidaRiot[]> {
    const partidas: PartidaRiot[] = [];
    for (let i = 0; i < ids.length; i += DESCARGAS_EN_PARALELO) {
      const lote = await Promise.all(
        ids.slice(i, i + DESCARGAS_EN_PARALELO).map((id) => this.cliente.partida(id, servidor, LLAMADA_INGESTA)),
      );
      for (const partida of lote) if (partida) partidas.push(partida);
    }
    return partidas;
  }
}
