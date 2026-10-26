import type { Rol } from '@proplay/shared'

/**
 * Roles con acceso a cada area de la aplicacion (RNF-04). El enrutador las
 * declara una sola vez con una ruta de layout por area y el menu lateral se
 * arma con estas mismas listas: ninguna vista repite la comprobacion.
 */
export const AREAS = {
  jugador: ['JUGADOR'],
  equipo: ['EQUIPO', 'SCOUT', 'ADMIN'],
  admin: ['ADMIN'],
} as const satisfies Record<string, readonly Rol[]>
