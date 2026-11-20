import { POSICIONES_LOL, type PosicionLol } from "@proplay/shared";

/**
 * RF-11 · Pulido determinista del texto que devuelve el modelo, antes de la
 * comprobación de fidelidad y de la caché. Sólo cambia la forma, nunca una
 * cifra ni una palabra con contenido:
 *
 * - Coma decimal española: «7.95» → «7,95». La fidelidad ya lee las dos.
 * - Posiciones como las escribe la interfaz: «MID» → «Mid», «JUNGLA» → «Jungla».
 *   «ADC» se queda igual.
 */
const NOMBRE_POSICION: Record<PosicionLol, string> = {
  TOP: "Top",
  JUNGLA: "Jungla",
  MID: "Mid",
  ADC: "ADC",
  SOPORTE: "Soporte",
};

const PATRON_POSICION = new RegExp(`\\b(${POSICIONES_LOL.join("|")})\\b`, "g");

export function pulirFormato(texto: string): string {
  return texto
    .replace(/(\d)\.(\d)/g, "$1,$2")
    .replace(PATRON_POSICION, (codigo) => NOMBRE_POSICION[codigo as PosicionLol]);
}
