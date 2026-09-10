import { z } from "zod";
import { TIPOS_NOTIFICACION } from "../enums";

export const notificacionSchema = z.object({
  id: z.string(),
  usuarioId: z.string(),
  tipo: z.enum(TIPOS_NOTIFICACION),
  payload: z.record(z.unknown()),
  leidaEn: z.coerce.date().nullable(),
  creadoEn: z.coerce.date(),
});

export const marcarLeidasSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

export type Notificacion = z.infer<typeof notificacionSchema>;
export type MarcarLeidasInput = z.infer<typeof marcarLeidasSchema>;
