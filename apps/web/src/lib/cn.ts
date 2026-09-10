/** Concatena clases de Tailwind descartando las vacías o condicionales. */
export function cn(...clases: Array<string | false | null | undefined>): string {
  return clases.filter(Boolean).join(" ");
}
