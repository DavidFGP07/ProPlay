import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import {
  MAX_PAGE_SIZE,
  miPostulacionSchema,
  ofertaPropiaSchema,
  ofertaSchema,
  paginadoSchema,
  postulacionRecibidaSchema,
  postulacionSchema,
  type ActualizarOfertaInput,
  type CrearOfertaInput,
  type CrearPostulacionInput,
  type EstadoOferta,
  type EstadoPostulacion,
  type ListarOfertasQuery,
} from '@proplay/shared'
import { api } from '@/api/client'
import { listarOfertas, listarPostulaciones } from '@/mocks/api'
import { simulado } from '@/api/demo'
import type { Oferta } from '@/mocks/modelos'

/*
 * Ofertas y postulaciones: API real, sin puente de demostracion. Las respuestas se leen con los esquemas de @proplay/shared,
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

// --------------------------------------------------------------- equipo

const ofertasPropiasSchema = paginadoSchema(ofertaPropiaSchema)
const postulacionesRecibidasSchema = z.array(postulacionRecibidaSchema)

/**
 * Tras un cambio de ofertas o postulaciones, se refresca todo lo de ese
 * recurso y el ranking de candidatos, que depende de los dos (los pesos de la
 * oferta y el estado de cada postulación).
 */
function useInvalidarOfertas() {
  const cliente = useQueryClient()
  return () =>
    Promise.all([
      cliente.invalidateQueries({ queryKey: ['ofertas'] }),
      cliente.invalidateQueries({ queryKey: ['postulaciones'] }),
      cliente.invalidateQueries({ queryKey: ['matching'] }),
    ])
}

// RF-07 · Ofertas del equipo en sesion, en cualquier estado
export function useMisOfertas(habilitado = true) {
  return useQuery({
    queryKey: ['ofertas', 'mias'],
    enabled: habilitado,
    queryFn: async () => {
      const { data } = await api.get('/ofertas/me', { params: { pageSize: MAX_PAGE_SIZE } })
      return ofertasPropiasSchema.parse(data)
    },
  })
}

// RF-07 · Crear una oferta con los pesos de las cinco dimensiones
export function useCrearOferta() {
  const invalidar = useInvalidarOfertas()
  return useMutation({
    mutationFn: async (datos: CrearOfertaInput) => {
      const { data } = await api.post('/ofertas', datos)
      return ofertaSchema.parse(data)
    },
    onSuccess: invalidar,
  })
}

// RF-07 · Editar una oferta propia
export function useActualizarOferta() {
  const invalidar = useInvalidarOfertas()
  return useMutation({
    mutationFn: async ({ id, ...datos }: ActualizarOfertaInput & { id: string }) => {
      const { data } = await api.patch(`/ofertas/${id}`, datos)
      return ofertaSchema.parse(data)
    },
    onSuccess: invalidar,
  })
}

// RF-07 · Publicar, cubrir o cerrar una oferta propia
export function useCambiarEstadoOferta() {
  const invalidar = useInvalidarOfertas()
  return useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: EstadoOferta }) => {
      const { data } = await api.patch(`/ofertas/${id}/estado`, { estado })
      return ofertaSchema.parse(data)
    },
    onSuccess: invalidar,
  })
}

// RF-10 · Postulaciones recibidas por una oferta (equipo dueño, scout o admin)
export function usePostulacionesRecibidas(ofertaId: string, habilitado = true) {
  return useQuery({
    queryKey: ['postulaciones', 'oferta', ofertaId],
    enabled: habilitado,
    queryFn: async () => {
      const { data } = await api.get(`/ofertas/${ofertaId}/postulaciones`)
      return postulacionesRecibidasSchema.parse(data)
    },
  })
}

// RF-10 · Avanzar o rechazar una postulacion recibida
export function useCambiarEstadoPostulacion() {
  const invalidar = useInvalidarOfertas()
  return useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: EstadoPostulacion }) => {
      const { data } = await api.patch(`/ofertas/postulaciones/${id}`, { estado })
      return postulacionSchema.parse(data)
    },
    onSuccess: invalidar,
  })
}

/*
 * Indicadores y recomendaciones del panel del equipo: siguen simulados hasta
 * la analitica y el motor de matching.
 */

// RF-13 · Vacantes de la simulacion, para los indicadores del panel
export function useVacantes(estado?: Oferta['estado']) {
  return useQuery({
    queryKey: ['ofertas', 'demo', { estado }],
    // TODO: S4 — sustituir por los datos de la analitica (tarea 4.10)
    queryFn: () => simulado(() => listarOfertas(estado), []),
  })
}

// RF-13 · Postulaciones de la simulacion, para los indicadores del panel
export function usePostulaciones() {
  return useQuery({
    queryKey: ['postulaciones', 'demo'],
    // TODO: S4 — sustituir por los datos de la analitica (tarea 4.10)
    queryFn: () => simulado(() => listarPostulaciones(), []),
  })
}
