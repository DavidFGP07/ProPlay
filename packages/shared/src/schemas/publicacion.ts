import { z } from "zod";

export const crearPublicacionSchema = z.object({
  texto: z.string().min(1).max(2000),
  mediaUrls: z.array(z.string().url()).max(4).default([]),
});

export const publicacionSchema = crearPublicacionSchema.extend({
  id: z.string(),
  autorId: z.string(),
  creadoEn: z.coerce.date(),
});

export type CrearPublicacionInput = z.infer<typeof crearPublicacionSchema>;
export type Publicacion = z.infer<typeof publicacionSchema>;
