/* ============================================================================
 * ProPlay — Modelos del prototipo pendientes de contrato
 *
 * Los enums, el usuario y el catalogo de habilidades vienen de
 * @proplay/shared. El resto son los modelos de vista con los que se construyo
 * el prototipo de la rama Fronted: su forma aun no coincide con el contrato
 * de la API y cada uno se reconcilia en el sprint que conecta su endpoint
 * (ver «Divergencias con @proplay/shared» en docs/decisiones.md). No crees
 * aqui un tipo que ya exista en @proplay/shared.
 * ==========================================================================*/

import type {
  CategoriaHabilidad,
  EstadoOferta,
  EstadoPostulacion,
  Habilidad,
  Plataforma,
  Rol,
  UsuarioPublico,
} from '@proplay/shared'

export type { CategoriaHabilidad, EstadoOferta, Habilidad, Plataforma, Rol }

/** Usuario de la simulacion: es el mismo contrato que devuelve la API. */
export type Usuario = UsuarioPublico

/**
 * Propuesta de ampliacion para S3: un estado intermedio entre la revision y
 * la aceptacion («invitar a un tryout»). Hasta que entre en EstadoPostulacion
 * y en Prisma, solo existe en el prototipo.
 */
export type EstadoPostulacionPrototipo = EstadoPostulacion | 'ENTREVISTA'

/** Plataformas con ingesta de estadisticas (subconjunto del contrato). */
export type PlataformaJuego = Extract<Plataforma, 'RIOT' | 'STEAM'>

export type Juego =
  | 'League of Legends'
  | 'Valorant'
  | 'Counter-Strike 2'
  | 'Rocket League'
  | 'Dota 2'

export type Region =
  | 'Barranquilla'
  | 'Cartagena'
  | 'Santa Marta'
  | 'Cúcuta'
  | 'Bucaramanga'
  | 'Medellín'
  | 'Bogotá'
  | 'Cali'

export type RegionCaribe = Extract<
  Region,
  'Barranquilla' | 'Cartagena' | 'Santa Marta'
>

export type NivelHabilidad = 1 | 2 | 3 | 4 | 5

export interface HabilidadJugador {
  id: string
  perfilId: string
  habilidadId: string
  nivel: NivelHabilidad
  verificada: boolean
}

export interface Endorsement {
  id: string
  habilidadJugadorId: string
  autorId: string
  autorNombre: string
  fecha: string
  comentario: string
}

export interface CuentaGaming {
  id: string
  perfilId: string
  plataforma: PlataformaJuego
  identificadorExterno: string
  verificada: boolean
  fechaVerificacion: string
}

export interface Estadistica {
  id: string
  perfilId: string
  juego: Juego
  rol: string
  partidas: number
  victorias: number
  kda: number
  winRate: number
  rango: string
  /**
   * Senal costosa de falsificar: proviene de la API oficial del juego (RFC 28),
   * no de una declaracion del jugador.
   */
  fuente: 'api-riot' | 'api-steam' | 'cache-worker'
  ultimaSync: string
  /** Serie de resultados recientes (1 = victoria) para el sparkline de tendencia. */
  tendencia: number[]
}

export interface PerfilJugador {
  id: string
  usuarioId: string
  nombre: string
  handle: string
  foto: string
  region: Region
  esCaribe: boolean
  biografia: string
  horasDisponibles: number
  dispuestoARelocalizarse: boolean
  rolesPreferidos: string[]
  aniosExperiencia: number
  equiposAnteriores: string[]
  logros: Logro[]
  portafolio: Partida[]
}

export interface Logro {
  id: string
  titulo: string
  juego: Juego
  lugar: string
  anio: number
}

export interface Partida {
  id: string
  juego: Juego
  mapa: string
  fecha: string
  resultado: 'victoria' | 'derrota'
  mvp: boolean
  rating: number
}

export interface PerfilEquipo {
  id: string
  usuarioId: string
  nombre: string
  organizacion: string
  descripcion: string
  region: Region
  sitioWeb?: string
  logo: string
  fundacion: number
  directorio: string[]
}

