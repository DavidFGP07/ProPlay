import type { Notificacion } from '@proplay/shared'
import { es } from '@/i18n/es'

const t = es.notificaciones

/**
 * RF-12 · Texto y enlace de una notificación, a partir de su tipo y su
 * `payload` (la API guarda datos, no texto). El equipo va al detalle de la
 * oferta, donde están las postulaciones recibidas; el jugador, a sus
 * postulaciones en Mi perfil.
 */
export function describirNotificacion(n: Notificacion): { texto: string; enlace: string } {
  switch (n.tipo) {
    case 'NUEVA_POSTULACION':
      return {
        texto: t.nuevaPostulacion(n.payload.ofertaTitulo, n.payload.jugadorNombre),
        enlace: `/vacantes/${n.payload.ofertaId}`,
      }
    case 'POSTULACION_ACTUALIZADA':
      return {
        texto:
          n.payload.origen === 'CIERRE_OFERTA'
            ? t.cierreOferta(n.payload.ofertaTitulo)
            : t.postulacionActualizada(n.payload.ofertaTitulo, es.estadoPostulacion[n.payload.estado]),
        enlace: '/mi-perfil?pestana=postulaciones',
      }
  }
}

const relativo = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })

/** «hace 5 minutos», «ayer», «hace 3 días»; más de un mes, la fecha. */
export function haceCuanto(fecha: Date, ahora = Date.now()): string {
  const minutos = Math.round((fecha.getTime() - ahora) / 60_000)
  if (minutos > -1) return t.ahora
  if (minutos > -60) return relativo.format(minutos, 'minute')
  const horas = Math.round(minutos / 60)
  if (horas > -24) return relativo.format(horas, 'hour')
  const dias = Math.round(horas / 24)
  if (dias > -30) return relativo.format(dias, 'day')
  return fecha.toLocaleDateString('es-CO')
}
