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

export const ESTADOS_OFERTA = ["BORRADOR", "ABIERTA", "CERRADA"] as const;
export type EstadoOferta = (typeof ESTADOS_OFERTA)[number];
export const EstadoOferta = {
  BORRADOR: "BORRADOR",
  ABIERTA: "ABIERTA",
  CERRADA: "CERRADA",
} as const satisfies Record<EstadoOferta, EstadoOferta>;

export const ESTADOS_POSTULACION = [
  "ENVIADA",
  "EN_REVISION",
  "ACEPTADA",
  "RECHAZADA",
] as const;
export type EstadoPostulacion = (typeof ESTADOS_POSTULACION)[number];
export const EstadoPostulacion = {
  ENVIADA: "ENVIADA",
  EN_REVISION: "EN_REVISION",
  ACEPTADA: "ACEPTADA",
  RECHAZADA: "RECHAZADA",
} as const satisfies Record<EstadoPostulacion, EstadoPostulacion>;

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
