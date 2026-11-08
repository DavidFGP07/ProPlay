import type { Rol } from '@proplay/shared'

/**
 * Roles con acceso a cada area de la aplicacion (RNF-04). El enrutador las
 * declara una sola vez con una ruta de layout por area y el menu lateral se
 * arma con estas mismas listas: ninguna vista repite la comprobacion.
 */
export const AREAS = {
  jugador: ['JUGADOR'],
  equipo: ['EQUIPO', 'SCOUT', 'ADMIN'],
  /** Crear y editar ofertas: sólo la organización que contrata, no el scout. */
  gestionOfertas: ['EQUIPO'],
  admin: ['ADMIN'],
} as const satisfies Record<string, readonly Rol[]>

/**
 * Rutas (patrones de React Router) sin el aviso de pagina «Datos de
 * demostracion»: las que solo consumen endpoints reales y las mixtas, que
 * marcan cada seccion simulada con MarcaDatosDemo. Al conectar una vista de
 * verdad, se añade aqui.
 */
export const RUTAS_SIN_DATOS_DEMO: readonly string[] = [
  '/cuenta',
  '/legal/privacidad',
  '/jugador/:id',
  '/mi-perfil',
  '/panel-equipo',
  '/vacantes',
  '/vacantes/:id',
  '/panel-equipo/ofertas/nueva',
  '/panel-equipo/ofertas/:id/editar',
  '/explorar',
  '/cuentas-vinculadas',
  '/mis-estadisticas',
]
