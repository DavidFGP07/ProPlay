import type { EstadoPostulacion, OrigenCambioPostulacion } from "@proplay/shared";
import { logger } from "../config/logger";

/**
 * Emisor de eventos del dominio, en proceso (CLAUDE.md §3.3: los módulos
 * publican un evento y `notificaciones` lo consume; nadie lo invoca
 * directamente).
 *
 * `publicar` no espera a los consumidores ni falla nunca: el que publica ya
 * guardó su cambio (se publica después de la transacción) y un fallo al
 * notificar no puede deshacerlo. Un consumidor que falla deja una línea en el
 * registro y nada más. No es durable: si el proceso cae entre el cambio y el
 * consumo, ese evento se pierde. La evolución natural es una cola de BullMQ
 * sobre el Redis que ya existe (`docs/decisiones.md`, «Notificaciones»).
 */

export type Evento =
  | {
      tipo: "POSTULACION_CREADA";
      ofertaId: string;
      ofertaTitulo: string;
      postulacionId: string;
      /** Nombre de quien se postula: el equipo dueño ya lo ve en sus postulaciones. */
      jugadorNombre: string;
      /** Usuario del equipo dueño de la oferta. */
      equipoUsuarioId: string;
    }
  | {
      tipo: "POSTULACION_CAMBIADA";
      ofertaId: string;
      ofertaTitulo: string;
      postulacionId: string;
      /** Usuario del jugador que se postuló. */
      jugadorUsuarioId: string;
      estado: EstadoPostulacion;
      origen: OrigenCambioPostulacion;
    };

export type Consumidor = (evento: Evento) => Promise<void>;

const consumidores = new Set<Consumidor>();
const pendientes = new Set<Promise<void>>();
const log = logger.child({ modulo: "eventos" });

/** Registra un consumidor; devuelve la función que lo da de baja. */
export function suscribir(consumidor: Consumidor): () => void {
  consumidores.add(consumidor);
  return () => consumidores.delete(consumidor);
}

/** Entrega el evento a cada consumidor, sin esperar y sin propagar errores. */
export function publicar(evento: Evento): void {
  for (const consumidor of consumidores) {
    const entrega: Promise<void> = Promise.resolve()
      .then(() => consumidor(evento))
      .catch((error: unknown) => {
        log.error({ tipo: evento.tipo, error: (error as Error).message }, "Un consumidor de eventos falló");
      })
      .finally(() => pendientes.delete(entrega));
    pendientes.add(entrega);
  }
}

/** Espera a que terminen las entregas en curso (pruebas y apagado ordenado). */
export async function esperarEventos(): Promise<void> {
  while (pendientes.size > 0) await Promise.all([...pendientes]);
}
