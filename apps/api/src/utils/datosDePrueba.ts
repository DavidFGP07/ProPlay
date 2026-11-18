/**
 * Cuentas que crea el seed (`prisma/seed.ts`). Se definen aquí, una sola vez,
 * porque además de usarlas el seed las reconoce el script del piloto
 * (`npm run metricas:piloto -w api`, opción `--excluir-prueba`), que las deja
 * fuera de las métricas de la tesis.
 *
 * Una cuenta es de prueba si su correo es uno de los fijos del seed o sigue el
 * patrón de sus jugadores, o si su cuenta de Riot tiene un `puuid` con el
 * prefijo del seed (nunca se confunde con uno real de Riot).
 */

/** Prefijo de los `puuid` (`CuentaGaming.externalId`) de las cuentas de Riot del seed. */
export const PREFIJO_PUUID_SEED = "seed-";

/**
 * `true` si la cuenta de Riot es del seed. La ingesta no las encola ni llama a
 * Riot por ellas: su `puuid` es inventado y Riot lo rechazaría.
 */
export function esPuuidSeed(externalId: string): boolean {
  return externalId.startsWith(PREFIJO_PUUID_SEED);
}

export const CORREO_ADMIN_SEED = "admin@proplay.gg";
export const CORREO_SCOUT_SEED = "scout@proplay.gg";

/** Correos de los tres equipos del seed, en el orden en que los crea. */
export const CORREOS_EQUIPOS_SEED = [
  "equipo@caribeesports.gg",
  "equipo@andesgaming.co",
  "equipo@uninortelegends.edu.co",
] as const;

/** Correos fijos del seed: administrador, scout y equipos. */
export const CORREOS_FIJOS_SEED: readonly string[] = [
  CORREO_ADMIN_SEED,
  CORREO_SCOUT_SEED,
  ...CORREOS_EQUIPOS_SEED,
];

/** Correo del jugador `n` del seed (desde 1). */
export function correoJugadorSeed(n: number): string {
  return `jugador${n}@proplay.gg`;
}

/** Expresión regular (POSIX, para `~` en Postgres) de los correos de jugador del seed. */
export const PATRON_CORREO_JUGADOR_SEED = "^jugador[0-9]+@proplay\\.gg$";

/** `true` si el correo es de una cuenta del seed. */
export function esCorreoSeed(email: string): boolean {
  return CORREOS_FIJOS_SEED.includes(email) || new RegExp(PATRON_CORREO_JUGADOR_SEED).test(email);
}
