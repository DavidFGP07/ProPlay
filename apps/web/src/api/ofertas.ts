import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import {
  miPostulacionSchema,
  ofertaSchema,
  paginadoSchema,
  postulacionSchema,
  type CrearPostulacionInput,
  type ListarOfertasQuery,
} from '@proplay/shared'
import { api } from '@/api/client'
import {
  actualizarEstadoPostulacion,
  cerrarOferta,
  crearOferta,
  listarOfertas,
  listarPostulaciones,
} from '@/mocks/api'
import { actorDemo } from '@/mocks/sesion'
import { simulado, useMutacionSimulada } from '@/api/demo'
import type { Oferta, Postulacion } from '@/mocks/modelos'

/*
 * Ofertas y postulaciones del lado del jugador: API real, sin puente de
 * demostracion. Las respuestas se leen con los esquemas de @proplay/shared,
 * que convierten las fechas.
 */

const ofertasPaginadasSchema = paginadoSchema(ofertaSchema)
const misPostulacionesSchema = z.array(miPostulacionSchema)

const CLAVE_MIS_POSTULACIONES = ['postulaciones', 'me'] as const

/** Filtros y pagina del listado de ofertas abiertas. */
export type FiltrosOfertas = ListarOfertasQuery & { page: number }

// RF-07 · Ofertas abiertas, paginadas y filtradas por rol, departamento y modalidad
export function useOfertas(filtros: FiltrosOfertas) {
  return useQuery({
    queryKey: ['ofertas', 'abiertas', filtros],
    // La pagina anterior se mantiene en pantalla mientras llega la siguiente.
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data } = await api.get('/ofertas', { params: filtros })
      return ofertasPaginadasSchema.parse(data)
    },
  })
}

// RF-07 · Detalle de una oferta. Un borrador ajeno o un id inexistente dan 404.
export function useOferta(id: string | undefined) {
  return useQuery({
    queryKey: ['ofertas', 'detalle', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data } = await api.get(`/ofertas/${id}`)
      return ofertaSchema.parse(data)
    },
  })
}

// RF-10 · Postulaciones del jugador en sesion, con su oferta
export function useMisPostulaciones(habilitado = true) {
  return useQuery({
    queryKey: CLAVE_MIS_POSTULACIONES,
    enabled: habilitado,
    queryFn: async () => {
      const { data } = await api.get('/ofertas/postulaciones/me')
      return misPostulacionesSchema.parse(data)
    },
  })
}

// RF-10 · Postularse a una oferta abierta
export function usePostular() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: async ({ ofertaId, ...datos }: CrearPostulacionInput & { ofertaId: string }) => {
      const { data } = await api.post(`/ofertas/${ofertaId}/postulaciones`, datos)
      return postulacionSchema.parse(data)
    },
    onSuccess: () => cliente.invalidateQueries({ queryKey: CLAVE_MIS_POSTULACIONES }),
  })
}

/*
 * Lado del equipo: sigue simulado hasta conectar el panel del equipo y las
 * postulaciones recibidas (PR de las vistas del equipo).
 */

// RF-07 · Oportunidades publicadas por las organizaciones
export function useVacantes(estado?: Oferta['estado']) {
  return useQuery({
    queryKey: ['ofertas', 'demo', { estado }],
    // TODO: S3 — conectar con GET /api/v1/ofertas
    queryFn: () => simulado(() => listarOfertas(estado), []),
  })
}

// RF-07 · Publicar una oferta
export function useCrearOferta() {
  return useMutacionSimulada((datos: Omit<Oferta, 'id' | 'publicadaEn' | 'estado'>) =>
    // TODO: S3 — conectar con POST /api/v1/ofertas
    crearOferta(datos, actorDemo()),
  )
}

// RF-07 · Cerrar una oferta propia
export function useCerrarOferta() {
  return useMutacionSimulada((id: string) =>
    // TODO: S3 — conectar con PATCH /api/v1/ofertas/:id
    cerrarOferta(id, actorDemo()),
  )
}

// RF-10 · Postulaciones registradas
export function usePostulaciones() {
  return useQuery({
    queryKey: ['postulaciones', 'demo'],
    // TODO: S3 — conectar con GET /api/v1/ofertas/:id/postulaciones
    queryFn: () => simulado(() => listarPostulaciones(), []),
  })
}

// RF-10 · Avanzar el estado de una postulacion recibida
export function useActualizarEstadoPostulacion() {
  return useMutacionSimulada(({ id, estado }: { id: string; estado: Postulacion['estado'] }) =>
    // TODO: S3 — conectar con PATCH /api/v1/ofertas/postulaciones/:id
    actualizarEstadoPostulacion(id, estado, actorDemo()),
  )
}
