import {
  ESTADOS_POSTULACION,
  FECHA_POR_ESTADO_POSTULACION,
  type EstadoPostulacion,
  type Postulacion,
} from '@proplay/shared'

/** Tono de la insignia de cada estado de la postulación. */
export const TONO_ESTADO_POSTULACION = {
  ENVIADA: 'neutro',
  EN_REVISION: 'cian',
  ENTREVISTA: 'violeta',
  ACEPTADA: 'verde',
  RECHAZADA: 'rojo',
} as const satisfies Record<EstadoPostulacion, string>

/** Pasos alcanzados, en el orden del embudo, con la fecha de cada uno. */
export function recorrido(postulacion: Postulacion): { estado: EstadoPostulacion; fecha: Date }[] {
  return ESTADOS_POSTULACION.flatMap((estado) => {
    const fecha = postulacion[FECHA_POR_ESTADO_POSTULACION[estado]]
    return fecha ? [{ estado, fecha }] : []
  })
}
