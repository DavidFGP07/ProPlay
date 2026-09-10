import { z } from "zod";
import { CATEGORIAS_HABILIDAD, PLATAFORMAS } from "../enums";
import { NIVEL_HABILIDAD_MAX, NIVEL_HABILIDAD_MIN } from "../constants";

export const perfilJugadorSchema = z.object({
  bio: z.string().max(1000).optional(),
  region: z.string().max(60).optional(),
  pais: z.string().max(60).optional(),
  fechaNacimiento: z.coerce.date().optional(),
  disponibilidadHoras: z.number().int().min(0).max(80).optional(),
  dispuestoRelocalizar: z.boolean().optional(),
  avatarUrl: z.string().url().optional(),
});

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

export type PerfilJugadorInput = z.infer<typeof perfilJugadorSchema>;
export type PerfilEquipoInput = z.infer<typeof perfilEquipoSchema>;
export type Habilidad = z.infer<typeof habilidadSchema>;
export type AsignarHabilidadInput = z.infer<typeof asignarHabilidadSchema>;
export type VincularCuentaGamingInput = z.infer<
  typeof vincularCuentaGamingSchema
>;
