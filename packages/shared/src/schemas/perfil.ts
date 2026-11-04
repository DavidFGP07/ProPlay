import { z } from "zod";
import { CATEGORIAS_HABILIDAD, DEPARTAMENTOS, PLATAFORMAS } from "../enums";
import { urlHttpSchema, validarPaisDepartamento } from "./common";
import {
  NIVEL_HABILIDAD_MAX,
  NIVEL_HABILIDAD_MIN,
  PAISES,
} from "../constants";

/**
 * Ubicación geográfica del jugador, insumo de la dimensión geográfica del
 * matching. No es la región de servidor del juego, que sale de la cuenta
 * vinculada. `null` borra el dato.
 */
const camposUbicacion = {
  pais: z.enum(PAISES).nullable().optional(),
  departamento: z.enum(DEPARTAMENTOS).nullable().optional(),
  dispuestoRelocalizar: z.boolean().optional(),
};

export const ubicacionJugadorSchema = z
  .object(camposUbicacion)
  .superRefine(validarPaisDepartamento);

/**
 * Edición del perfil del jugador (`PATCH /perfiles/jugador`): campo ausente,
 * no cambia; `null`, se borra (en `avatarUrl` y la ubicación).
 */
export const perfilJugadorSchema = z
  .object({
    bio: z.string().max(1000).optional(),
    ...camposUbicacion,
    disponibilidadHoras: z.number().int().min(0).max(80).optional(),
    avatarUrl: urlHttpSchema.nullable().optional(),
  })
  .superRefine(validarPaisDepartamento);

/**
 * Edición del perfil del equipo (`PATCH /perfiles/equipo`): campo ausente, no
 * cambia; `null`, se borra. El nombre de la organización es obligatorio en la
 * base, así que se puede omitir pero no borrar. La sede (`pais` +
 * `departamento`) sigue la misma regla que la ubicación del jugador.
 */
export const perfilEquipoSchema = z
  .object({
    nombreOrg: z.string().trim().min(2).max(120).optional(),
    descripcion: z.string().max(1000).nullable().optional(),
    sitioWeb: urlHttpSchema.nullable().optional(),
    logoUrl: urlHttpSchema.nullable().optional(),
    pais: z.enum(PAISES).nullable().optional(),
    departamento: z.enum(DEPARTAMENTOS).nullable().optional(),
  })
  .superRefine(validarPaisDepartamento);

export const habilidadSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  categoria: z.enum(CATEGORIAS_HABILIDAD),
});

export const asignarHabilidadSchema = z.object({
  habilidadId: z.string().min(1),
  nivel: z.number().int().min(NIVEL_HABILIDAD_MIN).max(NIVEL_HABILIDAD_MAX),
});

export const crearEndorsementSchema = z.object({
  habilidadJugadorId: z.string().min(1),
  comentario: z.string().max(280).optional(),
});

export const vincularCuentaGamingSchema = z.object({
  plataforma: z.enum(PLATAFORMAS),
  codigoAutorizacion: z.string().min(1),
});

/** Perfil del jugador tal como lo devuelve la API a su dueño. */
export const perfilJugadorRespuestaSchema = z.object({
  id: z.string(),
  usuarioId: z.string(),
  bio: z.string().nullable(),
  pais: z.enum(PAISES).nullable(),
  departamento: z.enum(DEPARTAMENTOS).nullable(),
  disponibilidadHoras: z.number().int().nullable(),
  dispuestoRelocalizar: z.boolean(),
  avatarUrl: z.string().nullable(),
  creadoEn: z.coerce.date(),
  actualizadoEn: z.coerce.date(),
});

/** Perfil del equipo tal como lo devuelve la API a su dueño. */
export const perfilEquipoRespuestaSchema = z.object({
  id: z.string(),
  usuarioId: z.string(),
  nombreOrg: z.string(),
  descripcion: z.string().nullable(),
  sitioWeb: z.string().nullable(),
  logoUrl: z.string().nullable(),
  pais: z.enum(PAISES).nullable(),
  departamento: z.enum(DEPARTAMENTOS).nullable(),
  creadoEn: z.coerce.date(),
  actualizadoEn: z.coerce.date(),
});

/**
 * Perfil público del jugador (`GET /perfiles/:id`, sin sesión): la vitrina que
 * se comparte por enlace (RF-05). Es una **lista blanca**, no el perfil privado
 * menos algunos campos: todo lo que no esté aquí no sale. Nunca el correo, el
 * id de la cuenta, las fechas de aceptación ni datos que el matching usa en
 * privado (disponibilidad, disposición a relocalizarse). Ubicación como máximo
 * a nivel de departamento; la macrorregión la deriva el cliente.
 */
export const perfilJugadorPublicoSchema = z.object({
  /** Id de `PerfilJugador`, no el de la cuenta. */
  id: z.string(),
  nombre: z.string(),
  bio: z.string().nullable(),
  pais: z.enum(PAISES).nullable(),
  departamento: z.enum(DEPARTAMENTOS).nullable(),
  avatarUrl: z.string().nullable(),
  /** Sólo plataforma y fecha: nunca el identificador externo ni los tokens. */
  cuentasVerificadas: z.array(
    z.object({
      plataforma: z.enum(PLATAFORMAS),
      verificadaEn: z.coerce.date(),
    }),
  ),
});

/** Claves que puede llevar la respuesta pública: las pruebas comparan contra esta lista. */
export const CAMPOS_PERFIL_JUGADOR_PUBLICO = Object.keys(
  perfilJugadorPublicoSchema.shape,
) as (keyof z.infer<typeof perfilJugadorPublicoSchema>)[];

/**
 * Respuesta de `GET /perfiles/me`: el perfil que corresponde al rol. El scout
 * y el administrador no tienen perfil y reciben `{ tipo: null, perfil: null }`.
 */
export const perfilPropioResponseSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("JUGADOR"), perfil: perfilJugadorRespuestaSchema }),
  z.object({ tipo: z.literal("EQUIPO"), perfil: perfilEquipoRespuestaSchema }),
  z.object({ tipo: z.null(), perfil: z.null() }),
]);

export type UbicacionJugadorInput = z.infer<typeof ubicacionJugadorSchema>;
export type PerfilJugadorInput = z.infer<typeof perfilJugadorSchema>;
export type PerfilJugadorRespuesta = z.infer<typeof perfilJugadorRespuestaSchema>;
export type PerfilEquipoRespuesta = z.infer<typeof perfilEquipoRespuestaSchema>;
export type PerfilPropioResponse = z.infer<typeof perfilPropioResponseSchema>;
export type PerfilJugadorPublico = z.infer<typeof perfilJugadorPublicoSchema>;
export type PerfilEquipoInput = z.infer<typeof perfilEquipoSchema>;
export type Habilidad = z.infer<typeof habilidadSchema>;
export type AsignarHabilidadInput = z.infer<typeof asignarHabilidadSchema>;
export type VincularCuentaGamingInput = z.infer<
  typeof vincularCuentaGamingSchema
>;
