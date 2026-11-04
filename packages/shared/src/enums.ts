/**
 * Enums del dominio de ProPlay.
 *
 * Única fuente de verdad: estos valores deben coincidir EXACTAMENTE con los
 * enums declarados en apps/api/prisma/schema.prisma. No los dupliques en el
 * backend ni en el frontend: impórtalos desde `@proplay/shared`.
 *
 * Cada enum se declara como tupla `as const` para poder derivar de ella el
 * esquema Zod, el tipo TypeScript y el objeto de valores sin repetir nada.
 */

export const ROLES = ["JUGADOR", "EQUIPO", "SCOUT", "ADMIN"] as const;
export type Rol = (typeof ROLES)[number];
export const Rol = {
  JUGADOR: "JUGADOR",
  EQUIPO: "EQUIPO",
  SCOUT: "SCOUT",
  ADMIN: "ADMIN",
} as const satisfies Record<Rol, Rol>;

/** Roles que un visitante puede elegir al registrarse (ADMIN, con el script de docs/operacion.md). */
export const ROLES_REGISTRABLES = ["JUGADOR", "EQUIPO", "SCOUT"] as const;
export type RolRegistrable = (typeof ROLES_REGISTRABLES)[number];

export const CATEGORIAS_HABILIDAD = ["TECNICA", "BLANDA"] as const;
export type CategoriaHabilidad = (typeof CATEGORIAS_HABILIDAD)[number];
export const CategoriaHabilidad = {
  TECNICA: "TECNICA",
  BLANDA: "BLANDA",
} as const satisfies Record<CategoriaHabilidad, CategoriaHabilidad>;

export const PLATAFORMAS = ["RIOT", "STEAM", "TWITCH", "YOUTUBE"] as const;
export type Plataforma = (typeof PLATAFORMAS)[number];
export const Plataforma = {
  RIOT: "RIOT",
  STEAM: "STEAM",
  TWITCH: "TWITCH",
  YOUTUBE: "YOUTUBE",
} as const satisfies Record<Plataforma, Plataforma>;

/**
 * Estados de la oferta. `CUBIERTA` y `CERRADA` son finales: la primera cierra
 * con al menos un jugador aceptado (mide el tiempo hasta cubrir la vacante,
 * H1); la segunda, sin contratar. Transiciones en `TRANSICIONES_OFERTA`.
 */
export const ESTADOS_OFERTA = ["BORRADOR", "ABIERTA", "CUBIERTA", "CERRADA"] as const;
export type EstadoOferta = (typeof ESTADOS_OFERTA)[number];
export const EstadoOferta = {
  BORRADOR: "BORRADOR",
  ABIERTA: "ABIERTA",
  CUBIERTA: "CUBIERTA",
  CERRADA: "CERRADA",
} as const satisfies Record<EstadoOferta, EstadoOferta>;

/**
 * Estados de la postulación, en el orden del embudo. `ENTREVISTA` es el tryout
 * («invitar a un tryout» del documento). `ACEPTADA` y `RECHAZADA` son finales.
 * Transiciones en `TRANSICIONES_POSTULACION`.
 */
export const ESTADOS_POSTULACION = [
  "ENVIADA",
  "EN_REVISION",
  "ENTREVISTA",
  "ACEPTADA",
  "RECHAZADA",
] as const;
export type EstadoPostulacion = (typeof ESTADOS_POSTULACION)[number];
export const EstadoPostulacion = {
  ENVIADA: "ENVIADA",
  EN_REVISION: "EN_REVISION",
  ENTREVISTA: "ENTREVISTA",
  ACEPTADA: "ACEPTADA",
  RECHAZADA: "RECHAZADA",
} as const satisfies Record<EstadoPostulacion, EstadoPostulacion>;

/**
 * Modalidad de la oferta, insumo de la dimensión geográfica. `REMOTA` no lleva
 * ubicación: es la oferta «sin restricción».
 */
export const MODALIDADES = ["PRESENCIAL", "HIBRIDA", "REMOTA"] as const;
export type Modalidad = (typeof MODALIDADES)[number];
export const Modalidad = {
  PRESENCIAL: "PRESENCIAL",
  HIBRIDA: "HIBRIDA",
  REMOTA: "REMOTA",
} as const satisfies Record<Modalidad, Modalidad>;

