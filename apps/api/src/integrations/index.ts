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
const proveedores: Record<Plataforma, GameStatsProvider> = {
  RIOT: new RiotProvider(),
  STEAM: new SteamProvider(),
  TWITCH: new TwitchProvider(),
  YOUTUBE: new YouTubeProvider(),
};

export function obtenerProveedor(plataforma: Plataforma): GameStatsProvider {
  return proveedores[plataforma];
}

export type { GameStatsProvider } from "./GameStatsProvider";
