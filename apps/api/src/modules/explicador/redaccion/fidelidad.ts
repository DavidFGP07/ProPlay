import { DIMENSIONES_SIN_DATOS_PILOTO, RANGOS_LOL } from "@proplay/shared";
import type { EntradaExplicador } from "./entrada";

/**
 * RF-11 · Comprobación de fidelidad: el texto generado se descarta si afirma
 * algo que no está en la entrada. Es una red, no una prueba de verdad: mira las
 * cifras, los rangos y las dimensiones ocultas, que es donde un error del
 * modelo engañaría al equipo.
 */

export type ResultadoFidelidad =
  | { fiel: true }
  | {
      fiel: false;
      causa:
        | "CIFRA"
        | "RANGO"
        | "DIMENSION_OCULTA"
        | "REQUISITOS_OMITIDOS"
        | "NOMBRE_DE_CAMPO"
        | "HORAS_VERIFICADAS";
      detalle: string;
    };

/**
 * Lo que el prompt obliga a escribir cuando hay requisitos sin cumplir: una
 * frase que empiece por «No cumple» (al principio del texto o tras un punto).
 */
const PATRON_NO_CUMPLE = /(?:^|[.!?]\s+)No cumple\b/;

/**
 * Las horas por semana las declara el jugador: decir que están «verificadas»
 * engaña al equipo. Busca «verificad…» en la misma frase que las horas o la
 * disponibilidad.
 */
const PATRON_HORAS_VERIFICADAS = /\b(horas?|disponibilidad)\b[^.]{0,60}\bverificad|\bverificad\w*\b[^.]{0,30}\bhoras?\b/;

/** «win rate» en inglés: el prompt pide «tasa de victorias». */
const PATRON_WIN_RATE = /\bwin\s?rate\b/;

/**
 * Nombres de campo de la entrada que el equipo no debe leer: toda clave o
 * código en camelCase («winRate», «csPorMinuto», «ordenPorAporte»…).
 */
function nombresDeCampo(valor: unknown, nombres = new Set<string>()): Set<string> {
  const esCamel = (t: string) => /^[a-z]+[A-Z][A-Za-z]*$/.test(t);
  if (typeof valor === "string" && esCamel(valor)) nombres.add(valor);
  else if (Array.isArray(valor)) valor.forEach((v) => nombresDeCampo(v, nombres));
  else if (valor && typeof valor === "object") {
    for (const [clave, v] of Object.entries(valor)) {
      if (esCamel(clave)) nombres.add(clave);
      nombresDeCampo(v, nombres);
    }
  }
  return nombres;
}

/** Todas las cifras que aparecen en la entrada, a cualquier profundidad. */
function cifrasDe(valor: unknown, cifras = new Set<number>()): Set<number> {
  if (typeof valor === "number") cifras.add(valor);
  else if (Array.isArray(valor)) valor.forEach((v) => cifrasDe(v, cifras));
  else if (valor && typeof valor === "object") Object.values(valor).forEach((v) => cifrasDe(v, cifras));
  return cifras;
}

/** Cifras que el texto puede usar: las de la entrada y su forma de fracción («45 %» o «0,45»). */
function cifrasPermitidas(entrada: EntradaExplicador): number[] {
  const cifras = [...cifrasDe(entrada)];
  return [...cifras, ...cifras.map((c) => c / 100)];
}

const casi = (a: number, b: number) => Math.abs(a - b) < 1e-9;

/** Minúsculas y sin tildes, para buscar palabras. */
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** `PLATINO_IV` → «platino iv»; `GRAN_MAESTRO` → «gran maestro». */
const rangoEnTexto = (rango: string) => rango.toLowerCase().replace(/_/g, " ");

const LIGAS = [...new Set(RANGOS_LOL.map((r) => rangoEnTexto(r).replace(/ (iv|iii|ii|i)$/, "")))]
  // «gran maestro» antes que «maestro», para que la alternativa larga gane.
  .sort((a, b) => b.length - a.length);
const PATRON_RANGO = new RegExp(`\\b(${LIGAS.join("|")})(?:\\s+(iv|iii|ii|i))?\\b`, "g");

/** «oro» es también una métrica («oro por minuto»): no es un rango. */
const METRICA_ORO = /\boro\s*(por|\/)\s*min(uto)?\b/g;

/** Cómo se nombran en un texto las dimensiones sin datos del piloto. */
const NOMBRES_OCULTAS: Record<(typeof DIMENSIONES_SIN_DATOS_PILOTO)[number], RegExp> = {
  experiencia: /\bexperiencia\b|\btrayectoria\b/,
  habilidadesBlandas: /\bhabilidades blandas\b|\bendorsements?\b|\brecomendaciones de equipos\b/,
};

export function comprobarFidelidad(texto: string, entrada: EntradaExplicador): ResultadoFidelidad {
  // Cifras: una coma o un punto entre dígitos es decimal («5,38»).
  const permitidas = cifrasPermitidas(entrada);
  for (const encontrada of texto.match(/\d+(?:[.,]\d+)?/g) ?? []) {
    const numero = Number(encontrada.replace(",", "."));
    if (!permitidas.some((p) => casi(p, numero))) {
      return { fiel: false, causa: "CIFRA", detalle: encontrada };
    }
  }

  const normalizado = normalizar(texto);

  // Rangos: la liga tiene que estar en la entrada y, si lleva división, el rango exacto.
  const rangos = [
    entrada.oferta.rangoMinimo,
    entrada.dimensiones.find((d) => d.dimension === "tecnica")?.detalle.rango,
    ...entrada.requisitosNoCumplidos.filter((r) => r.requisito === "rangoMinimo").map((r) => r.candidato),
  ]
    .filter((r): r is string => typeof r === "string")
    .map(rangoEnTexto);
  const ligas = rangos.map((r) => r.replace(/ (iv|iii|ii|i)$/, ""));
  for (const [, liga, division] of normalizado.replace(METRICA_ORO, " ").matchAll(PATRON_RANGO)) {
    const completo = division ? `${liga} ${division}` : liga!;
    if (!ligas.includes(liga!) || (division && !rangos.includes(completo))) {
      return { fiel: false, causa: "RANGO", detalle: completo };
    }
  }

  // Dimensiones ocultas: no están en la entrada, así que no se pueden mencionar.
  for (const [dimension, patron] of Object.entries(NOMBRES_OCULTAS)) {
    if (patron.test(normalizado)) return { fiel: false, causa: "DIMENSION_OCULTA", detalle: dimension };
  }

  // Nombres de campo: el texto habla en español, no con las claves del JSON.
  for (const nombre of nombresDeCampo(entrada)) {
    if (new RegExp(`\\b${nombre}\\b`).test(texto)) {
      return { fiel: false, causa: "NOMBRE_DE_CAMPO", detalle: nombre };
    }
  }
  if (PATRON_WIN_RATE.test(normalizado)) return { fiel: false, causa: "NOMBRE_DE_CAMPO", detalle: "win rate" };

  // Las horas son declaradas, nunca verificadas.
  if (PATRON_HORAS_VERIFICADAS.test(normalizado)) {
    return { fiel: false, causa: "HORAS_VERIFICADAS", detalle: "horas" };
  }

  // Requisitos sin cumplir: el texto no puede callarlos y resaltar sólo lo bueno.
  if (entrada.requisitosNoCumplidos.length > 0 && !PATRON_NO_CUMPLE.test(texto.trim())) {
    return {
      fiel: false,
      causa: "REQUISITOS_OMITIDOS",
      detalle: entrada.requisitosNoCumplidos.map((r) => r.requisito).join(","),
    };
  }
  return { fiel: true };
}
