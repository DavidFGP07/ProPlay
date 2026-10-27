import type { Departamento, EstadoOferta, Macrorregion, Rol } from '@proplay/shared'
import type { EstadoPostulacionPrototipo, PlataformaJuego } from '@/mocks/modelos'

/**
 * Textos visibles de la interfaz (CLAUDE.md §6). Las vistas heredadas del
 * prototipo aun llevan sus textos en el JSX; todo texto nuevo entra aqui.
 */
export const es = {
  comun: {
    reintentar: 'Reintentar',
    errores: {
      demasiadosIntentos:
        'Demasiados intentos. Espera unos minutos antes de volver a intentarlo.',
      generico: 'No pudimos guardar los cambios. Revisa tu conexion e intentalo de nuevo.',
    },
  },
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
    },
  },
  ubicacion: {
    titulo: 'Ubicación',
    subtitulo:
      'Tu país y, en Colombia, tu departamento. Los equipos la usan para calcular la compatibilidad geográfica.',
    datoReal: 'Dato real de tu cuenta',
    /** Explica la marca: la tarjeta convive con los datos de demostración de otra persona. */
    datoRealDetalle:
      'Esta tarjeta guarda en tu cuenta. El resto de la vista sigue mostrando datos de ejemplo.',
    completaTitulo: 'Completa tu ubicación',
    completaDetalle:
      'Sin ella, el matching no puede calcular la dimensión geográfica de tu compatibilidad con las ofertas.',
    actual: (lugar: string) => `Ubicación guardada: ${lugar}`,
    pais: 'País',
    departamento: 'Departamento',
    seleccionaPais: 'Selecciona tu país',
    seleccionaDepartamento: 'Selecciona tu departamento',
    pistaDepartamento: 'Solo se pide en Colombia.',
    relocalizar: 'Dispuesto a relocalizarme',
    relocalizarDetalle:
      'Mejora la dimensión geográfica cuando la oferta pide una ubicación distinta de la tuya.',
    guardar: 'Guardar ubicación',
    exito: 'Ubicación guardada.',
    errorCarga: 'No pudimos cargar tu ubicación.',
    cargando: 'Cargando tu ubicación',
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
  departamento: {
    AMAZONAS: 'Amazonas',
    ANTIOQUIA: 'Antioquia',
    ARAUCA: 'Arauca',
    ATLANTICO: 'Atlántico',
    BOGOTA_DC: 'Bogotá D. C.',
    BOLIVAR: 'Bolívar',
    BOYACA: 'Boyacá',
    CALDAS: 'Caldas',
    CAQUETA: 'Caquetá',
    CASANARE: 'Casanare',
    CAUCA: 'Cauca',
    CESAR: 'Cesar',
    CHOCO: 'Chocó',
    CORDOBA: 'Córdoba',
    CUNDINAMARCA: 'Cundinamarca',
    GUAINIA: 'Guainía',
    GUAVIARE: 'Guaviare',
    HUILA: 'Huila',
    LA_GUAJIRA: 'La Guajira',
    MAGDALENA: 'Magdalena',
    META: 'Meta',
    NARINO: 'Nariño',
    NORTE_DE_SANTANDER: 'Norte de Santander',
    PUTUMAYO: 'Putumayo',
    QUINDIO: 'Quindío',
    RISARALDA: 'Risaralda',
    SAN_ANDRES: 'San Andrés, Providencia y Santa Catalina',
    SANTANDER: 'Santander',
    SUCRE: 'Sucre',
    TOLIMA: 'Tolima',
    VALLE_DEL_CAUCA: 'Valle del Cauca',
    VAUPES: 'Vaupés',
    VICHADA: 'Vichada',
  } satisfies Record<Departamento, string>,
  macrorregion: {
    CARIBE: 'Caribe colombiano',
    ANDINA: 'Región Andina',
    PACIFICA: 'Región Pacífica',
    ORINOQUIA: 'Orinoquía',
    AMAZONIA: 'Amazonía',
  } satisfies Record<Macrorregion, string>,
  plataforma: {
    RIOT: 'Riot Games',
    STEAM: 'Steam',
  } satisfies Record<PlataformaJuego, string>,
} as const
