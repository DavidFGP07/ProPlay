import type { UsuarioPublico } from '@proplay/shared'
import { useMutacion } from '@/api/queryClient'
import { config } from '@/lib/env'
import { personaDemo } from '@/mocks/persona'
import { actorDemo, establecerActorDemo } from '@/mocks/sesion'
import type { Usuario } from '@/types'

/**
 * Interruptor del puente de datos de demostracion (VITE_DEMO_DATA).
 *
 * Los hooks de `src/api/` cuyo endpoint aun no existe pasan por aqui: con el
 * puente encendido leen la simulacion; apagado, devuelven el valor vacio que
 * daria la API real y sus mutaciones fallan con un aviso. Asi se comprueba en
 * cualquier momento que esta conectado de verdad.
 */
export const datosDemoActivos = config.datosDemo

export function simulado<T>(consulta: () => Promise<T>, vacio: T): Promise<T> {
  return datosDemoActivos ? consulta() : Promise.resolve(vacio)
}

export function accionSimulada<T>(accion: () => Promise<T>): Promise<T> {
  if (!datosDemoActivos) {
    return Promise.reject(new Error('Esta accion todavia no esta conectada con la API.'))
  }
  return accion()
}

/** El AuthContext informa aqui de cada cambio de sesion. */
export function sincronizarSesionDemo(usuario: UsuarioPublico | null): void {
  establecerActorDemo(usuario && datosDemoActivos ? personaDemo(usuario) : null)
}

/** Persona de demostracion por la que se hace pasar la sesion actual. */
export function personaActual(): Usuario {
  return actorDemo()
}

/** Mutacion de la simulacion: con el puente apagado falla sin tocar nada. */
export function useMutacionSimulada<TVariables, TData>(
  mutationFn: (variables: TVariables) => Promise<TData>,
) {
  return useMutacion((variables: TVariables) => accionSimulada(() => mutationFn(variables)))
}
