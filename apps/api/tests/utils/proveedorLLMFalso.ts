import type { PeticionLLM, ProveedorLLM, RespuestaLLM } from "../../src/integrations";

/**
 * Proveedor de modelos de lenguaje de las pruebas: no sale del proceso.
 * Devuelve el texto que se le indique (o lo que devuelva la función) y guarda
 * las peticiones que recibió, para comprobar la caché y la entrada.
 */
export class ProveedorLLMFalso implements ProveedorLLM {
  readonly activo = true;
  readonly peticiones: PeticionLLM[] = [];
  respuesta: RespuestaLLM | ((peticion: PeticionLLM) => Promise<RespuestaLLM>) = {
    texto: "Texto de prueba.",
    tokensEntrada: 700,
    tokensSalida: 120,
  };

  constructor(readonly modelo = "modelo-falso") {}

  async generar(peticion: PeticionLLM): Promise<RespuestaLLM> {
    this.peticiones.push(peticion);
    return typeof this.respuesta === "function" ? this.respuesta(peticion) : this.respuesta;
  }
}
