import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  contadorNotificacionesSchema,
  notificacionesMarcadasSchema,
  notificacionesSchema,
} from '@proplay/shared'
import { api } from '@/api/client'

/*
 * Notificaciones dentro de la app (RF-12): API real, sin puente de
 * demostracion. Sin tiempo real: la campana consulta el contador cada 60 s, y
 * la lista mientras el panel esta abierto.
 */

const INTERVALO = 60_000

// RF-12 · Numero de notificaciones sin leer (la campana de la cabecera)
export function useContadorNotificaciones() {
  return useQuery({
    queryKey: ['notificaciones', 'contador'],
    refetchInterval: INTERVALO,
    queryFn: async () => {
      const { data } = await api.get('/notificaciones/contador')
      return contadorNotificacionesSchema.parse(data)
    },
  })
}

// RF-12 · Las ultimas notificaciones, de la mas reciente a la mas antigua
export function useNotificacionesRecientes(habilitado: boolean) {
  return useQuery({
    queryKey: ['notificaciones', 'recientes'],
    enabled: habilitado,
    refetchInterval: habilitado ? INTERVALO : false,
    queryFn: async () => {
      const { data } = await api.get('/notificaciones', { params: { pageSize: 10 } })
      return notificacionesSchema.parse(data)
    },
  })
}

function useMarcar(mutacion: (ids?: string[]) => Promise<unknown>) {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: mutacion,
    onSuccess: () => cliente.invalidateQueries({ queryKey: ['notificaciones'] }),
  })
}

// RF-12 · Marcar como leidas las indicadas (al abrir una, esa)
export function useMarcarLeidas() {
  return useMarcar(async (ids = []) => {
    const { data } = await api.post('/notificaciones/leidas', { ids })
    return notificacionesMarcadasSchema.parse(data)
  })
}

// RF-12 · Marcar todas como leidas
export function useMarcarTodasLeidas() {
  return useMarcar(async () => {
    const { data } = await api.post('/notificaciones/leidas/todas')
    return notificacionesMarcadasSchema.parse(data)
  })
}
