import type {
  ContadorNotificaciones,
  Notificacion,
  Notificaciones,
  NotificacionesMarcadas,
} from "@proplay/shared";
import { logger } from "../../config/logger";
import { suscribir, type Evento } from "../../eventos";
import { calcularRango, paginar, type OpcionesPaginacion } from "../../utils/pagination";
import * as repositorio from "./notificaciones.repository";
import { notificacionSchema } from "./notificaciones.schema";

/**
 * RF-12 · Notificaciones dentro de la app, versión mínima.
 *
 * Nadie llama a este módulo para notificar (CLAUDE.md §3.3): consume los
 * eventos que publican los demás (`src/eventos`) y crea una fila de
 * `Notificacion` para el destinatario. Guarda datos, no texto: el cliente
 * compone el mensaje y el enlace. Del jugador, el `payload` sólo lleva el
 * nombre, y sólo para el equipo dueño de la oferta.
 */

const log = logger.child({ modulo: "notificaciones" });

/** Qué notificación crea cada evento, y para quién. */
async function consumir(evento: Evento): Promise<void> {
  switch (evento.tipo) {
    // Nueva postulación → el usuario del equipo dueño de la oferta.
    case "POSTULACION_CREADA":
      await repositorio.crear({
        usuarioId: evento.equipoUsuarioId,
        tipo: "NUEVA_POSTULACION",
        payload: {
          ofertaId: evento.ofertaId,
          ofertaTitulo: evento.ofertaTitulo,
          postulacionId: evento.postulacionId,
          jugadorNombre: evento.jugadorNombre,
        },
      });
      return;
    // Cambio de estado (del equipo o por el cierre de la oferta) → el jugador.
    case "POSTULACION_CAMBIADA":
      await repositorio.crear({
        usuarioId: evento.jugadorUsuarioId,
        tipo: "POSTULACION_ACTUALIZADA",
        payload: {
          ofertaId: evento.ofertaId,
          ofertaTitulo: evento.ofertaTitulo,
          postulacionId: evento.postulacionId,
          estado: evento.estado,
          origen: evento.origen,
        },
      });
      return;
  }
}

let suscrito = false;

/** Se suscribe a los eventos una sola vez, al crear la app. */
export function escucharEventos(): void {
  if (suscrito) return;
  suscrito = true;
  suscribir(consumir);
}

/** Una fila que no cumple el contrato (un tipo antiguo) no rompe la lista: se omite. */
function aNotificaciones(filas: repositorio.NotificacionDb[]): Notificacion[] {
  return filas.flatMap((fila) => {
    const resultado = notificacionSchema.safeParse(fila);
    if (!resultado.success) log.warn({ id: fila.id, tipo: fila.tipo }, "Notificación con un formato desconocido");
    return resultado.success ? [resultado.data] : [];
  });
}

/** RF-12 · Las del usuario, paginadas, de la más reciente a la más antigua. */
export async function listar(usuarioId: string, opciones: OpcionesPaginacion): Promise<Notificaciones> {
  const rango = calcularRango(opciones);
  const { filas, total } = await repositorio.listar(usuarioId, rango);
  return paginar(aNotificaciones(filas), total, rango);
}

/** RF-12 · Cuántas tiene sin leer. */
export async function contarNoLeidas(usuarioId: string): Promise<ContadorNotificaciones> {
  return { noLeidas: await repositorio.contarNoLeidas(usuarioId) };
}

/** RF-12 · Marca como leídas las indicadas; los ids ajenos o inexistentes se ignoran. */
export async function marcarLeidas(usuarioId: string, ids: string[]): Promise<NotificacionesMarcadas> {
  return { marcadas: await repositorio.marcarLeidas(usuarioId, ids) };
}

/** RF-12 · Marca como leídas todas las del usuario. */
export async function marcarTodas(usuarioId: string): Promise<NotificacionesMarcadas> {
  return { marcadas: await repositorio.marcarLeidas(usuarioId) };
}
