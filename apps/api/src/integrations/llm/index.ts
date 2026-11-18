import { env } from "../../config/env";
import { ProveedorAnthropic } from "./anthropic.provider";
import { ErrorLLM, type ProveedorLLM, type RespuestaLLM } from "./llm.tipos";

/** Sin clave o con el explicador apagado: nunca llama a nadie. */
export class ProveedorLLMDesactivado implements ProveedorLLM {
  readonly activo = false;
  readonly modelo = null;

  generar(): Promise<RespuestaLLM> {
    return Promise.reject(new ErrorLLM("El explicador está desactivado", "DESACTIVADO"));
  }
}

function proveedorPorDefecto(): ProveedorLLM {
  // En las pruebas EXPLICADOR_ACTIVO vale false por defecto: el CI nunca llama
  // al proveedor real, aunque haya una clave en el entorno.
  if (!env.EXPLICADOR_ACTIVO || !env.ANTHROPIC_API_KEY) return new ProveedorLLMDesactivado();
  return new ProveedorAnthropic(env.ANTHROPIC_API_KEY, env.EXPLICADOR_MODELO);
}

let proveedor: ProveedorLLM = proveedorPorDefecto();

export function obtenerProveedorLLM(): ProveedorLLM {
  return proveedor;
}

/** Sólo para las pruebas: sustituye el proveedor (`null` vuelve al de la configuración). */
export function usarProveedorLLM(nuevo: ProveedorLLM | null): void {
  proveedor = nuevo ?? proveedorPorDefecto();
}

export { ErrorLLM, ErrorLLMTiempoAgotado, costeEstimado } from "./llm.tipos";
export type { PeticionLLM, ProveedorLLM, RespuestaLLM } from "./llm.tipos";
