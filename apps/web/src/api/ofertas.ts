import { useQuery } from '@tanstack/react-query'
import {
  actualizarEstadoPostulacion,
  cerrarOferta,
  crearOferta,
  listarMisPostulaciones,
  listarOfertas,
  listarPostulaciones,
  obtenerEquipoDeOferta,
  postular,
  type PostulacionConOferta,
} from '@/mocks/api'
import { actorDemo } from '@/mocks/sesion'
import { useMutacion } from '@/api/queryClient'
import type { Oferta, Postulacion } from '@/types'

export type { PostulacionConOferta }

// RF-07 · Oportunidades publicadas por las organizaciones
export function useVacantes(estado?: Oferta['estado']) {
  return useQuery({
    queryKey: ['ofertas', { estado }],
    // TODO: S3 — conectar con GET /api/v1/ofertas
    queryFn: () => listarOfertas(estado),
  })
}

// RF-07 · Detalle de una oferta con la organizacion que la publica
export function useVacante(id: string | undefined) {
  return useQuery({
    queryKey: ['ofertas', id],
    enabled: Boolean(id),
    // TODO: S3 — conectar con GET /api/v1/ofertas/:id
    queryFn: async () => {
      const oferta = (await listarOfertas()).find((o) => o.id === id) ?? null
      return { oferta, equipo: oferta ? (obtenerEquipoDeOferta(oferta.id) ?? null) : null }
    },
  })
}

// RF-07 · Publicar una oferta
export function useCrearOferta() {
  return useMutacion((datos: Omit<Oferta, 'id' | 'publicadaEn' | 'estado'>) =>
    // TODO: S3 — conectar con POST /api/v1/ofertas
    crearOferta(datos, actorDemo()),
  )
}

// RF-07 · Cerrar una oferta propia
export function useCerrarOferta() {
  return useMutacion((id: string) =>
    // TODO: S3 — conectar con PUT /api/v1/ofertas/:id
    cerrarOferta(id, actorDemo()),
  )
}

// RF-10 · Postulaciones registradas
export function usePostulaciones() {
  return useQuery({
    queryKey: ['postulaciones'],
    // TODO: S3 — conectar con GET /api/v1/ofertas/:id/postulaciones
    queryFn: () => listarPostulaciones(),
  })
}

// RF-10 · Postulaciones enviadas por el jugador en sesion
export function useMisPostulaciones(perfilId: string | undefined) {
  return useQuery({
    queryKey: ['postulaciones', 'mias', perfilId],
    enabled: Boolean(perfilId),
    // TODO: S3 — conectar con GET /api/v1/ofertas/postulaciones/me
    queryFn: () => listarMisPostulaciones(perfilId!),
  })
}

// RF-10 · Postularse a una oferta
export function usePostular() {
  return useMutacion(({ ofertaId, mensaje }: { ofertaId: string; mensaje: string }) =>
    // TODO: S3 — conectar con POST /api/v1/ofertas/:id/postulaciones
    postular(ofertaId, mensaje, actorDemo()),
  )
}

// RF-10 · Avanzar el estado de una postulacion recibida
export function useActualizarEstadoPostulacion() {
  return useMutacion(({ id, estado }: { id: string; estado: Postulacion['estado'] }) =>
    // TODO: S3 — conectar con PATCH /api/v1/ofertas/postulaciones/:id
    actualizarEstadoPostulacion(id, estado, actorDemo()),
  )
}
