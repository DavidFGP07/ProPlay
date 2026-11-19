import { createHash } from "node:crypto";
import type { ExplicacionGenerada, MotivoExplicacionNoDisponible } from "@proplay/shared";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import {
  ErrorLLM,
  ErrorLLMTiempoAgotado,
  costeEstimado,
  obtenerProveedorLLM,
} from "../../integrations";
import * as matching from "../matching/matching.service";
import * as repositorio from "./explicador.repository";
import { comprobarFidelidad } from "./redaccion/fidelidad";
import { construirEntrada, serializarEntrada } from "./redaccion/entrada";
import { PROMPT_SISTEMA, VERSION_PROMPT, mensajeUsuario } from "./redaccion/prompt";

/**
 * RF-11 · Explicador con modelo de lenguaje (tareas 4.1, 4.3 y 4.7).
 *
 * Redacta en lenguaje natural por qué un candidato del ranking encaja con la
 * oferta, anclado en los datos del ranking recuperados al pedirlo (el detalle
 * del candidato recalcula si algo cambió). Nunca lanza por culpa del modelo:
 * cualquier fallo se devuelve como `NO_DISPONIBLE` con su motivo y la vista se
 * queda con la explicación determinista. Los errores de permisos y el 404 sí
 * se propagan: son los del detalle del candidato.
 *
 * Depende de `matching` (que no sabe nada de él) y de la integración de
 * modelos de lenguaje; el motor de matching sigue sin red.
 */

export type Actor = matching.Actor;

/** Configuración en uso; las pruebas la ajustan. */
export const configuracion = {
  timeoutMs: env.EXPLICADOR_TIMEOUT_MS,
  limiteUsuarioHora: env.EXPLICADOR_LIMITE_USUARIO_HORA,
  limiteDiario: env.EXPLICADOR_LIMITE_DIARIO,
};

const log = logger.child({ modulo: "explicador" });

/** Clave de la caché: el contenido de la entrada, la versión del prompt y el modelo. */
function claveCache(entrada: string, modelo: string): string {
  return createHash("sha256").update(`${VERSION_PROMPT}\n${modelo}\n${entrada}`).digest("hex");
}

function noDisponible(
  motivo: MotivoExplicacionNoDisponible,
  modelo: string | null,
): ExplicacionGenerada {
  return { estado: "NO_DISPONIBLE", texto: null, motivo, modelo, versionPrompt: VERSION_PROMPT, deCache: false };
}

export async function explicar(
  ofertaId: string,
  jugadorId: string,
  actor: Actor,
): Promise<ExplicacionGenerada> {
  // Permisos, recálculo al leer y 404: los del detalle del candidato.
  const { candidato } = await matching.candidato(ofertaId, jugadorId, actor);

  const proveedor = obtenerProveedorLLM();
  if (!proveedor.activo || !proveedor.modelo) return noDisponible("DESACTIVADO", null);
  const modelo = proveedor.modelo;

  const entrada = construirEntrada(candidato);
  const serializada = serializarEntrada(entrada);
  const clave = claveCache(serializada, modelo);
  const inicio = Date.now();

  const registrar = (datos: Record<string, unknown>) =>
    log.info({ modelo, versionPrompt: VERSION_PROMPT, ms: Date.now() - inicio, ...datos }, "Explicación del candidato");

  try {
    const guardado = await repositorio.leerTexto(clave);
    if (guardado) {
      registrar({ deCache: true });
      return { estado: "GENERADA", texto: guardado, motivo: null, modelo, versionPrompt: VERSION_PROMPT, deCache: true };
    }
    const reservada = await repositorio.reservarGeneracion(actor.id, new Date(), {
      usuarioHora: configuracion.limiteUsuarioHora,
      diario: configuracion.limiteDiario,
    });
    if (!reservada) {
      registrar({ motivo: "LIMITE" });
      return noDisponible("LIMITE", modelo);
    }
  } catch (error) {
    log.warn({ error: (error as Error).message }, "Redis no respondió al explicador");
    return noDisponible("ERROR", modelo);
  }

  let respuesta;
  try {
    respuesta = await proveedor.generar({
      sistema: PROMPT_SISTEMA,
      entrada: mensajeUsuario(serializada),
      timeoutMs: configuracion.timeoutMs,
    });
  } catch (error) {
    const motivo = error instanceof ErrorLLMTiempoAgotado ? "TIEMPO_AGOTADO" : "ERROR";
    registrar({ motivo, causa: error instanceof ErrorLLM ? error.causa : "DESCONOCIDA" });
    return noDisponible(motivo, modelo);
  }

  const { texto, tokensEntrada, tokensSalida } = respuesta;
  const tokens = { tokensEntrada, tokensSalida, costeUsd: costeEstimado(modelo, tokensEntrada, tokensSalida) };
  const fidelidad = comprobarFidelidad(texto, entrada);
  if (!fidelidad.fiel) {
    // Sólo la causa y el elemento que falló: nunca el texto entero.
    registrar({ ...tokens, motivo: "FIDELIDAD", causa: fidelidad.causa, detalle: fidelidad.detalle });
    return noDisponible("FIDELIDAD", modelo);
  }

  try {
    await repositorio.guardarTexto(clave, texto);
  } catch (error) {
    log.warn({ error: (error as Error).message }, "No se pudo guardar la explicación en la caché");
  }
  registrar({ ...tokens, deCache: false });
  return { estado: "GENERADA", texto, motivo: null, modelo, versionPrompt: VERSION_PROMPT, deCache: false };
}
