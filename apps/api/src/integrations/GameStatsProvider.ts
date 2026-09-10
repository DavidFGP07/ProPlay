import type { Plataforma } from "@proplay/shared";

/**
 * Contrato que cumple toda integración con una plataforma externa
 * (Riot Games, Steam, Twitch, YouTube).
 *
 * El módulo `estadisticas` habla siempre con esta interfaz, nunca con un
 * proveedor concreto: añadir una plataforma nueva es escribir una clase más y
 * registrarla en integrations/index.ts.
 */

/** Resultado de vincular una cuenta externa vía OAuth 2.0. */
export interface CuentaVinculada {
  externalId: string;
  handle: string | null;
  /** Token en claro: quien lo persista debe cifrarlo (utils/crypto.ts). */
  accessToken: string | null;
  refreshToken: string | null;
  expiraEn: Date | null;
}

/** Estadísticas normalizadas de un jugador en un juego. */
export interface EstadisticasExternas {
  juego: string;
  rol: string | null;
  partidas: number;
  victorias: number;
  kda: number;
  winRate: number;
  /** Métricas propias del título (CS/min, ADR, GPM, ...). */
  metricas: Record<string, number | string | null>;
  capturadaEn: Date;
}

export interface TokensRefrescados {
  accessToken: string;
  refreshToken: string | null;
  expiraEn: Date | null;
}

export interface ParametrosVinculacion {
  /** Código de autorización devuelto por el flujo OAuth 2.0. */
  codigoAutorizacion: string;
  jugadorId: string;
}

export interface ParametrosEstadisticas {
  externalId: string;
  accessToken: string | null;
  juego: string;
}

export interface GameStatsProvider {
  readonly plataforma: Plataforma;

  /** Cierra el flujo OAuth y devuelve la identidad externa del jugador. */
  vincularCuenta(parametros: ParametrosVinculacion): Promise<CuentaVinculada>;

  /** Descarga las estadísticas del jugador ya normalizadas al modelo interno. */
  obtenerEstadisticas(
    parametros: ParametrosEstadisticas,
  ): Promise<EstadisticasExternas[]>;

  /** Renueva el access token a partir del refresh token. */
  refrescarToken(refreshToken: string): Promise<TokensRefrescados>;
}
