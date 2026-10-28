import type {
  Departamento,
  EstadoOferta,
  Macrorregion,
  Plataforma,
  Rol,
} from '@proplay/shared'
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
    /** Marca de una sección simulada dentro de una vista que ya tiene datos reales. */
    seccion: (persona: string) => `Ejemplo de ${persona}, no de tu cuenta.`,
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
  marcoPublico: {
    lema: 'Scouting de talento eSports',
    ingresar: 'Iniciar sesión',
  },
  perfilPublico: {
    cargando: 'Cargando el perfil',
    noEncontrado: 'Perfil no encontrado',
    noEncontradoDetalle: 'El jugador no existe o su cuenta ya no está activa.',
    irInicio: 'Ir al inicio',
    irIngreso: 'Ir a ProPlay',
    error: 'No pudimos cargar el perfil.',
    errorDetalle: 'Revisa tu conexión e inténtalo de nuevo.',
    demasiadasConsultas: 'Has consultado demasiados perfiles. Espera unos minutos.',
    riotVerificada: 'Cuenta de Riot verificada',
    sinRiot: 'Sin cuenta de Riot vinculada',
    sinUbicacion: 'Ubicación no indicada',
    sinBio: 'Este jugador todavía no ha escrito su presentación.',
    cuentasTitulo: 'Cuentas verificadas',
    cuentasSubtitulo: 'Vinculadas por OAuth 2.0: la plataforma confirma que la cuenta es suya.',
    verificadaEl: (fecha: string) => `Verificada el ${fecha}`,
    sinCuentas: 'Todavía no hay cuentas verificadas',
    sinCuentasDetalle:
      'Cuando el jugador vincule su cuenta de Riot Games aparecerá aquí, con la fecha de verificación.',
    estadisticasTitulo: 'Estadísticas de juego',
    estadisticasSubtitulo: 'Traídas de la API oficial del juego, nunca declaradas por el jugador.',
    sinEstadisticas: 'Sin estadísticas todavía',
    sinEstadisticasDetalle:
      'Se cargarán desde la API de Riot Games cuando el jugador vincule su cuenta. ProPlay no muestra cifras autodeclaradas.',
    habilidadesTitulo: 'Habilidades y endorsements',
    habilidadesSubtitulo: 'Validadas por otros usuarios de la plataforma.',
    habilidadesProximamente: 'Próximamente',
    habilidadesProximamenteDetalle:
      'Las habilidades declaradas y sus endorsements llegarán en una próxima versión.',
    comoTitulo: 'Cómo se construye este perfil',
    comoSubtitulo: 'Cadena de captura, procesamiento y salida de datos',
    pasos: [
      {
        n: '01',
        titulo: 'Vinculación OAuth 2.0',
        detalle: 'El jugador autoriza el acceso a su cuenta de Riot Games.',
      },
      {
        n: '02',
        titulo: 'Ingesta',
        detalle:
          'Un proceso consulta periódicamente la API oficial y guarda cada captura con su marca de tiempo.',
      },
      {
        n: '03',
        titulo: 'Normalización',
        detalle:
          'Las métricas se llevan a una escala comparable y se calculan las derivadas (KDA, win rate, tendencia).',
      },
      {
        n: '04',
        titulo: 'Vectorización',
        detalle:
          'El perfil se convierte en un vector de 64 dimensiones para buscar jugadores similares.',
      },
    ],
    plataforma: {
      RIOT: 'Riot Games',
      STEAM: 'Steam',
      TWITCH: 'Twitch',
      YOUTUBE: 'YouTube',
    } satisfies Record<Plataforma, string>,
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
  miPerfil: {
    cargando: 'Cargando tu perfil',
    errorCarga: 'No pudimos cargar tu perfil.',
    errorCargaDetalle: 'Revisa tu conexión e inténtalo de nuevo.',
    sinPerfil: 'Tu cuenta no tiene un perfil de jugador',
    sinPerfilDetalle:
      'El perfil profesional solo aplica a cuentas de tipo jugador. Como equipo o scout, usa el panel correspondiente.',
    perfilProfesional: 'Perfil profesional',
    sinUbicacion: 'Ubicación sin indicar',
    horasSemana: (horas: number) => `${horas} h por semana`,
    relocalizable: 'Dispuesto a relocalizarse',
    verPublico: 'Ver como lo ven los equipos',
    pestanaDatos: 'Datos profesionales',
    datosSubtitulo: 'Se guardan en tu cuenta y los equipos los ven en tu perfil.',
    bio: 'Presentación',
    bioPista: (usados: number, maximo: number) => `${usados}/${maximo} caracteres.`,
    bioPlaceholder: 'Describe tu trayectoria, el juego en el que compites y lo que buscas.',
    horas: 'Horas disponibles por semana',
    horasPista: 'Entre 0 y 80. Déjalo vacío si aún no lo sabes.',
    guardar: 'Guardar cambios',
    exito: 'Perfil guardado.',
    notaEvidencia:
      'Lo que declaras aquí es contexto para el matching, no evidencia: las estadísticas de juego llegan por la ingesta directa desde la API del juego.',
  },
  ubicacion: {
    titulo: 'Ubicación',
    subtitulo:
      'Tu país y, en Colombia, tu departamento. Los equipos la usan para calcular la compatibilidad geográfica.',
    completaTitulo: 'Completa tu ubicación',
    completaDetalle:
      'Sin ella, el matching no puede calcular la dimensión geográfica de tu compatibilidad con las ofertas.',
    pais: 'País',
    departamento: 'Departamento',
    seleccionaPais: 'Selecciona tu país',
    seleccionaDepartamento: 'Selecciona tu departamento',
    pistaDepartamento: 'Solo se pide en Colombia.',
    relocalizar: 'Dispuesto a relocalizarme',
    relocalizarDetalle:
      'Mejora la dimensión geográfica cuando la oferta pide una ubicación distinta de la tuya.',
  },
  /** Mensajes de validación de Zod que el contrato no personaliza. */
  validacion: {
    textoLargo: (maximo: number) => `Máximo ${maximo} caracteres`,
    numeroEntero: 'Escribe un número entero',
    numeroMinimo: (minimo: number) => `Debe ser ${minimo} o más`,
    numeroMaximo: (maximo: number) => `Debe ser ${maximo} o menos`,
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
