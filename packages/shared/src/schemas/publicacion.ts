import { z } from "zod";
import { urlHttpSchema } from "./common";

export const crearPublicacionSchema = z.object({
  texto: z.string().min(1).max(2000),
  mediaUrls: z.array(urlHttpSchema).max(4).default([]),
});

export const publicacionSchema = crearPublicacionSchema.extend({
  id: z.string(),
  autorId: z.string(),
  creadoEn: z.coerce.date(),
});

export type CrearPublicacionInput = z.infer<typeof crearPublicacionSchema>;
export type Publicacion = z.infer<typeof publicacionSchema>;
