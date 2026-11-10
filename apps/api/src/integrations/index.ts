import type { Plataforma } from "@proplay/shared";
import type { GameStatsProvider } from "./GameStatsProvider";
import { RiotProvider } from "./riot/riot.provider";
import { SteamProvider } from "./steam/steam.provider";
import { TwitchProvider } from "./twitch/twitch.provider";
import { YouTubeProvider } from "./youtube/youtube.provider";

/**
 * Registro de integraciones. El módulo `estadisticas` resuelve el proveedor
 * por plataforma y trabaja siempre contra la interfaz GameStatsProvider.
 */
const riot = new RiotProvider();

const proveedores: Record<Plataforma, GameStatsProvider> = {
  RIOT: riot,
  STEAM: new SteamProvider(),
  TWITCH: new TwitchProvider(),
  YOUTUBE: new YouTubeProvider(),
};

export function obtenerProveedor(plataforma: Plataforma): GameStatsProvider {
  return proveedores[plataforma];
}

/**
 * Riot con sus operaciones propias (búsqueda por Riot ID y verificación por
 * icono), que no forman parte de la interfaz común.
 */
export function obtenerProveedorRiot(): RiotProvider {
  return riot;
}

export { esServidorLol } from "./riot/riot.provider";
export type { CuentaRiotEncontrada, NovedadesRiot } from "./riot/riot.provider";
export { cuotaRiot, estadoClaveRiot } from "./riot/compartido";
export { LLAMADA_VINCULACION } from "./riot/riot.client";
export type { EstadoClaveRiot } from "./riot/estadoClave";
export type { GameStatsProvider } from "./GameStatsProvider";
