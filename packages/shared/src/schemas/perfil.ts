import { z } from "zod";
import { CATEGORIAS_HABILIDAD, DEPARTAMENTOS, PLATAFORMAS } from "../enums";
import {
  NIVEL_HABILIDAD_MAX,
  NIVEL_HABILIDAD_MIN,
  PAIS_CON_DEPARTAMENTO,
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

/**
 * Coherencia de país y departamento: con `pais = "CO"` el departamento es
 * obligatorio; con otro país, o sin país, no se admite. Si el cuerpo trae sólo
 * el departamento, aquí no se puede comprobar: el servidor lo valida contra el
 * país guardado con este mismo esquema.
 */
function validarUbicacion(
  datos: { pais?: string | null; departamento?: string | null },
  ctx: z.RefinementCtx,
) {
  const { pais, departamento } = datos;
  if (pais === undefined) return;
  if (pais === PAIS_CON_DEPARTAMENTO && !departamento) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["departamento"],
      message: "Selecciona el departamento",
    });
  }
  if (pais !== PAIS_CON_DEPARTAMENTO && departamento) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["departamento"],
      message: "El departamento sólo aplica a Colombia",
    });
  }
}

export const ubicacionJugadorSchema = z
  .object(camposUbicacion)
  .superRefine(validarUbicacion);

export const perfilJugadorSchema = z
  .object({
    bio: z.string().max(1000).optional(),
    ...camposUbicacion,
    fechaNacimiento: z.coerce.date().optional(),
    disponibilidadHoras: z.number().int().min(0).max(80).optional(),
    avatarUrl: z.string().url().optional(),
  })
  .superRefine(validarUbicacion);

export const perfilEquipoSchema = z.object({
  nombreOrg: z.string().min(2).max(120),
  descripcion: z.string().max(1000).optional(),
  sitioWeb: z.string().url().optional(),
  logoUrl: z.string().url().optional(),
  region: z.string().max(60).optional(),
});

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
  fechaNacimiento: z.coerce.date().nullable(),
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
  region: z.string().nullable(),
  creadoEn: z.coerce.date(),
  actualizadoEn: z.coerce.date(),
});

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
export type PerfilEquipoInput = z.infer<typeof perfilEquipoSchema>;
export type Habilidad = z.infer<typeof habilidadSchema>;
export type AsignarHabilidadInput = z.infer<typeof asignarHabilidadSchema>;
export type VincularCuentaGamingInput = z.infer<
  typeof vincularCuentaGamingSchema
>;
