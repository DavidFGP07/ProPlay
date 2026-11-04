/**
 * Contrato con la API de Riot que comparten la ingesta de estadísticas
 * (módulo `estadisticas`) y quien las lee (buscador de talento, matching).
 * Quien implemente la ingesta traduce aquí los valores de Riot; nadie más los
 * interpreta por su cuenta. Ver «Afecta a estadísticas (Riot)» en
 * docs/decisiones.md.
 */
import { RANGOS_LOL, type PosicionLol, type RangoLol } from "./enums";

/** Cola de clasificatoria solo/dúo en match-v5 (`info.queueId`). */
export const COLA_SOLO_DUO = 420;

/** Cola de clasificatoria solo/dúo en league-v4 (`queueType`). */
export const COLA_LIGA_SOLO_DUO = "RANKED_SOLO_5x5";

/**
 * `teamPosition` de match-v5 → posición de ProPlay. La posición de un jugador
 * es la más jugada en sus partidas de la cola `COLA_SOLO_DUO`. Un valor fuera
 * de la tabla (o vacío, en partidas sin posición asignada) no cuenta.
 */
export const POSICION_POR_TEAM_POSITION = {
  TOP: "TOP",
  JUNGLE: "JUNGLA",
  MIDDLE: "MID",
  BOTTOM: "ADC",
  UTILITY: "SOPORTE",
} as const satisfies Record<string, PosicionLol>;

/** `tier` de league-v4 → prefijo del rango de ProPlay. */
const TIER_RIOT = {
  IRON: "HIERRO",
  BRONZE: "BRONCE",
  SILVER: "PLATA",
  GOLD: "ORO",
  PLATINUM: "PLATINO",
  EMERALD: "ESMERALDA",
  DIAMOND: "DIAMANTE",
  MASTER: "MAESTRO",
  GRANDMASTER: "GRAN_MAESTRO",
  CHALLENGER: "RETADOR",
} as const;

/** Divisiones que Riot escribe en números romanos (`rank`). */
const DIVISIONES_RIOT = new Set(["I", "II", "III", "IV"]);

/**
 * Rango de ProPlay a partir de la entrada de league-v4 de la cola
 * `COLA_LIGA_SOLO_DUO` (`tier` y `rank`). Maestro, Gran Maestro y Retador no
 * tienen división: Riot manda `rank: "I"` y se ignora. Devuelve `null` si el
 * valor no se reconoce (un tier nuevo de Riot, por ejemplo), para que la
 * ingesta no guarde nada inventado.
 */
export function rangoDesdeRiot(tier: string, rank: string): RangoLol | null {
  const prefijo = TIER_RIOT[tier.toUpperCase() as keyof typeof TIER_RIOT];
  if (!prefijo) return null;
  const sinDivision = (RANGOS_LOL as readonly string[]).includes(prefijo);
  if (sinDivision) return prefijo as RangoLol;
  const division = rank.toUpperCase();
  if (!DIVISIONES_RIOT.has(division)) return null;
  return `${prefijo}_${division}` as RangoLol;
}

/** `true` si `rango` es igual o superior a `minimo`, en el orden de `RANGOS_LOL`. */
export function rangoAlMenos(rango: RangoLol, minimo: RangoLol): boolean {
  return RANGOS_LOL.indexOf(rango) >= RANGOS_LOL.indexOf(minimo);
}
