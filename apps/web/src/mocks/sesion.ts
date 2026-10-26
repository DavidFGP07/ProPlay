import type { Usuario } from '@/types'

/**
 * Actor de la simulacion en memoria.
 *
 * La API real identifica a quien hace la peticion por el access token; la
 * simulacion necesita el usuario explicito para auditar y aplicar permisos.
 * El AuthContext lo registra aqui y los hooks de `src/api/` lo leen, de modo
 * que ningun componente tiene que pasar el usuario a la capa de datos.
 */
let actor: Usuario | null = null

export function establecerActorDemo(usuario: Usuario | null): void {
  actor = usuario
}

export function actorDemo(): Usuario {
  if (!actor) throw new Error('No hay una sesion activa.')
  return actor
}
