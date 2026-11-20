import { z } from "zod";
import { ESTADOS_POSTULACION } from "../enums";
import { MAXIMO_NOTIFICACIONES_POR_MARCADO, ORIGENES_CAMBIO_POSTULACION } from "../constants";
import { paginacionQuerySchema, paginadoSchema } from "./common";

/**
 * Contrato de las notificaciones dentro de la app (RF-12, versión mínima).
 *
 * Las crea el módulo `notificaciones` al consumir los eventos que publican los
 * demás (CLAUDE.md §3.3). Guardan datos, no texto: el cliente compone el
 * mensaje y el enlace con el tipo y el `payload` (textos en el i18n). El
 * `payload` sólo lleva del jugador el nombre, y sólo en la notificación al
 * equipo dueño, que ya lo ve en las postulaciones recibidas: ni su correo ni
 * otros datos.
 */

/** Nueva postulación a una oferta: para el usuario del equipo dueño. */
const nuevaPostulacion = z.object({
  tipo: z.literal("NUEVA_POSTULACION"),
  payload: z.object({
    ofertaId: z.string(),
    ofertaTitulo: z.string(),
    postulacionId: z.string(),
    /** Nombre de quien se postuló; falta en las notificaciones anteriores. */
    jugadorNombre: z.string().optional(),
  }),
});

/**
 * Una postulación cambió de estado: para el jugador. `origen` distingue la
 * decisión del equipo del rechazo automático al cerrar la oferta.
 */
const postulacionActualizada = z.object({
  tipo: z.literal("POSTULACION_ACTUALIZADA"),
  payload: z.object({
    ofertaId: z.string(),
    ofertaTitulo: z.string(),
    postulacionId: z.string(),
    estado: z.enum(ESTADOS_POSTULACION),
    origen: z.enum(ORIGENES_CAMBIO_POSTULACION),
  }),
});

const comun = {
  id: z.string(),
  leidaEn: z.coerce.date().nullable(),
  creadoEn: z.coerce.date(),
};

export const notificacionSchema = z.discriminatedUnion("tipo", [
  nuevaPostulacion.extend(comun),
  postulacionActualizada.extend(comun),
]);

/** `GET /notificaciones`: las del usuario, de la más reciente a la más antigua. */
export const listarNotificacionesQuerySchema = paginacionQuerySchema;
export const notificacionesSchema = paginadoSchema(notificacionSchema);

/** `GET /notificaciones/contador`. */
export const contadorNotificacionesSchema = z.object({ noLeidas: z.number().int().min(0) });

/**
 * `POST /notificaciones/leidas`: marca como leídas las indicadas. Un id que no
 * sea del usuario se ignora (no revela si existe).
 */
export const marcarLeidasSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(MAXIMO_NOTIFICACIONES_POR_MARCADO),
});

/** Respuesta de marcar como leídas (las indicadas o todas): cuántas cambiaron. */
export const notificacionesMarcadasSchema = z.object({ marcadas: z.number().int().min(0) });

export type Notificacion = z.infer<typeof notificacionSchema>;
export type Notificaciones = z.infer<typeof notificacionesSchema>;
export type ContadorNotificaciones = z.infer<typeof contadorNotificacionesSchema>;
export type MarcarLeidasInput = z.infer<typeof marcarLeidasSchema>;
export type NotificacionesMarcadas = z.infer<typeof notificacionesMarcadasSchema>;