export interface Oferta {
  id: string
  equipoId: string
  juego: Juego
  rol: string
  rangoMinimo: string
  experienciaMinima: number
  regionPreferida: Region | 'Cualquiera'
  horasSemanales: number
  estado: EstadoOferta
  publicadaEn: string
  descripcion: string
  salario?: string
  /** Requisitos declarados por el equipo, mostrados como lista en la vacante. */
  requisitos?: string[]
}

export interface Postulacion {
  id: string
  ofertaId: string
  perfilId: string
  estado: EstadoPostulacionPrototipo
  mensaje: string
  fecha: string
}

export interface Mensaje {
  id: string
  emisorId: string
  emisorNombre: string
  receptorId: string
  texto: string
  leido: boolean
  fecha: string
}

export interface AuditLog {
  id: string
  usuarioId: string
  usuarioNombre: string
  accion: string
  entidad: string
  fecha: string
}

/* ------------------------------ Notificaciones ---------------------------- */

/**
 * Eventos relevantes notificados al usuario (RF-12). El modulo de
 * notificaciones convierte acciones del dominio (postulaciones, cambios de
 * estado, ofertas, endoses, ingesta y mensajes) en avisos con enlace a la
 * pantalla donde se resuelve la accion.
 */
export type TipoNotificacion =
  | 'postulacion'
  | 'estado_postulacion'
  | 'oferta'
  | 'endoso'
  | 'ingesta'
  | 'mensaje'

export interface Notificacion {
  id: string
  usuarioId: string
  tipo: TipoNotificacion
  titulo: string
  detalle: string
  fecha: string
  leida: boolean
  /** Ruta interna de la SPA donde se resuelve la accion. */
  enlace?: string
}

/* --------------------------- Privacidad (RNF-05) -------------------------- */

/** Nivel de visibilidad del perfil profesional de un jugador. */
export type VisibilidadPerfil = 'publico' | 'equipos' | 'privado'

export interface ConfiguracionPrivacidad {
  usuarioId: string
  visibilidadPerfil: VisibilidadPerfil
  mostrarEstadisticas: boolean
  mostrarPortafolio: boolean
  mostrarContacto: boolean
  /** Constancia de aceptacion del aviso de privacidad (Ley 1581 de 2012). */
  avisoPrivacidadAceptado: boolean
  fechaAceptacion?: string
}

/* ------------------------------ Motor de matching ------------------------ */

export type DimensionKey =
  | 'tecnica'
  | 'experiencia'
  | 'blandas'
  | 'geografica'
  | 'disponibilidad'

export interface DimensionDef {
  key: DimensionKey
  label: string
  descripcion: string
  icono: string
}

export type Pesos = Record<DimensionKey, number>

export interface DesgloseDimension {
  key: DimensionKey
  valor: number
  peso: number
  contribucion: number
  detalle: string
}

export interface ResultadoMatching {
  ofertaId: string
  perfilId: string
  puntaje: number
  desglose: DesgloseDimension[]
  /** Similitud coseno entre vectores de perfil (stand-in del indice HNSW de pgvector). */
  similitudVectorial: number
  /** Componente colaborativo (matriz de interacciones equipo-jugador). */
  colaborativo: number
  /** Peso efectivo del componente colaborativo; 0 mientras no hay historial (cold start). */
  pesoColaborativo: number
  modo: 'hibrido' | 'contenido'
  embedding: number[]
}

/**
 * Recomendacion de vacante para un jugador: el par oferta + resultado del
 * motor, listo para mostrarse en el panel del jugador.
 */
export interface RecomendacionOferta {
  oferta: Oferta
  resultado: ResultadoMatching
}

export interface ExplicacionMatching {
  resumen: string
  fortalezas: string[]
  riesgos: string[]
  grounding: FuenteGrounding[]
  generadoEn: string
  modelo: string
  latenciaMs: number
}

export interface FuenteGrounding {
  etiqueta: string
  url: string
  detalle: string
}

/* ------------------------------- Respuestas API -------------------------- */

export interface ApiResponse<T> {
  data: T
  meta?: {
    total?: number
    latencyMs?: number
    fuente?: string
  }
}

export interface FiltrosBusqueda {
  juego?: Juego | 'Todos'
  rol?: string
  rango?: string
  region?: Region | 'Todas'
  disponibilidad?: 'cualquiera' | 'inmediata' | 'media' | 'flexible'
  verificados?: boolean
  query?: string
}
