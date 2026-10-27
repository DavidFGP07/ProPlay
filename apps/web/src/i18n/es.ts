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
  registro: {
    mayorEdad: 'Declaro que soy mayor de 18 años.',
    /** La casilla de aceptacion enlaza los dos documentos (se abren en otra pestaña). */
    acepto: 'He leído y acepto el',
    avisoPrivacidad: 'aviso de privacidad',
    y: 'y los',
    terminos: 'términos de uso',
    autorizo:
      'de ProPlay, y autorizo el tratamiento de mis datos personales conforme a la Ley 1581 de 2012.',
    nuevaPestana: '(se abre en una pestaña nueva)',
  },
  legal: {
    etiqueta: 'Ley 1581 de 2012',
    indice: 'Contenido',
    version: (version: string, vigencia: string) => `Versión ${version} · vigente desde ${vigencia}`,
    volverLogin: 'Volver al inicio de sesión',
    volverApp: 'Volver a ProPlay',
    enlace: 'Aviso de privacidad y términos de uso',
  },
  noEncontrada: {
    titulo: 'Pagina no encontrada',
    detalle: 'La direccion que buscas no existe o ya no esta disponible.',
    volver: 'Volver al inicio',
  },
  cuenta: {
    menu: 'Mi cuenta',
    titulo: 'Mi cuenta',
    subtitulo: 'Tus datos de acceso a ProPlay.',
    reintentar: 'Reintentar',
    datos: {
      titulo: 'Datos de la cuenta',
      subtitulo: 'El correo identifica tu cuenta y no se puede cambiar desde aqui.',
      nombre: 'Nombre',
      correo: 'Correo electronico',
      rol: 'Rol',
      guardar: 'Guardar nombre',
      exito: 'Nombre actualizado.',
      sinCambios: 'No has cambiado el nombre.',
    },
    contrasena: {
      titulo: 'Cambiar contraseña',
      subtitulo:
        'Al cambiarla se cierran tus sesiones en otros dispositivos; esta sigue abierta.',
      actual: 'Contraseña actual',
      nueva: 'Contraseña nueva',
      confirmacion: 'Confirma la contraseña nueva',
      pista: 'Minimo 8 caracteres, con al menos una letra y un numero.',
      guardar: 'Cambiar contraseña',
      exito: 'Contraseña actualizada. Cerramos tus sesiones en otros dispositivos.',
    },
    errores: {
      confirmacion: 'Las contraseñas no coinciden',
      actualInvalida: 'La contraseña actual no es correcta',
      demasiadosIntentos:
        'Demasiados intentos. Espera unos minutos antes de volver a intentarlo.',
      generico: 'No pudimos guardar los cambios. Revisa tu conexion e intentalo de nuevo.',
    },
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
