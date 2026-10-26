import type { EstadoOferta, Rol } from '@proplay/shared'
import type { EstadoPostulacionPrototipo, PlataformaJuego } from '@/mocks/modelos'

/**
 * Textos visibles de la interfaz (CLAUDE.md §6). Las vistas heredadas del
 * prototipo aun llevan sus textos en el JSX; todo texto nuevo entra aqui.
 */
export const es = {
  demo: {
    titulo: 'Datos de demostracion',
    detalle: (persona: string) =>
      `Lo que ves en esta seccion son datos de ejemplo de ${persona}, no de tu cuenta. Solo tu sesion es real.`,
  },
  noEncontrada: {
    titulo: 'Pagina no encontrada',
    detalle: 'La direccion que buscas no existe o ya no esta disponible.',
    volver: 'Volver al inicio',
  },
  /** Etiquetas de los enums del contrato: la interfaz nunca muestra el valor crudo. */
  rol: {
    JUGADOR: 'Jugador',
    EQUIPO: 'Equipo',
    SCOUT: 'Scout',
    ADMIN: 'Administrador',
  } satisfies Record<Rol, string>,
  estadoOferta: {
    BORRADOR: 'Borrador',
    ABIERTA: 'Abierta',
    CERRADA: 'Cerrada',
  } satisfies Record<EstadoOferta, string>,
  estadoPostulacion: {
    ENVIADA: 'Recibida',
    EN_REVISION: 'En revision',
    ENTREVISTA: 'Entrevista',
    ACEPTADA: 'Aceptada',
    RECHAZADA: 'Rechazada',
  } satisfies Record<EstadoPostulacionPrototipo, string>,
  plataforma: {
    RIOT: 'Riot Games',
    STEAM: 'Steam',
  } satisfies Record<PlataformaJuego, string>,
} as const
