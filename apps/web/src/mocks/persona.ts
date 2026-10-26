import type { Rol, UsuarioPublico } from '@proplay/shared'
import { usuarios } from '@/mocks/seed'
import type { Usuario } from '@/mocks/modelos'

/**
 * Puente entre la sesion real y la simulacion.
 *
 * Los usuarios de la API no existen en los datos simulados, asi que cada uno
 * se hace pasar por una persona de demostracion de su mismo rol. Es el UNICO
 * punto donde un usuario real se convierte en uno simulado: se retira cuando
 * la ultima vista deje de depender de `src/mocks/`.
 */
const PERSONA_POR_ROL: Record<Rol, string> = {
  JUGADOR: 'u-jugador-1',
  EQUIPO: 'u-equipo-1',
  SCOUT: 'u-scout-1',
  ADMIN: 'u-admin',
}

export function personaDemo(usuario: UsuarioPublico): Usuario {
  const persona = usuarios.find((u) => u.id === PERSONA_POR_ROL[usuario.rol])
  if (!persona) throw new Error(`No hay persona de demostracion para el rol ${usuario.rol}`)
  return persona
}
