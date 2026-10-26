import { useQuery } from '@tanstack/react-query'
import { enviarMensaje, listarMensajes } from '@/mocks/api'
import { perfilesEquipo, perfilesJugador } from '@/mocks/seed'
import { actorDemo } from '@/mocks/sesion'
import { simulado, useMutacionSimulada } from '@/api/demo'

export interface Contacto {
  id: string
  nombre: string
  sub: string
}

// RF-12 · Mensajes del usuario en sesion
export function useMensajes() {
  return useQuery({
    queryKey: ['mensajes'],
    // TODO: S4 — conectar con GET /api/v1/mensajeria/conversaciones
    queryFn: () => simulado(() => listarMensajes(actorDemo().id), []),
  })
}

// RF-12 · Personas con las que el usuario puede abrir una conversacion
export function useContactos() {
  return useQuery({
    queryKey: ['mensajes', 'contactos'],
    // TODO: S4 — conectar con GET /api/v1/mensajeria/conversaciones
    queryFn: () =>
      simulado(async (): Promise<Contacto[]> => {
        // Un jugador escribe a las organizaciones; el resto, a los jugadores.
        if (actorDemo().rol === 'jugador') {
          return perfilesEquipo.map((e) => ({ id: e.usuarioId, nombre: e.nombre, sub: e.region }))
        }
        return perfilesJugador
          .slice(0, 10)
          .map((p) => ({ id: p.usuarioId, nombre: p.nombre, sub: `@${p.handle}` }))
      }, []),
  })
}

// RF-12 · Enviar un mensaje
export function useEnviarMensaje() {
  return useMutacionSimulada(({ receptorId, texto }: { receptorId: string; texto: string }) =>
    // TODO: S4 — conectar con POST /api/v1/mensajeria/conversaciones/:id/mensajes
    enviarMensaje(actorDemo(), receptorId, texto),
  )
}
