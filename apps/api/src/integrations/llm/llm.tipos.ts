/**
 * Interfaz común de los proveedores de modelos de lenguaje (RF-11).
 *
 * El explicador trabaja siempre contra `ProveedorLLM`: la implementación real
 * (Anthropic), la falsa de las pruebas o la desactivada cuando no hay clave.
 * El ranking nunca depende de esto (tarea 4.3).
 */

export interface PeticionLLM {
  /** Instrucciones de sistema (el prompt versionado). */
  sistema: string;
  /** Mensaje del usuario: sólo cifras y códigos, nunca datos personales. */
  entrada: string;
  /** Tiempo máximo de espera; pasado, se lanza `ErrorLLMTiempoAgotado`. */
  timeoutMs: number;
}

export interface RespuestaLLM {
  texto: string;
  tokensEntrada: number;
  tokensSalida: number;
}

export interface ProveedorLLM {
  /** Modelo que usa; `null` si el proveedor está desactivado. */
  readonly modelo: string | null;
  readonly activo: boolean;
  generar(peticion: PeticionLLM): Promise<RespuestaLLM>;
}

/** El proveedor no respondió a tiempo. */
export class ErrorLLMTiempoAgotado extends Error {
  constructor() {
    super("El proveedor de modelos de lenguaje no respondió a tiempo");
    this.name = "ErrorLLMTiempoAgotado";
  }
}

/** El proveedor falló, declinó la petición o no devolvió texto. */
export class ErrorLLM extends Error {
  constructor(
    mensaje: string,
    /** Código corto para el registro (nunca el contenido de la petición). */
    readonly causa: "API" | "RECHAZO" | "SIN_TEXTO" | "DESACTIVADO",
  ) {
    super(mensaje);
    this.name = "ErrorLLM";
  }
}

/**
 * Precio por millón de tokens, en USD, para estimar el coste de cada llamada
 * en los registros. Fuente: https://platform.claude.com/docs/en/about-claude/pricing
 * (precio de prompts de hasta 100.000 tokens; los del explicador son de unos
 * cientos). Un modelo que no esté aquí registra el coste como nulo.
 */
export const PRECIOS_POR_MILLON: Readonly<Record<string, { entrada: number; salida: number }>> = {
  "claude-haiku-5-5": { entrada: 0.1, salida: 0.5 },
};

/** Coste estimado en USD, o `null` si no se conoce el precio del modelo. */
export function costeEstimado(modelo: string, tokensEntrada: number, tokensSalida: number): number | null {
  const precio = PRECIOS_POR_MILLON[modelo];
  if (!precio) return null;
  return (tokensEntrada * precio.entrada + tokensSalida * precio.salida) / 1_000_000;
}