/**
 * Posiciones de League of Legends, el único juego del piloto. Corresponden a
 * `teamPosition` de la API de partidas de Riot (TOP, JUNGLE, MIDDLE, BOTTOM,
 * UTILITY), así la dimensión técnica compara la oferta con lo jugado.
 */
export const POSICIONES_LOL = ["TOP", "JUNGLA", "MID", "ADC", "SOPORTE"] as const;
export type PosicionLol = (typeof POSICIONES_LOL)[number];
export const PosicionLol = {
  TOP: "TOP",
  JUNGLA: "JUNGLA",
  MID: "MID",
  ADC: "ADC",
  SOPORTE: "SOPORTE",
} as const satisfies Record<PosicionLol, PosicionLol>;

/**
 * Rango de clasificatoria solo/dúo de League of Legends, **de menor a mayor**:
 * de `HIERRO_IV` a `DIAMANTE_I` con sus cuatro divisiones (IV es la más baja),
 * y después `MAESTRO`, `GRAN_MAESTRO` y `RETADOR`, que no tienen división.
 *
 * El orden de la tupla es el del enum de Postgres, que compara los valores en
 * el orden en que se declaran: «rango mínimo ORO_II» es `rango >= 'ORO_II'`.
 * No lo reordenes. Desde la API de Riot se obtiene con `rangoDesdeRiot`.
 */
export const RANGOS_LOL = [
  "HIERRO_IV", "HIERRO_III", "HIERRO_II", "HIERRO_I",
  "BRONCE_IV", "BRONCE_III", "BRONCE_II", "BRONCE_I",
  "PLATA_IV", "PLATA_III", "PLATA_II", "PLATA_I",
  "ORO_IV", "ORO_III", "ORO_II", "ORO_I",
  "PLATINO_IV", "PLATINO_III", "PLATINO_II", "PLATINO_I",
  "ESMERALDA_IV", "ESMERALDA_III", "ESMERALDA_II", "ESMERALDA_I",
  "DIAMANTE_IV", "DIAMANTE_III", "DIAMANTE_II", "DIAMANTE_I",
  "MAESTRO",
  "GRAN_MAESTRO",
  "RETADOR",
] as const;
export type RangoLol = (typeof RANGOS_LOL)[number];

/** Tipos de notificación que emite el sistema. */
export const TIPOS_NOTIFICACION = [
  "NUEVA_POSTULACION",
  "POSTULACION_ACTUALIZADA",
  "NUEVO_MENSAJE",
  "NUEVO_MATCH",
  "ENDORSEMENT_RECIBIDO",
] as const;
export type TipoNotificacion = (typeof TIPOS_NOTIFICACION)[number];

/**
 * Departamentos de Colombia (32 más Bogotá D. C.), insumo de la dimensión
 * geográfica del matching. Sólo se usan con `pais = "CO"`; fuera de Colombia la
 * ubicación es sólo el país. Las etiquetas visibles viven en el i18n del cliente.
 */
export const DEPARTAMENTOS = [
  "AMAZONAS",
  "ANTIOQUIA",
  "ARAUCA",
  "ATLANTICO",
  "BOGOTA_DC",
  "BOLIVAR",
  "BOYACA",
  "CALDAS",
  "CAQUETA",
  "CASANARE",
  "CAUCA",
  "CESAR",
  "CHOCO",
  "CORDOBA",
  "CUNDINAMARCA",
  "GUAINIA",
  "GUAVIARE",
  "HUILA",
  "LA_GUAJIRA",
  "MAGDALENA",
  "META",
  "NARINO",
  "NORTE_DE_SANTANDER",
  "PUTUMAYO",
  "QUINDIO",
  "RISARALDA",
  "SAN_ANDRES",
  "SANTANDER",
  "SUCRE",
  "TOLIMA",
  "VALLE_DEL_CAUCA",
  "VAUPES",
  "VICHADA",
] as const;
export type Departamento = (typeof DEPARTAMENTOS)[number];
