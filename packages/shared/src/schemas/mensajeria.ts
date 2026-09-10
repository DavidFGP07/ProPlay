import { z } from "zod";

export const crearConversacionSchema = z.object({
  participantes: z.array(z.string().min(1)).min(1).max(20),
  titulo: z.string().max(120).optional(),
});

export const crearMensajeSchema = z.object({
  texto: z.string().min(1, "El mensaje no puede estar vacío").max(4000),
});

export const mensajeSchema = z.object({
  id: z.string(),
  conversacionId: z.string(),
  autorId: z.string(),
  texto: z.string(),
  creadoEn: z.coerce.date(),
});

export type CrearConversacionInput = z.infer<typeof crearConversacionSchema>;
export type CrearMensajeInput = z.infer<typeof crearMensajeSchema>;
export type Mensaje = z.infer<typeof mensajeSchema>;
