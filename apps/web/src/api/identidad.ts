import { useQuery } from '@tanstack/react-query'
import { simulado } from '@/api/demo'
import { useAuth } from '@/context/AuthContext'
import { perfilDeUsuario } from '@/mocks/api'
import { perfilesEquipo } from '@/mocks/seed'
import { actorDemo } from '@/mocks/sesion'

/** Identificadores de dominio de quien tiene la sesion abierta. */
export interface Identidad {
  usuarioId: string
  perfilJugadorId?: string
  perfilEquipoId?: string
}

// RF-05 · Perfil propio: de que perfil de jugador u organizacion es dueño el usuario
export function useIdentidad() {
  const { usuario } = useAuth()
  return useQuery({
    queryKey: ['identidad', usuario?.id],
    enabled: Boolean(usuario),
    // TODO: S2 — conectar con GET /api/v1/perfiles/me
    queryFn: () =>
      // Sin el puente, la identidad es solo la de la cuenta real: todavia no
      // hay endpoint que diga de que perfil es dueña.
      simulado(
        async (): Promise<Identidad> => {
          const actor = actorDemo()
          return {
            usuarioId: actor.id,
            perfilJugadorId: perfilDeUsuario(actor.id)?.id,
            perfilEquipoId: perfilesEquipo.find((e) => e.usuarioId === actor.id)?.id,
          }
        },
        { usuarioId: usuario!.id },
      ),
  })
}
