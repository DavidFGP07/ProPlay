import { TRANSICIONES_POSTULACION, type EstadoPostulacion } from '@proplay/shared'
import { Button } from '@/components/ui'
import { codigoError } from '@/api/errores'
import { useCambiarEstadoPostulacion } from '@/api/ofertas'
import { useToast } from '@/context/ToastContext'
import { es } from '@/i18n/es'

const t = es.postulacionesRecibidas

// RF-10 · Botones con los que el equipo dueño avanza o rechaza una postulación
// (PATCH /api/v1/ofertas/postulaciones/:id), según TRANSICIONES_POSTULACION.
// Los comparten las postulaciones recibidas, el ranking de candidatos y el
// detalle del candidato. Un estado final no tiene botones.
export function AccionesPostulacion({
  postulacion,
  nombre,
}: {
  postulacion: { id: string; estado: EstadoPostulacion }
  /** Nombre del jugador, para la etiqueta accesible de cada botón. */
  nombre: string
}) {
  const { notificar } = useToast()
  const cambio = useCambiarEstadoPostulacion()
  const siguientes: readonly EstadoPostulacion[] = TRANSICIONES_POSTULACION[postulacion.estado]

  const mover = async (estado: EstadoPostulacion) => {
    try {
      await cambio.mutateAsync({ id: postulacion.id, estado })
      notificar(t.cambiada(nombre, es.estadoPostulacion[estado]))
    } catch (e) {
      const codigo = codigoError(e)
      notificar(
        codigo === 'OFERTA_NO_ABIERTA'
          ? t.congelada
          : (es.gestionOferta.errores[codigo ?? ''] ?? es.comun.errores.generico),
        'error',
      )
    }
  }

  return (
    <>
      {siguientes.map((estado) => {
        const accion = t.acciones[estado] ?? es.estadoPostulacion[estado]
        return (
          <Button
            key={estado}
            tamano="sm"
            variante={estado === 'RECHAZADA' ? 'peligro' : estado === 'ACEPTADA' ? 'exito' : 'secundario'}
            disabled={cambio.isPending}
            aria-label={t.accionPara(accion, nombre)}
            onClick={() => void mover(estado)}
          >
            {accion}
          </Button>
        )
      })}
    </>
  )
}
