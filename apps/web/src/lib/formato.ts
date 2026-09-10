/** Utilidades de presentación compartidas por las páginas. */

export function porcentaje(valor: number): string {
  return `${Math.round(valor * 100)}%`;
}

export function fechaCorta(valor: string | Date): string {
  const fecha = typeof valor === "string" ? new Date(valor) : valor;
  return fecha.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const ETIQUETAS_ROL: Record<string, string> = {
  JUGADOR: "Jugador",
  EQUIPO: "Equipo",
  SCOUT: "Scout",
  ADMIN: "Administrador",
};

export function etiquetaRol(rol: string): string {
  return ETIQUETAS_ROL[rol] ?? rol;
}
