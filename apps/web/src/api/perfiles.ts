import { useQuery } from '@tanstack/react-query'
import {
  actualizarPerfil,
  actualizarPrivacidad,
  desvincularCuenta,
  eliminarHabilidad,
  endosarHabilidad,
  listarHabilidades,
  obtenerPerfil,
  obtenerPrivacidad,
  registrarHabilidad,
  vincularCuenta,
  type CamposPerfil,
} from '@/mocks/api'
import { perfilesEquipo } from '@/mocks/seed'
import { actorDemo } from '@/mocks/sesion'
import { useMutacion } from '@/api/queryClient'
import type { ConfiguracionPrivacidad } from '@/types'

export type { CamposPerfil }

// RF-05 · Perfil profesional del jugador con estadisticas, cuentas y habilidades
export function usePerfil(id: string | undefined) {
  return useQuery({
    queryKey: ['perfiles', id],
    enabled: Boolean(id),
    // TODO: S2 — conectar con GET /api/v1/perfiles/:id
    queryFn: () => obtenerPerfil(id!),
  })
}

// RF-07 · Organizaciones registradas
export function useEquipos() {
  return useQuery({
    queryKey: ['perfiles', 'equipos'],
    // TODO: S3 — conectar con GET /api/v1/perfiles?tipo=equipo
    queryFn: async () => perfilesEquipo,
  })
}

// RF-05 · Edicion del perfil propio
export function useActualizarPerfil() {
  return useMutacion(({ perfilId, cambios }: { perfilId: string; cambios: CamposPerfil }) =>
    // TODO: S2 — conectar con PUT /api/v1/perfiles/jugador
    actualizarPerfil(perfilId, cambios, actorDemo()),
  )
}

// RF-06 · Catalogo de habilidades
export function useHabilidades() {
  return useQuery({
    queryKey: ['perfiles', 'habilidades'],
    // TODO: S2 — conectar con GET /api/v1/perfiles/habilidades
    queryFn: listarHabilidades,
    staleTime: Infinity,
  })
}

// RF-06 · Declarar una habilidad con su nivel
export function useRegistrarHabilidad() {
  return useMutacion(
    ({ perfilId, habilidadId, nivel }: { perfilId: string; habilidadId: string; nivel: number }) =>
      // TODO: S2 — conectar con POST /api/v1/perfiles/habilidades
      registrarHabilidad(perfilId, habilidadId, nivel, actorDemo()),
  )
}

// RF-06 · Retirar una habilidad declarada
export function useEliminarHabilidad() {
  return useMutacion((habilidadJugadorId: string) =>
    // TODO: S2 — conectar con DELETE /api/v1/perfiles/habilidades/:id
    eliminarHabilidad(habilidadJugadorId, actorDemo()),
  )
}

// RF-06 · Endorsement de la habilidad de otro jugador
export function useEndosarHabilidad() {
  return useMutacion(
    ({ habilidadJugadorId, comentario }: { habilidadJugadorId: string; comentario: string }) =>
      // TODO: S2 — conectar con POST /api/v1/perfiles/endorsements
      endosarHabilidad(habilidadJugadorId, actorDemo(), comentario),
  )
}

// RF-02 · Vincular una cuenta de juego por OAuth 2.0
export function useVincularCuenta() {
  return useMutacion(
    ({
      perfilId,
      plataforma,
      identificador,
    }: {
      perfilId: string
      plataforma: 'Riot Games' | 'Steam'
      identificador: string
    }) =>
      // TODO: S2 — conectar con POST /api/v1/perfiles/cuentas-gaming
      vincularCuenta(perfilId, plataforma, identificador, actorDemo()),
  )
}

// RF-02 · Desvincular una cuenta de juego
export function useDesvincularCuenta() {
  return useMutacion((cuentaId: string) =>
    // TODO: S2 — conectar con DELETE /api/v1/perfiles/cuentas-gaming/:id
    desvincularCuenta(cuentaId, actorDemo()),
  )
}

// RNF-05 · Preferencias de privacidad del usuario en sesion
export function usePrivacidad() {
  return useQuery({
    queryKey: ['perfiles', 'privacidad'],
    // TODO: S2 — conectar con GET /api/v1/usuarios/me/privacidad
    queryFn: () => obtenerPrivacidad(actorDemo().id),
  })
}

// RNF-05 · Actualizar las preferencias de privacidad
export function useActualizarPrivacidad() {
  return useMutacion((cambios: Partial<Omit<ConfiguracionPrivacidad, 'usuarioId'>>) => {
    const actor = actorDemo()
    // TODO: S2 — conectar con PATCH /api/v1/usuarios/me/privacidad
    return actualizarPrivacidad(actor.id, cambios, actor)
  })
}
