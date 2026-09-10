import { z } from "zod";
import { ESTADOS_OFERTA, ESTADOS_POSTULACION } from "../enums";

export const crearOfertaSchema = z.object({
  titulo: z.string().min(5, "Mínimo 5 caracteres").max(140),
  juego: z.string().min(1).max(60),
  rol: z.string().min(1).max(60),
  rangoMinimo: z.string().max(60).optional(),
  experienciaMinAnios: z.number().int().min(0).max(30).default(0),
  region: z.string().max(60).optional(),
  horasSemana: z.number().int().min(0).max(80).optional(),
  descripcion: z.string().min(20, "Describe la oferta con más detalle").max(5000),
  estado: z.enum(ESTADOS_OFERTA).default("BORRADOR"),
});

export const actualizarOfertaSchema = crearOfertaSchema.partial();

export const listarOfertasQuerySchema = z.object({
  juego: z.string().max(60).optional(),
  region: z.string().max(60).optional(),
  rol: z.string().max(60).optional(),
  estado: z.enum(ESTADOS_OFERTA).optional(),
});

export const ofertaSchema = crearOfertaSchema.extend({
  id: z.string(),
  equipoId: z.string(),
  creadoEn: z.coerce.date(),
  actualizadoEn: z.coerce.date(),
});

export const crearPostulacionSchema = z.object({
  mensaje: z.string().max(1000).optional(),
});

export const actualizarPostulacionSchema = z.object({
  estado: z.enum(ESTADOS_POSTULACION),
});

export type CrearOfertaInput = z.infer<typeof crearOfertaSchema>;
export type ActualizarOfertaInput = z.infer<typeof actualizarOfertaSchema>;
export type ListarOfertasQuery = z.infer<typeof listarOfertasQuerySchema>;
export type Oferta = z.infer<typeof ofertaSchema>;
export type CrearPostulacionInput = z.infer<typeof crearPostulacionSchema>;
