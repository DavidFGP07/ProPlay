import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PerfilPropioResponse, UbicacionJugadorInput } from '@proplay/shared'
import { api } from '@/api/client'
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
import { simulado, useMutacionSimulada } from '@/api/demo'
import type { ConfiguracionPrivacidad, PlataformaJuego } from '@/mocks/modelos'

export type { CamposPerfil }

const CLAVE_PERFIL_PROPIO = ['perfiles', 'me'] as const

// RF-05 · Perfil propio del usuario en sesion. Habla con la API real, sin puente
// de demostracion: scout y administrador reciben { tipo: null, perfil: null }.
export function usePerfilPropio(habilitado = true) {
  return useQuery({
    queryKey: CLAVE_PERFIL_PROPIO,
    enabled: habilitado,
    queryFn: async () => {
      const { data } = await api.get<PerfilPropioResponse>('/perfiles/me')
      return data
    },
  })
}

// RF-05 · RF-09 · Ubicacion del jugador (insumo de la dimension geografica). API real.
export function useActualizarUbicacion() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: async (datos: UbicacionJugadorInput) => {
      const { data } = await api.patch<PerfilPropioResponse>('/perfiles/jugador', datos)
      return data
    },
    // El PATCH responde con la misma forma que GET /perfiles/me.
    onSuccess: (data) => cliente.setQueryData(CLAVE_PERFIL_PROPIO, data),
  })
}

// RF-05 · Perfil profesional del jugador con estadisticas, cuentas y habilidades
export function usePerfil(id: string | undefined) {
  return useQuery({
    queryKey: ['perfiles', id],
    enabled: Boolean(id),
    // TODO: S2 — conectar con GET /api/v1/perfiles/:id
    queryFn: () => simulado(() => obtenerPerfil(id!), null),
  })
}

// RF-07 · Organizaciones registradas
export function useEquipos() {
  return useQuery({
    queryKey: ['perfiles', 'equipos'],
    // TODO: S3 — conectar con GET /api/v1/perfiles?tipo=equipo
    queryFn: () => simulado(async () => perfilesEquipo, []),
  })
}

// RF-05 · Edicion del perfil propio
export function useActualizarPerfil() {
  return useMutacionSimulada(({ perfilId, cambios }: { perfilId: string; cambios: CamposPerfil }) =>
    // TODO: S2 — conectar con PATCH /api/v1/perfiles/jugador
    actualizarPerfil(perfilId, cambios, actorDemo()),
  )
}

// RF-06 · Catalogo de habilidades
export function useHabilidades() {
  return useQuery({
    queryKey: ['perfiles', 'habilidades'],
    // TODO: S2 — conectar con GET /api/v1/perfiles/habilidades
    queryFn: () => simulado(listarHabilidades, []),
    staleTime: Infinity,
  })
}

// RF-06 · Declarar una habilidad con su nivel
export function useRegistrarHabilidad() {
  return useMutacionSimulada(
    ({ perfilId, habilidadId, nivel }: { perfilId: string; habilidadId: string; nivel: number }) =>
      // TODO: S2 — conectar con POST /api/v1/perfiles/habilidades
      registrarHabilidad(perfilId, habilidadId, nivel, actorDemo()),
  )
}

// RF-06 · Retirar una habilidad declarada
export function useEliminarHabilidad() {
  return useMutacionSimulada((habilidadJugadorId: string) =>
    // TODO: S2 — conectar con DELETE /api/v1/perfiles/habilidades/:id
    eliminarHabilidad(habilidadJugadorId, actorDemo()),
  )
}

// RF-06 · Endorsement de la habilidad de otro jugador
export function useEndosarHabilidad() {
  return useMutacionSimulada(
    ({ habilidadJugadorId, comentario }: { habilidadJugadorId: string; comentario: string }) =>
      // TODO: S2 — conectar con POST /api/v1/perfiles/endorsements
      endosarHabilidad(habilidadJugadorId, actorDemo(), comentario),
  )
}

// RF-02 · Vincular una cuenta de juego por OAuth 2.0
export function useVincularCuenta() {
  return useMutacionSimulada(
    ({
      perfilId,
      plataforma,
      identificador,
    }: {
      perfilId: string
      plataforma: PlataformaJuego
      identificador: string
    }) =>
      // TODO: S2 — conectar con POST /api/v1/perfiles/cuentas-gaming
      vincularCuenta(perfilId, plataforma, identificador, actorDemo()),
  )
}

// RF-02 · Desvincular una cuenta de juego
export function useDesvincularCuenta() {
  return useMutacionSimulada((cuentaId: string) =>
    // TODO: S2 — conectar con DELETE /api/v1/perfiles/cuentas-gaming/:id
    desvincularCuenta(cuentaId, actorDemo()),
  )
}

// RNF-05 · Preferencias de privacidad del usuario en sesion
export function usePrivacidad() {
  return useQuery({
    queryKey: ['perfiles', 'privacidad'],
    // TODO: S2 — conectar con GET /api/v1/usuarios/me/privacidad
    queryFn: () => simulado(() => obtenerPrivacidad(actorDemo().id), null),
  })
}

// RNF-05 · Actualizar las preferencias de privacidad
export function useActualizarPrivacidad() {
  return useMutacionSimulada((cambios: Partial<Omit<ConfiguracionPrivacidad, 'usuarioId'>>) => {
    const actor = actorDemo()
    // TODO: S2 — conectar con PATCH /api/v1/usuarios/me/privacidad
    return actualizarPrivacidad(actor.id, cambios, actor)
  })
}
