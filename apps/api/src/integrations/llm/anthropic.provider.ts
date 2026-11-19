import Anthropic from "@anthropic-ai/sdk";
import {
  ErrorLLM,
  ErrorLLMTiempoAgotado,
  type PeticionLLM,
  type ProveedorLLM,
  type RespuestaLLM,
} from "./llm.tipos";

/**
 * Proveedor real: Claude por la API de Anthropic, con el SDK oficial.
 *
 * Parámetros, comprobados en la documentación oficial (2026-11-17):
 * - `output_config.effort: "low"`: Claude Haiku 5.5 admite los cinco niveles
 *   (por defecto `medium`); `low` es el recomendado para tareas cortas y de
 *   mucho volumen. https://platform.claude.com/docs/en/build-with-claude/effort
 * - `thinking: { type: "disabled" }`: se admite con esfuerzo `high` o inferior
 *   (con `xhigh` o `max` es un 400). Misma fuente.
 * - Sin `temperature`, `top_p` ni `top_k`, sin prefill del asistente, y con
 *   `stop_reason: "refusal"` tratado aparte (no hay respaldo en el servidor).
 *   https://platform.claude.com/docs/en/models/haiku-5-5/migration-guide
 * - Sin reintentos del SDK (`maxRetries: 0`): el tiempo máximo tiene que ser
 *   real, y un reintento lo multiplicaría.
 */
export class ProveedorAnthropic implements ProveedorLLM {
  readonly activo = true;
  private readonly cliente: Anthropic;

  constructor(
    apiKey: string,
    readonly modelo: string,
  ) {
    this.cliente = new Anthropic({ apiKey, maxRetries: 0 });
  }

  async generar({ sistema, entrada, timeoutMs }: PeticionLLM): Promise<RespuestaLLM> {
    let respuesta: Anthropic.Message;
    try {
      respuesta = await this.cliente.messages.create(
        {
          model: this.modelo,
          max_tokens: 400,
          thinking: { type: "disabled" },
          output_config: { effort: "low" },
          system: sistema,
          messages: [{ role: "user", content: entrada }],
        },
        { timeout: timeoutMs },
      );
    } catch (error) {
      if (error instanceof Anthropic.APIConnectionTimeoutError) throw new ErrorLLMTiempoAgotado();
      if (error instanceof Anthropic.APIError) {
        throw new ErrorLLM(`Anthropic respondió ${error.status ?? "sin estado"}`, "API");
      }
      throw new ErrorLLM("Fallo al llamar a Anthropic", "API");
    }

    if (respuesta.stop_reason === "refusal") throw new ErrorLLM("El modelo declinó la petición", "RECHAZO");
    const texto = respuesta.content
      .filter((bloque): bloque is Anthropic.TextBlock => bloque.type === "text")
      .map((bloque) => bloque.text)
      .join("")
      .trim();
    if (!texto || respuesta.stop_reason === "max_tokens") {
      throw new ErrorLLM("El modelo no devolvió un texto completo", "SIN_TEXTO");
    }
    return {
      texto,
      tokensEntrada: respuesta.usage.input_tokens,
      tokensSalida: respuesta.usage.output_tokens,
    };
  }
}
